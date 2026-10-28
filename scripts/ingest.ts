/**
 * Ingest pipeline: Leaguepedia Cargo → data/<tournament>/*.json
 *
 * Usage: pnpm ingest [--force] [--out data/worlds-2026]
 *
 * Env:
 *   LEAGUEPEDIA_TRANSPORT   "export" (default) | "api"
 *   LEAGUEPEDIA_BOT_USER    bot username (api transport only)
 *   LEAGUEPEDIA_BOT_PASSWORD
 *   LEAGUEPEDIA_DELAY_MS    pause between requests (default 1500)
 *   INGEST_USER_AGENT       custom User-Agent (add a contact if you run this a lot)
 *   INGEST_MAX_STALE_HOURS  rewrite meta.json even without data changes after N hours (default 6)
 *   LOLESPORTS_API_KEY      public key of lolesports.com; enables provisional series results (unset = skipped)
 *
 * Sources are merged by priority (lib/ingest/merge.ts): Leaguepedia > data/manual/ > lolesports.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: rely on the environment (GitHub Actions) */
}
import { SCHEMA_VERSION, datasetFiles, seedsFileSchema } from "../lib/data/schema";
import { aliasFromPage, decodeEntities, idFromCargoKey, slugify } from "../lib/data/ids";
import type {
  ChampionIndex,
  Draft,
  Game,
  GameTeamStats,
  Meta,
  Player,
  PlayerGame,
  Role,
  Series,
  SeriesStatus,
  StageId,
  Team,
  Tournament,
  TournamentStage,
} from "../lib/data/types";
import {
  LeaguepediaClient,
  RateLimitError,
  asBool,
  asInt,
  asList,
  asNumber,
  asSlots,
  asString,
  type CargoRow,
  type Transport,
} from "../lib/sources/leaguepedia";
import {
  fetchChampionIndex,
  fetchDdragonVersions,
  normalizeChampionName,
  pickDdragonVersion,
} from "../lib/sources/ddragon";
import { mergeSources } from "../lib/ingest/merge";
import { LolesportsClient, fetchLeagueId, fetchSchedule, type LolesportsMatch } from "../lib/sources/lolesports";
import { loadManualDir } from "../lib/sources/manual";

/* ------------------------------------------------------------------ config */

const TOURNAMENT = {
  id: "worlds-2026",
  overviewPage: "2026 Season World Championship",
  stagePages: {
    playin: "2026 Season World Championship/Play-In",
    main: "2026 Season World Championship/Main Event",
  },
} as const;

const SOURCE = {
  name: "Leaguepedia",
  url: "https://lol.fandom.com",
  license: "CC BY-SA 3.0",
};

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const OUT_DIR = path.resolve(
  process.cwd(),
  args[args.indexOf("--out") + 1] && args.includes("--out") ? args[args.indexOf("--out") + 1] : `data/${TOURNAMENT.id}`,
);
const MAX_STALE_HOURS = Number(process.env.INGEST_MAX_STALE_HOURS ?? 6);
const MANUAL_DIR = path.resolve(process.cwd(), "data/manual");
const LOLESPORTS_LEAGUE_SLUG = "worlds";
const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

const log = (msg: string) => console.log(`[ingest] ${msg}`);
const warnings: string[] = [];
const warn = (msg: string) => {
  warnings.push(msg);
  console.warn(`[ingest] warning: ${msg}`);
};

/* ------------------------------------------------------------------ helpers */

const ROLE_MAP: Record<string, Role> = { top: "top", jungle: "jungle", mid: "mid", bot: "bot", support: "support" };
const roleOf = (v: unknown): Role | null => ROLE_MAP[(asString(v) ?? "").toLowerCase()] ?? null;

const ROSTER_REGION_CODES: Record<string, string> = {
  KR: "Korea",
  CN: "China",
  EMEA: "EMEA",
  EU: "EMEA",
  NA: "North America",
  APAC: "Asia Pacific",
  BR: "Brazil",
  Brazil: "Brazil",
};

function toIso(cargoDateTime: string | null): string | null {
  if (!cargoDateTime) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(cargoDateTime);
  return m ? `${m[1]}T${m[2]}Z` : null;
}

function parseGamelength(text: string | null, minutes: number | null): number | null {
  if (text) {
    const m = /^(\d+):(\d{2})$/.exec(text.trim());
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  if (minutes !== null && minutes > 0) return Math.round(minutes * 60);
  return null;
}

/** CONCAT('v', Patch) keeps "26.20" from being coerced to 26.2 by the export's JSON encoder. */
function unprefix(v: unknown): string | null {
  const s = asString(v);
  return s && s.startsWith("v") ? s.slice(1) : s;
}

function sqlIn(values: Iterable<string>): string {
  return Array.from(values, (v) => `"${v.replace(/"/g, '\\"')}"`).join(",");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function stageFromTab(page: string, tab: string | null): { stage: StageId; round: number | null } | null {
  const round = tab ? /^Round (\d+)$/i.exec(tab)?.[1] : undefined;
  if (page === TOURNAMENT.stagePages.playin) return { stage: "playin", round: round ? Number(round) : null };
  if (round) return { stage: "swiss", round: Number(round) };
  const t = (tab ?? "").toLowerCase();
  if (t.startsWith("quarterfinal")) return { stage: "quarterfinals", round: null };
  if (t.startsWith("semifinal")) return { stage: "semifinals", round: null };
  if (t.startsWith("final") || t === "grand final" || t === "grand finals") return { stage: "final", round: null };
  return null;
}

const STAGE_META: Record<StageId, { name: string; page: string }> = {
  playin: { name: "Play-In", page: TOURNAMENT.stagePages.playin },
  swiss: { name: "Swiss Stage", page: TOURNAMENT.stagePages.main },
  quarterfinals: { name: "Quarterfinals", page: TOURNAMENT.stagePages.main },
  semifinals: { name: "Semifinals", page: TOURNAMENT.stagePages.main },
  final: { name: "Final", page: TOURNAMENT.stagePages.main },
};
const STAGE_ORDER: StageId[] = ["playin", "swiss", "quarterfinals", "semifinals", "final"];

/* ------------------------------------------------------------------ fetch */

async function fetchAll(client: LeaguepediaClient) {
  const stagePages = Object.values(TOURNAMENT.stagePages) as string[];
  const inStages = `OverviewPage IN (${sqlIn(stagePages)})`;

  log(`querying Tournaments`);
  const tournaments = await client.query({
    tables: "Tournaments",
    fields: "Name,OverviewPage,DateStart,Date,League,Region,Country,EventType,Links,IsQualifier,IsPlayoffs,IsOfficial",
    where: `OverviewPage IN (${sqlIn([TOURNAMENT.overviewPage, ...stagePages])})`,
  });

  log(`querying MatchSchedule`);
  const schedule = await client.query({
    tables: "MatchSchedule",
    fields:
      "MatchId,OverviewPage,Team1,Team2,Team1Score,Team2Score,Winner,DateTime_UTC=DateTimeUTC,HasTime,BestOf,Tab,N_MatchInTab=NMatchInTab,N_TabInPage=NTabInPage,MatchDay,CONCAT('v',Patch)=PatchV,Stream,MVP,IsNullified",
    where: inStages,
    orderBy: "DateTime_UTC,N_TabInPage,N_MatchInTab",
  });

  log(`querying MatchScheduleGame`);
  const scheduleGames = await client.query({
    tables: "MatchScheduleGame",
    fields: "GameId,MatchId,OverviewPage,Blue,Red,Winner,N_GameInMatch=NGameInMatch,Vod,RiotPlatformGameId",
    where: inStages,
    orderBy: "MatchId,N_GameInMatch",
  });

  log(`querying ScoreboardGames`);
  const games = await client.query({
    tables: "ScoreboardGames",
    fields:
      "GameId,MatchId,OverviewPage,Team1,Team2,WinTeam,DateTime_UTC=DateTimeUTC,Winner,Gamelength,Gamelength_Number=GamelengthNumber,Team1Bans,Team2Bans,Team1Picks,Team2Picks,Team1Dragons,Team2Dragons,Team1Elders,Team2Elders,Team1Barons,Team2Barons,Team1Towers,Team2Towers,Team1Inhibitors,Team2Inhibitors,Team1Gold,Team2Gold,Team1Kills,Team2Kills,Team1RiftHeralds,Team2RiftHeralds,Team1VoidGrubs,Team2VoidGrubs,CONCAT('v',Patch)=PatchV,N_GameInMatch=NGameInMatch,RiotPlatformGameId,VOD",
    where: inStages,
    orderBy: "DateTime_UTC,GameId",
  });

  log(`querying ScoreboardPlayers`);
  const players = await client.query({
    tables: "ScoreboardPlayers",
    fields:
      "GameId,MatchId,Link,Champion,Kills,Deaths,Assists,Gold,CS,DamageToChampions,VisionScore,Items,Trinket,KeystoneRune,PrimaryTree,SecondaryTree,Runes,SummonerSpells,TeamKills,TeamGold,Team,TeamVs,PlayerWin,Role,IngameRole,Side,Pentakills",
    where: inStages,
    orderBy: "DateTime_UTC,GameId,Side,Role_Number",
  });

  log(`querying PicksAndBansS7`);
  const drafts = await client.query({
    tables: "PicksAndBansS7",
    fields:
      "GameId,MatchId,Team1,Team2,SwitchedSides,IsFilled,IsComplete,Team1Ban1,Team1Ban2,Team1Ban3,Team1Ban4,Team1Ban5,Team1Pick1,Team1Pick2,Team1Pick3,Team1Pick4,Team1Pick5,Team2Ban1,Team2Ban2,Team2Ban3,Team2Ban4,Team2Ban5,Team2Pick1,Team2Pick2,Team2Pick3,Team2Pick4,Team2Pick5,Team1PicksByRoleOrder,Team2PicksByRoleOrder",
    where: inStages,
  });

  log(`querying TournamentRosters`);
  const rosters = await client.query({
    tables: "TournamentRosters",
    fields: "Team,OverviewPage,Region",
    where: inStages,
  });

  log(`querying TournamentPlayers`);
  const tournamentPlayers = await client.query({
    tables: "TournamentPlayers",
    fields: "Team,Link,Player,Role,OverviewPage,N_PlayerInTeam=NPlayerInTeam",
    where: inStages,
  });

  // Resolve player page redirects: scoreboards sometimes link an alternative spelling of a player page.
  const linkCandidates = new Set<string>();
  for (const r of [...tournamentPlayers, ...players]) {
    const v = asString(r.Link);
    if (v) linkCandidates.add(v);
  }
  log(`querying PlayerRedirects (${linkCandidates.size})`);
  const redirectMap = new Map<string, string>();
  for (const part of chunk(Array.from(linkCandidates), 60)) {
    const rows = await client.query({
      tables: "PlayerRedirects",
      fields: "AllName,OverviewPage",
      where: `AllName IN (${sqlIn(part)})`,
    });
    for (const r of rows) {
      const from = asString(r.AllName);
      const to = asString(r.OverviewPage);
      if (from && to) redirectMap.set(from.toLowerCase(), to);
    }
  }
  let redirected = 0;
  for (const r of [...tournamentPlayers, ...players]) {
    const v = asString(r.Link);
    const canonical = v ? redirectMap.get(v.toLowerCase()) : undefined;
    if (v && canonical && canonical !== v) {
      r.Link = canonical;
      redirected += 1;
    }
  }
  if (redirected) log(`resolved ${redirected} player links through PlayerRedirects`);

  const teamPages = new Set<string>();
  for (const r of [...rosters, ...schedule]) {
    for (const k of ["Team", "Team1", "Team2"]) {
      const v = asString(r[k]);
      if (v && v !== "TBD") teamPages.add(v);
    }
  }
  for (const r of players) {
    const v = asString(r.Team);
    if (v) teamPages.add(v);
  }
  log(`querying Teams (${teamPages.size})`);
  const teams: CargoRow[] = [];
  for (const part of chunk(Array.from(teamPages), 60)) {
    teams.push(
      ...(await client.query({
        tables: "Teams",
        fields: "Name,OverviewPage,Short,Region,Location,TeamLocation",
        where: `OverviewPage IN (${sqlIn(part)})`,
      })),
    );
  }

  const playerPages = new Set<string>();
  for (const r of tournamentPlayers) {
    const v = asString(r.Link);
    if (v && roleOf(r.Role)) playerPages.add(v);
  }
  for (const r of players) {
    const v = asString(r.Link);
    if (v) playerPages.add(v);
  }
  log(`querying Players (${playerPages.size})`);
  const playerRows: CargoRow[] = [];
  for (const part of chunk(Array.from(playerPages), 60)) {
    playerRows.push(
      ...(await client.query({
        tables: "Players",
        fields: "ID,OverviewPage,Name,NativeName,Country,Residency,Role",
        where: `OverviewPage IN (${sqlIn(part)})`,
      })),
    );
  }

  return {
    tournaments,
    schedule,
    scheduleGames,
    games,
    players,
    drafts,
    rosters,
    tournamentPlayers,
    teams,
    playerRows,
  };
}

/* ------------------------------------------------------------------ normalise */

type Raw = Awaited<ReturnType<typeof fetchAll>>;

function buildTeams(raw: Raw): { teams: Team[]; teamIdByPage: Map<string, string> } {
  const byPage = new Map<string, Team>();
  const usedIds = new Set<string>();
  const rosterRegion = new Map<string, string>();
  const rosterStages = new Map<string, Set<"playin" | "main">>();
  for (const r of raw.rosters) {
    const page = asString(r.Team);
    if (!page) continue;
    const code = asString(r.Region);
    if (code) rosterRegion.set(page, ROSTER_REGION_CODES[code] ?? code);
    const stage = asString(r.OverviewPage) === TOURNAMENT.stagePages.playin ? "playin" : "main";
    (rosterStages.get(page) ?? rosterStages.set(page, new Set()).get(page)!).add(stage);
  }

  const teamRowsByPage = new Map(raw.teams.map((r) => [asString(r.OverviewPage) ?? "", r]));
  const pages = new Set<string>([...rosterStages.keys(), ...teamRowsByPage.keys()]);
  for (const page of Array.from(pages).sort()) {
    const row = teamRowsByPage.get(page);
    const name = decodeEntities(asString(row?.Name) ?? page);
    let short = asString(row?.Short);
    if (!short) {
      warn(`team "${page}" has no Short in Teams; using its name as tag`);
      short = name;
    }
    let region = asString(row?.Region) ?? rosterRegion.get(page) ?? null;
    if (!region) {
      warn(`team "${page}" has no region; using "Unknown"`);
      region = "Unknown";
    }
    let id = slugify(name);
    if (usedIds.has(id)) id = slugify(page);
    if (usedIds.has(id)) throw new Error(`team id collision for ${page}`);
    usedIds.add(id);
    byPage.set(page, {
      id,
      name,
      short,
      page,
      region,
      location: asString(row?.Location) ?? asString(row?.TeamLocation) ?? null,
      stages: Array.from(rosterStages.get(page) ?? []).sort(),
      roster: [],
      coaches: [],
      seed: null,
    });
  }
  // Coaches: roster rows whose role is "Coach" (head coaches first as listed on Leaguepedia).
  for (const r of raw.tournamentPlayers) {
    if (!/coach/i.test(asString(r.Role) ?? "")) continue;
    const page = asString(r.Team);
    const link = asString(r.Link);
    const name = decodeEntities(asString(r.Player) ?? (link ? aliasFromPage(link) : ""));
    const team = page ? byPage.get(page) : undefined;
    if (!team || !name) continue;
    if (!team.coaches.includes(name)) team.coaches.push(name);
  }
  const teamIdByPage = new Map(Array.from(byPage, ([page, t]) => [page, t.id]));
  return { teams: Array.from(byPage.values()), teamIdByPage };
}

function buildPlayers(
  raw: Raw,
  teams: Team[],
  teamIdByPage: Map<string, string>,
): { players: Player[]; playerIdByPage: Map<string, string> } {
  const playerRowByPage = new Map(raw.playerRows.map((r) => [asString(r.OverviewPage) ?? "", r]));
  const byPage = new Map<string, Player>();
  const usedIds = new Map<string, string>();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const makeId = (page: string, alias: string): string => {
    let id = slugify(alias) || slugify(page);
    if (usedIds.has(id) && usedIds.get(id) !== page) id = slugify(page);
    if (usedIds.has(id) && usedIds.get(id) !== page) throw new Error(`player id collision for ${page}`);
    usedIds.set(id, page);
    return id;
  };

  const add = (page: string, teamPage: string, role: Role, fromScoreboardOnly: boolean) => {
    const teamId = teamIdByPage.get(teamPage);
    if (!teamId) {
      warn(`player "${page}" belongs to unknown team "${teamPage}"; skipped`);
      return;
    }
    const existing = byPage.get(page);
    if (existing) {
      if (existing.fromScoreboardOnly && !fromScoreboardOnly) {
        existing.fromScoreboardOnly = false;
        existing.role = role;
        existing.teamId = teamId;
      }
      return;
    }
    const row = playerRowByPage.get(page);
    const alias = decodeEntities(asString(row?.ID) ?? aliasFromPage(page));
    const player: Player = {
      id: makeId(page, alias),
      name: alias,
      page,
      teamId,
      role,
      country: asString(row?.Country),
      realName: row?.Name ? decodeEntities(String(row.Name)) : null,
      nativeName: row?.NativeName ? decodeEntities(String(row.NativeName)) : null,
      residency: asString(row?.Residency),
      fromScoreboardOnly,
    };
    byPage.set(page, player);
    teamById.get(teamId)?.roster.push({ playerId: player.id, role });
  };

  // Main-event roster first so teams that played both stages keep their final line-up.
  const tp = [...raw.tournamentPlayers].sort((a, b) => {
    const am = asString(a.OverviewPage) === TOURNAMENT.stagePages.main ? 0 : 1;
    const bm = asString(b.OverviewPage) === TOURNAMENT.stagePages.main ? 0 : 1;
    return am - bm || (asInt(a.NPlayerInTeam) ?? 0) - (asInt(b.NPlayerInTeam) ?? 0);
  });
  for (const r of tp) {
    const page = asString(r.Link);
    const role = roleOf(r.Role);
    const teamPage = asString(r.Team);
    if (!page || !role || !teamPage) continue;
    add(page, teamPage, role, false);
  }
  for (const r of raw.players) {
    const page = asString(r.Link);
    const role = roleOf(r.Role) ?? roleOf(r.IngameRole);
    const teamPage = asString(r.Team);
    if (!page || !role || !teamPage) continue;
    if (!byPage.has(page)) {
      warn(`player "${page}" appears in scoreboards but not on a roster; added from scoreboard data`);
      add(page, teamPage, role, true);
    }
  }
  const playerIdByPage = new Map(Array.from(byPage, ([page, p]) => [page, p.id]));
  return { players: Array.from(byPage.values()).sort((a, b) => a.id.localeCompare(b.id)), playerIdByPage };
}

interface GameBuild {
  game: Game;
  draft: Draft | null;
  playerGames: PlayerGame[];
}

function buildSeries(raw: Raw, teamIdByPage: Map<string, string>, now: Date): Series[] {
  const playedBySeries = new Map<string, number>();
  for (const r of raw.scheduleGames) {
    const matchId = asString(r.MatchId);
    if (matchId && asInt(r.Winner)) playedBySeries.set(matchId, (playedBySeries.get(matchId) ?? 0) + 1);
  }
  const out: Series[] = [];
  for (const r of raw.schedule) {
    const matchId = asString(r.MatchId);
    const page = asString(r.OverviewPage) ?? "";
    if (!matchId) continue;
    if (asBool(r.IsNullified)) {
      warn(`series ${matchId} is nullified on Leaguepedia; skipped`);
      continue;
    }
    const tab = asString(r.Tab);
    const st = stageFromTab(page, tab);
    if (!st) {
      warn(`series ${matchId} has unknown tab "${tab}"; skipped`);
      continue;
    }
    const dateTimeUtc = toIso(asString(r.DateTimeUTC));
    if (!dateTimeUtc) {
      warn(`series ${matchId} has no date; skipped`);
      continue;
    }
    const teamId = (v: unknown) => {
      const p = asString(v);
      if (!p || p === "TBD") return null;
      const id = teamIdByPage.get(p);
      if (!id) warn(`series ${matchId}: unknown team "${p}"`);
      return id ?? null;
    };
    const team1Id = teamId(r.Team1);
    const team2Id = teamId(r.Team2);
    const s1 = asInt(r.Team1Score);
    const s2 = asInt(r.Team2Score);
    const winner = asInt(r.Winner);
    const winnerId = winner === 1 ? team1Id : winner === 2 ? team2Id : null;
    const start = Date.parse(dateTimeUtc);
    let status: SeriesStatus = "scheduled";
    if (winner) status = "finished";
    else if (start <= now.getTime() && start > now.getTime() - LIVE_WINDOW_MS) status = "live";
    else if (start <= now.getTime()) {
      status = "live";
      warn(`series ${matchId} started ${dateTimeUtc} but has no winner yet`);
    }
    const mvp = asString(r.MVP);
    out.push({
      id: idFromCargoKey(matchId),
      matchId,
      stage: st.stage,
      tab: tab ?? "",
      round: st.round,
      bestOf: asInt(r.BestOf) ?? 1,
      team1Id,
      team2Id,
      dateTimeUtc,
      hasTime: asBool(r.HasTime),
      score: s1 !== null && s2 !== null ? { team1: s1, team2: s2 } : null,
      winnerId,
      status,
      matchDay: asInt(r.MatchDay),
      patch: unprefix(r.PatchV),
      streamUrl: asString(r.Stream),
      mvp: mvp && mvp !== "N/A" ? decodeEntities(mvp) : null,
      gameIds: [],
      gamesPlayed: playedBySeries.get(matchId) ?? (s1 !== null && s2 !== null ? s1 + s2 : 0),
      source: "leaguepedia",
      provisional: false,
      lolesportsMatchId: null,
    });
  }
  out.sort((a, b) => a.dateTimeUtc.localeCompare(b.dateTimeUtc) || a.id.localeCompare(b.id));
  return out;
}

function buildGames(
  raw: Raw,
  series: Series[],
  teamIdByPage: Map<string, string>,
  playerIdByPage: Map<string, string>,
): { builds: GameBuild[]; pending: string[] } {
  const seriesByMatchId = new Map(series.map((s) => [s.matchId, s]));
  const scheduleGameById = new Map(raw.scheduleGames.map((r) => [asString(r.GameId) ?? "", r]));
  const draftByGameId = new Map(raw.drafts.map((r) => [asString(r.GameId) ?? "", r]));
  const playersByGameId = new Map<string, CargoRow[]>();
  for (const r of raw.players) {
    const gid = asString(r.GameId);
    if (gid) (playersByGameId.get(gid) ?? playersByGameId.set(gid, []).get(gid)!).push(r);
  }

  const builds: GameBuild[] = [];
  const pending: string[] = [];
  for (const r of raw.games) {
    const cargoGameId = asString(r.GameId);
    const matchId = asString(r.MatchId);
    if (!cargoGameId || !matchId) continue;
    const s = seriesByMatchId.get(matchId);
    const id = idFromCargoKey(cargoGameId);
    const fail = (reason: string) => {
      warn(`game ${cargoGameId} left pending: ${reason}`);
      pending.push(id);
    };
    if (!s) {
      fail("no matching series in MatchSchedule");
      continue;
    }
    const bluePage = asString(r.Team1);
    const redPage = asString(r.Team2);
    const blueId = bluePage ? teamIdByPage.get(bluePage) : undefined;
    const redId = redPage ? teamIdByPage.get(redPage) : undefined;
    if (!blueId || !redId) {
      fail(`unknown teams ${bluePage} / ${redPage}`);
      continue;
    }
    const sched = scheduleGameById.get(cargoGameId);
    if (sched && asString(sched.Blue) && asString(sched.Blue) !== bluePage) {
      warn(
        `game ${cargoGameId}: ScoreboardGames.Team1 (${bluePage}) differs from MatchScheduleGame.Blue (${asString(sched.Blue)}); using ScoreboardGames`,
      );
    }
    const durationSeconds = parseGamelength(asString(r.Gamelength), asNumber(r.GamelengthNumber));
    if (!durationSeconds || durationSeconds <= 0) {
      fail("missing or zero game length");
      continue;
    }
    const winner = asInt(r.Winner);
    if (winner !== 1 && winner !== 2) {
      fail("no winner recorded");
      continue;
    }
    const teamStats = (n: 1 | 2, teamId: string): GameTeamStats => ({
      teamId,
      kills: asInt(r[`Team${n}Kills`]) ?? 0,
      gold: asNumber(r[`Team${n}Gold`]) ?? 0,
      towers: asInt(r[`Team${n}Towers`]) ?? 0,
      inhibitors: asInt(r[`Team${n}Inhibitors`]) ?? 0,
      dragons: asInt(r[`Team${n}Dragons`]) ?? 0,
      elders: asInt(r[`Team${n}Elders`]) ?? 0,
      barons: asInt(r[`Team${n}Barons`]) ?? 0,
      heralds: asInt(r[`Team${n}RiftHeralds`]) ?? 0,
      voidGrubs: asInt(r[`Team${n}VoidGrubs`]) ?? 0,
      bans: asList(r[`Team${n}Bans`]),
      picks: asList(r[`Team${n}Picks`]),
      lineup: null,
    });
    const game: Game = {
      id,
      seriesId: s.id,
      stage: s.stage,
      gameNumber: asInt(r.NGameInMatch) ?? 1,
      dateTimeUtc: toIso(asString(r.DateTimeUTC)),
      durationSeconds,
      patch: unprefix(r.PatchV),
      winnerSide: winner === 1 ? "blue" : "red",
      winnerTeamId: winner === 1 ? blueId : redId,
      blue: teamStats(1, blueId),
      red: teamStats(2, redId),
      riotGameId: asString(r.RiotPlatformGameId),
      vodUrl: asString(r.VOD) ?? asString(sched?.Vod) ?? null,
      source: "leaguepedia",
      provisional: false,
      statsComplete: true,
    };

    // Player rows + validation.
    const rows = playersByGameId.get(cargoGameId) ?? [];
    if (rows.length !== 10) {
      fail(`expected 10 player rows, found ${rows.length}`);
      continue;
    }
    const pgs: PlayerGame[] = [];
    let ok = true;
    for (const pr of rows) {
      const page = asString(pr.Link);
      const playerId = page ? playerIdByPage.get(page) : undefined;
      const teamPage = asString(pr.Team);
      const teamId = teamPage ? teamIdByPage.get(teamPage) : undefined;
      const oppPage = asString(pr.TeamVs);
      const opponentTeamId = oppPage ? teamIdByPage.get(oppPage) : undefined;
      const role = roleOf(pr.Role) ?? roleOf(pr.IngameRole);
      const champion = asString(pr.Champion);
      const sideNum = asInt(pr.Side);
      if (!playerId || !teamId || !opponentTeamId || !role || !champion || (sideNum !== 1 && sideNum !== 2)) {
        fail(
          `player row ${page ?? "?"} is incomplete (team ${teamPage}, role ${asString(pr.Role)}, champion ${champion}, side ${sideNum})`,
        );
        ok = false;
        break;
      }
      const side = sideNum === 1 ? "blue" : "red";
      if ((side === "blue" && teamId !== blueId) || (side === "red" && teamId !== redId)) {
        fail(`player row ${page} side/team mismatch`);
        ok = false;
        break;
      }
      pgs.push({
        gameId: id,
        seriesId: s.id,
        stage: s.stage,
        playerId,
        teamId,
        opponentTeamId,
        role,
        champion,
        side,
        win: asBool(pr.PlayerWin),
        kills: asInt(pr.Kills) ?? 0,
        deaths: asInt(pr.Deaths) ?? 0,
        assists: asInt(pr.Assists) ?? 0,
        gold: asNumber(pr.Gold) ?? 0,
        cs: asInt(pr.CS) ?? 0,
        damageToChampions: asNumber(pr.DamageToChampions) ?? 0,
        visionScore: asNumber(pr.VisionScore) ?? 0,
        teamKills: asInt(pr.TeamKills) ?? 0,
        teamGold: asNumber(pr.TeamGold) ?? 0,
        teamDamage: 0,
        durationSeconds,
        items: asList(pr.Items),
        trinket: asString(pr.Trinket),
        keystone: asString(pr.KeystoneRune),
        primaryTree: asString(pr.PrimaryTree),
        secondaryTree: asString(pr.SecondaryTree),
        runes: asList(pr.Runes),
        summonerSpells: asList(pr.SummonerSpells),
        pentakills: asInt(pr.Pentakills) ?? 0,
      });
    }
    if (!ok) continue;
    const bluePgs = pgs.filter((p) => p.side === "blue");
    const redPgs = pgs.filter((p) => p.side === "red");
    if (bluePgs.length !== 5 || redPgs.length !== 5) {
      fail(`expected 5 players per side, found ${bluePgs.length}/${redPgs.length}`);
      continue;
    }
    const sum = (list: PlayerGame[], k: "kills" | "damageToChampions") => list.reduce((a, p) => a + p[k], 0);
    if (sum(bluePgs, "kills") !== game.blue.kills || sum(redPgs, "kills") !== game.red.kills) {
      fail(
        `kills do not add up (players ${sum(bluePgs, "kills")}/${sum(redPgs, "kills")} vs game ${game.blue.kills}/${game.red.kills})`,
      );
      continue;
    }
    const blueDamage = sum(bluePgs, "damageToChampions");
    const redDamage = sum(redPgs, "damageToChampions");
    for (const p of pgs) p.teamDamage = p.side === "blue" ? blueDamage : redDamage;
    if (new Set(bluePgs.map((p) => p.role)).size !== 5 || new Set(redPgs.map((p) => p.role)).size !== 5) {
      warn(`game ${cargoGameId}: roles are not unique per side`);
    }

    // Draft (optional: a game can be complete without a filled pick/ban row).
    let draft: Draft | null = null;
    const d = draftByGameId.get(cargoGameId);
    if (d && asBool(d.IsFilled)) {
      const switched = asBool(d.SwitchedSides);
      const blueN = switched ? 2 : 1;
      const redN = switched ? 1 : 2;
      const sideOf = (n: 1 | 2) => ({
        bans: asSlots(
          [1, 2, 3, 4, 5].map((i) => d[`Team${n}Ban${i}`] ?? ""),
          5,
        ),
        picks: asSlots(
          [1, 2, 3, 4, 5].map((i) => d[`Team${n}Pick${i}`] ?? ""),
          5,
        ),
        picksByRole: asSlots(d[`Team${n}PicksByRoleOrder`], 5),
      });
      const draftBluePage = asString(d[`Team${blueN}`]);
      if (draftBluePage && draftBluePage !== bluePage) {
        warn(
          `game ${cargoGameId}: PicksAndBansS7 blue team (${draftBluePage}) differs from scoreboard (${bluePage}); draft skipped`,
        );
      } else {
        draft = {
          gameId: id,
          blue: sideOf(blueN as 1 | 2),
          red: sideOf(redN as 1 | 2),
          complete: asBool(d.IsComplete),
        };
      }
    }
    builds.push({ game, draft, playerGames: pgs });
  }
  builds.sort(
    (a, b) =>
      (a.game.dateTimeUtc ?? "").localeCompare(b.game.dateTimeUtc ?? "") || a.game.gameNumber - b.game.gameNumber,
  );
  return { builds, pending };
}

function buildTournament(raw: Raw, series: Series[], patch: string | null, ddragonVersion: string): Tournament {
  const rows = new Map(raw.tournaments.map((r) => [asString(r.OverviewPage) ?? "", r]));
  const main = rows.get(TOURNAMENT.overviewPage) ?? rows.get(TOURNAMENT.stagePages.main);
  if (!main) throw new Error(`Tournaments row for ${TOURNAMENT.overviewPage} not found`);
  const allDates = Array.from(rows.values())
    .flatMap((r) => [asString(r.DateStart), asString(r.Date)])
    .filter((d): d is string => !!d);
  const stages: TournamentStage[] = STAGE_ORDER.map((id) => {
    const list = series.filter((s) => s.stage === id);
    const dates = list.map((s) => s.dateTimeUtc.slice(0, 10)).sort();
    return {
      id,
      name: STAGE_META[id].name,
      overviewPage: STAGE_META[id].page,
      dateStart: dates[0] ?? null,
      dateEnd: dates[dates.length - 1] ?? null,
      bestOf: Array.from(new Set(list.map((s) => s.bestOf))).sort((a, b) => a - b),
      seriesCount: list.length,
    };
  }).filter((s) => s.seriesCount > 0);
  const links = asString(main.Links);
  return {
    id: TOURNAMENT.id,
    name: decodeEntities(asString(main.Name) ?? TOURNAMENT.id),
    overviewPage: TOURNAMENT.overviewPage,
    dateStart: asString(main.DateStart) ?? allDates.sort()[0],
    dateEnd: asString(main.Date) ?? allDates.sort()[allDates.length - 1],
    country: asString(main.Country),
    patch,
    ddragonVersion,
    officialUrl: links && /^https?:\/\//.test(links) ? links.split(/[,\s]+/)[0] : null,
    stages,
  };
}

/* ------------------------------------------------------------------ output */

type Outputs = Record<keyof typeof datasetFiles | "conflicts.json", unknown>;

/** Attaches data/seeds.json (hand-kept: Cargo has no seeds) to the teams; unknown ids only warn. */
async function applySeeds(teams: Team[]): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.resolve(process.cwd(), "data/seeds.json"), "utf8"));
  } catch {
    warn("data/seeds.json not found or invalid JSON; teams have no seeds");
    return;
  }
  const parsed = seedsFileSchema.safeParse(raw);
  if (!parsed.success) {
    warn(`data/seeds.json failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}; teams have no seeds`);
    return;
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  for (const s of parsed.data.seeds) {
    const team = byId.get(s.teamId);
    if (!team) {
      warn(`data/seeds.json: unknown team id "${s.teamId}"`);
      continue;
    }
    team.seed = { league: s.league, seed: s.seed, pool: s.pool, stage: s.stage, path: s.path };
  }
  const missing = teams.filter((t) => !t.seed).map((t) => t.id);
  if (missing.length) warn(`teams without seed: ${missing.join(", ")}`);
}

/** Provisional series results from lolesports; fails soft so Leaguepedia data is never blocked by it. */
async function fetchLolesports(
  series: Series[],
): Promise<{ enabled: boolean; fetchedAt: string | null; error: string | null; matches: LolesportsMatch[] | null }> {
  const apiKey = process.env.LOLESPORTS_API_KEY;
  if (!apiKey) {
    log("LOLESPORTS_API_KEY not set; provisional results from lolesports skipped");
    return { enabled: false, fetchedAt: null, error: null, matches: null };
  }
  const dates = series.map((s) => s.dateTimeUtc).sort();
  const dayMs = 24 * 3600 * 1000;
  const since = new Date(Date.parse(dates[0] ?? new Date().toISOString()) - dayMs).toISOString();
  const until = new Date(Date.parse(dates[dates.length - 1] ?? new Date().toISOString()) + 2 * dayMs).toISOString();
  const client = new LolesportsClient({ apiKey, log });
  try {
    const leagueId = await fetchLeagueId(client, LOLESPORTS_LEAGUE_SLUG);
    const matches = await fetchSchedule(client, leagueId, { since, until });
    log(
      `lolesports: ${matches.length} matches between ${since.slice(0, 10)} and ${until.slice(0, 10)} (${client.requestCount} requests)`,
    );
    return { enabled: true, fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), error: null, matches };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`lolesports unavailable (${message}); continuing without provisional results`);
    return { enabled: true, fetchedAt: null, error: message, matches: null };
  }
}

async function readExisting(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, file), "utf8"));
  } catch {
    return null;
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

async function main(): Promise<void> {
  const started = Date.now();
  const now = new Date();
  const transport = (process.env.LEAGUEPEDIA_TRANSPORT as Transport | undefined) ?? "export";
  const credentials =
    process.env.LEAGUEPEDIA_BOT_USER && process.env.LEAGUEPEDIA_BOT_PASSWORD
      ? { username: process.env.LEAGUEPEDIA_BOT_USER, password: process.env.LEAGUEPEDIA_BOT_PASSWORD }
      : null;
  if (credentials && transport !== "api")
    warn("bot credentials are set but LEAGUEPEDIA_TRANSPORT is not 'api'; they are ignored");
  const client = new LeaguepediaClient({
    transport,
    credentials,
    delayMs: process.env.LEAGUEPEDIA_DELAY_MS ? Number(process.env.LEAGUEPEDIA_DELAY_MS) : undefined,
    userAgent: process.env.INGEST_USER_AGENT,
    log,
  });
  log(`tournament ${TOURNAMENT.id} · transport ${transport} · out ${path.relative(process.cwd(), OUT_DIR)}`);

  const raw = await fetchAll(client);
  log(
    `fetched: tournaments ${raw.tournaments.length}, schedule ${raw.schedule.length}, scheduleGames ${raw.scheduleGames.length}, games ${raw.games.length}, playerRows ${raw.players.length}, drafts ${raw.drafts.length}, rosters ${raw.rosters.length}, tournamentPlayers ${raw.tournamentPlayers.length}, teams ${raw.teams.length}, players ${raw.playerRows.length} (${client.requestCount} requests)`,
  );

  const { teams, teamIdByPage } = buildTeams(raw);
  await applySeeds(teams);
  const { players, playerIdByPage } = buildPlayers(raw, teams, teamIdByPage);
  const series = buildSeries(raw, teamIdByPage, now);
  const { builds, pending } = buildGames(raw, series, teamIdByPage, playerIdByPage);

  const seriesById = new Map(series.map((s) => [s.id, s]));
  for (const b of builds) seriesById.get(b.game.seriesId)?.gameIds.push(b.game.id);
  for (const s of series) {
    const byNumber = new Map(builds.filter((b) => b.game.seriesId === s.id).map((b) => [b.game.id, b.game.gameNumber]));
    s.gameIds.sort((a, b) => (byNumber.get(a) ?? 0) - (byNumber.get(b) ?? 0));
    if (s.gamesPlayed < s.gameIds.length) s.gamesPlayed = s.gameIds.length;
  }

  // Patch: most common patch across games, else the schedule's.
  const patchCounts = new Map<string, number>();
  for (const b of builds) if (b.game.patch) patchCounts.set(b.game.patch, (patchCounts.get(b.game.patch) ?? 0) + 1);
  for (const s of series) if (s.patch && patchCounts.size === 0) patchCounts.set(s.patch, 1);
  const patch = Array.from(patchCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  log(`resolving Data Dragon version for patch ${patch ?? "unknown"}`);
  const versions = await fetchDdragonVersions();
  const ddragonVersion = pickDdragonVersion(versions, patch);
  const champions: ChampionIndex = await fetchChampionIndex(ddragonVersion);
  const known = new Set(champions.champions.map((c) => normalizeChampionName(c.name)));
  const unresolved = new Set<string>();
  for (const b of builds) {
    for (const name of [...b.game.blue.picks, ...b.game.red.picks, ...b.game.blue.bans, ...b.game.red.bans]) {
      if (!known.has(normalizeChampionName(name))) unresolved.add(name);
    }
  }
  if (unresolved.size)
    warn(`champions not found in Data Dragon ${ddragonVersion}: ${Array.from(unresolved).join(", ")}`);

  // Provisional sources: manual files and the lolesports schedule, merged by priority.
  const manual = await loadManualDir(MANUAL_DIR);
  log(`manual files: ${manual.entries.length} valid, ${manual.invalid.length} invalid`);
  for (const { file, error } of manual.invalid) warn(`manual file ${file} ignored: ${error}`);
  const lolesports = await fetchLolesports(series);
  const canonicalChampion = new Map(champions.champions.map((c) => [normalizeChampionName(c.name), c.name]));
  const merged = mergeSources({
    series,
    games: builds.map((b) => b.game),
    drafts: builds.flatMap((b) => (b.draft ? [b.draft] : [])),
    teams,
    players,
    manual: manual.entries,
    lolesports: lolesports.matches,
    resolveChampion: (name) => canonicalChampion.get(normalizeChampionName(name)) ?? null,
  });
  for (const w of merged.warnings) warn(w);
  for (const { file, error } of merged.manual.invalid) warn(`manual file ${file} ignored: ${error}`);
  log(
    `merged: ${merged.manual.applied.length} manual games applied, ${merged.manual.superseded.length} superseded, ${merged.lolesports.matchedSeries} series matched on lolesports (${merged.lolesports.unmatchedEvents} unmatched), ${merged.provisional.seriesIds.length} provisional series, ${merged.provisional.gameIds.length} provisional games, ${merged.conflicts.length} conflicts`,
  );

  const tournament = buildTournament(raw, merged.series, patch, ddragonVersion);
  const games = merged.games;
  const drafts = merged.drafts;
  const playerGames = builds.flatMap((b) => b.playerGames);

  const meta: Meta = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    tournamentId: TOURNAMENT.id,
    source: { ...SOURCE, transport },
    ddragonVersion,
    counts: {
      teams: teams.length,
      players: players.length,
      series: series.length,
      games: games.length,
      playerGames: playerGames.length,
      drafts: drafts.length,
    },
    pendingGameIds: pending,
    warnings,
    sources: {
      lolesports: {
        enabled: lolesports.enabled,
        fetchedAt: lolesports.fetchedAt,
        matchedSeries: merged.lolesports.matchedSeries,
        unmatchedEvents: merged.lolesports.unmatchedEvents,
        error: lolesports.error,
      },
      manual: {
        applied: merged.manual.applied,
        superseded: merged.manual.superseded,
        invalid: [...manual.invalid, ...merged.manual.invalid],
      },
    },
    provisional: merged.provisional,
    conflicts: merged.conflicts.length,
  };

  const outputs: Outputs = {
    "meta.json": meta,
    "tournament.json": tournament,
    "teams.json": teams,
    "players.json": players,
    "series.json": merged.series,
    "games.json": games,
    "drafts.json": drafts,
    "player-games.json": playerGames,
    "champions.json": champions,
    "conflicts.json": merged.conflicts,
  };

  // Validate everything before touching the disk.
  for (const [file, schema] of Object.entries(datasetFiles)) {
    const result = schema.safeParse(outputs[file as keyof Outputs]);
    if (!result.success) {
      throw new Error(
        `${file} failed schema validation:\n${result.error.issues
          .slice(0, 10)
          .map((i) => `  ${i.path.join(".")}: ${i.message}`)
          .join("\n")}`,
      );
    }
  }

  // Change detection: ignore meta timestamps/warnings so an unchanged tournament produces no commit.
  const existingMeta = (await readExisting("meta.json")) as Meta | null;
  let changed = FORCE || !existingMeta;
  if (!changed) {
    for (const file of Object.keys(outputs) as (keyof Outputs)[]) {
      if (file === "meta.json") continue;
      const prev = await readExisting(file);
      if (stableJson(prev) !== stableJson(outputs[file])) {
        changed = true;
        log(`change detected in ${file}`);
        break;
      }
    }
  }
  const staleMs = existingMeta ? now.getTime() - Date.parse(existingMeta.updatedAt) : Infinity;
  if (!changed && staleMs < MAX_STALE_HOURS * 3600 * 1000) {
    log(
      `no data changes (last update ${Math.round(staleMs / 60000)} min ago); nothing written · ${Math.round((Date.now() - started) / 1000)}s`,
    );
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const [file, value] of Object.entries(outputs)) {
    await writeFile(path.join(OUT_DIR, file), stableJson(value), "utf8");
  }
  log(
    `wrote ${Object.keys(outputs).length} files: ${meta.counts.series} series, ${meta.counts.games} games (${pending.length} pending), ${meta.counts.playerGames} player rows, ${meta.counts.teams} teams, ${meta.counts.players} players · ddragon ${ddragonVersion} · ${warnings.length} warnings · ${Math.round((Date.now() - started) / 1000)}s`,
  );
}

main().catch((err: unknown) => {
  if (err instanceof RateLimitError) {
    console.error(`[ingest] aborted: ${err.message}. Existing data left untouched.`);
    process.exit(2);
  }
  console.error("[ingest] failed:", err);
  process.exit(1);
});
