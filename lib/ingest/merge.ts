/**
 * Merges the three result sources into one dataset, field by field and by
 * priority: Leaguepedia (validated) > manual files > lolesports.
 *
 * - Leaguepedia games and series are final. Nothing overrides them; a lower
 *   source that disagrees only produces a conflict entry for review.
 * - Manual files add provisional games (winner, duration, draft, optional team
 *   objectives and player lines) and derive the series score from them.
 * - lolesports adds provisional series results (live, score, winner) and fills
 *   TBD pairings; it never produces games.
 *
 * Pure: no I/O, so it is unit-tested with fixtures.
 */
import { slugify } from "../data/ids";
import type { DataSource, Draft, Game, GameTeamStats, LineupEntry, Player, Role, Series, Team } from "../data/types";
import type { LolesportsMatch, LolesportsTeam } from "../sources/lolesports";
import { parseDuration, type ManualEntry } from "../sources/manual";

export interface Conflict {
  seriesId: string;
  gameId: string | null;
  field: string;
  values: Partial<Record<DataSource, string>>;
  resolvedWith: DataSource;
}

export interface MergeInput {
  series: Series[];
  games: Game[];
  drafts: Draft[];
  teams: Team[];
  players: Player[];
  manual: ManualEntry[];
  /** null when the API was not queried (no key) or failed. */
  lolesports: LolesportsMatch[] | null;
  /** Returns the canonical Data Dragon name, or null when unknown. */
  resolveChampion: (name: string) => string | null;
}

export interface MergeResult {
  series: Series[];
  games: Game[];
  drafts: Draft[];
  conflicts: Conflict[];
  warnings: string[];
  manual: { applied: string[]; superseded: string[]; invalid: { file: string; error: string }[] };
  lolesports: { matchedSeries: number; unmatchedEvents: number };
  provisional: { seriesIds: string[]; gameIds: string[] };
}

const ROLES: Role[] = ["top", "jungle", "mid", "bot", "support"];
const MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

/** "Team Liquid Alienware" → "teamliquidalienware", "LØS" → "los". */
const key = (s: string): string => slugify(s).replace(/-/g, "");

/** Whether a lolesports team entry refers to one of our teams (code, exact name or name containment). */
export function teamMatches(team: Team, lol: Pick<LolesportsTeam, "name" | "code">): boolean {
  const code = key(lol.code);
  const name = key(lol.name);
  if (!name || name === "tbd") return false;
  const short = key(team.short);
  const ours = key(team.name);
  if (code && code === short) return true;
  if (name === ours) return true;
  if (ours.length >= 4 && name.includes(ours)) return true;
  if (name.length >= 4 && ours.includes(name)) return true;
  return false;
}

const winTarget = (bestOf: number): number => Math.floor(bestOf / 2) + 1;
const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));
const roundFromId = (id: string): number | null => {
  const m = /-round-(\d+)-/.exec(id);
  return m ? Number(m[1]) : null;
};

export function mergeSources(input: MergeInput): MergeResult {
  const warnings: string[] = [];
  const conflicts: Conflict[] = [];
  const teamsById = new Map(input.teams.map((t) => [t.id, t]));
  const findTeam = (ref: string): Team | null => {
    const k = key(ref);
    return (
      teamsById.get(ref) ?? input.teams.find((t) => key(t.id) === k || key(t.short) === k || key(t.name) === k) ?? null
    );
  };
  const playersByTeam = new Map<string, Player[]>();
  for (const p of input.players)
    (playersByTeam.get(p.teamId) ?? playersByTeam.set(p.teamId, []).get(p.teamId)!).push(p);
  const findPlayer = (teamId: string, ref: string): Player | null => {
    const k = key(ref);
    const list = playersByTeam.get(teamId) ?? [];
    return list.find((p) => p.id === ref) ?? list.find((p) => key(p.id) === k || key(p.name) === k) ?? null;
  };

  const series: Series[] = input.series.map((s) => ({
    ...s,
    gameIds: [...s.gameIds],
    source: "leaguepedia",
    provisional: false,
    lolesportsMatchId: null,
  }));
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const lpFinished = new Set(series.filter((s) => s.winnerId).map((s) => s.id));
  const games: Game[] = input.games.map((g) => ({
    ...g,
    source: "leaguepedia",
    provisional: false,
    statsComplete: true,
  }));
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const drafts: Draft[] = [...input.drafts];
  const applied: string[] = [];
  const superseded: string[] = [];
  const invalid: { file: string; error: string }[] = [];

  const champion = (name: string, file: string): string => {
    const canonical = input.resolveChampion(name);
    if (canonical) return canonical;
    warnings.push(`${file}: champion "${name}" not found in Data Dragon; kept as written`);
    return name.trim();
  };

  /* ---------------------------------------------------------------- manual */
  const touchedSeries = new Set<string>();
  for (const { file, data: d } of input.manual) {
    const reject = (error: string) => invalid.push({ file, error });
    const blue = findTeam(d.blue);
    const red = findTeam(d.red);
    if (!blue || !red) {
      reject(`unknown team "${!blue ? d.blue : d.red}" (use the id from the site URL or the team tag)`);
      continue;
    }
    const winner = findTeam(d.winner);
    if (!winner || (winner.id !== blue.id && winner.id !== red.id)) {
      reject(`winner "${d.winner}" is not the blue or the red team`);
      continue;
    }
    let s = seriesById.get(d.series);
    if (!s) {
      if (!d.stage || !d.date || !d.bestOf || !d.teams) {
        reject(`series "${d.series}" is not in the dataset; the file must include stage, date, bestOf and teams`);
        continue;
      }
      const t1 = findTeam(d.teams.team1);
      const t2 = findTeam(d.teams.team2);
      if (!t1 || !t2) {
        reject(`unknown team in teams: "${!t1 ? d.teams.team1 : d.teams.team2}"`);
        continue;
      }
      s = {
        id: d.series,
        matchId: `manual:${d.series}`,
        stage: d.stage,
        tab: "",
        round: roundFromId(d.series),
        bestOf: d.bestOf,
        team1Id: t1.id,
        team2Id: t2.id,
        dateTimeUtc: d.date,
        hasTime: true,
        score: null,
        winnerId: null,
        status: "scheduled",
        matchDay: null,
        patch: d.patch ?? null,
        streamUrl: null,
        mvp: null,
        gameIds: [],
        gamesPlayed: 0,
        source: "manual",
        provisional: true,
        lolesportsMatchId: null,
      };
      series.push(s);
      seriesById.set(s.id, s);
      warnings.push(`${file}: series ${s.id} created from the manual file (not on Leaguepedia yet)`);
    } else if (!s.team1Id && !s.team2Id) {
      const t1 = d.teams ? findTeam(d.teams.team1) : null;
      const t2 = d.teams ? findTeam(d.teams.team2) : null;
      s.team1Id = t1?.id ?? blue.id;
      s.team2Id = t2?.id ?? red.id;
      warnings.push(`${file}: series ${s.id} had no teams on Leaguepedia; set to ${s.team1Id} vs ${s.team2Id}`);
    }
    const seriesTeams = new Set([s.team1Id, s.team2Id]);
    if (!seriesTeams.has(blue.id) || !seriesTeams.has(red.id)) {
      reject(`${blue.id} vs ${red.id} are not the teams of series ${s.id} (${s.team1Id} vs ${s.team2Id})`);
      continue;
    }

    const gameId = `${s.id}-${d.game}`;
    const duration = parseDuration(d.duration);
    const picks = { blue: d.picks.blue.map((c) => champion(c, file)), red: d.picks.red.map((c) => champion(c, file)) };
    const bans = {
      blue: (d.bans?.blue ?? []).map((c) => champion(c, file)),
      red: (d.bans?.red ?? []).map((c) => champion(c, file)),
    };

    const existing = gamesById.get(gameId);
    if (existing && existing.source === "leaguepedia") {
      superseded.push(file);
      const conflict = (field: string, lp: string, manual: string) =>
        conflicts.push({
          seriesId: s.id,
          gameId,
          field,
          values: { leaguepedia: lp, manual },
          resolvedWith: "leaguepedia",
        });
      if (existing.winnerTeamId !== winner.id) conflict("winner", existing.winnerTeamId, winner.id);
      if (Math.abs(existing.durationSeconds - duration) > 90)
        conflict("duration", String(existing.durationSeconds), String(duration));
      if (!sameSet(existing.blue.picks, picks.blue) || !sameSet(existing.red.picks, picks.red)) {
        conflict(
          "picks",
          `${existing.blue.picks.join(",")} / ${existing.red.picks.join(",")}`,
          `${picks.blue.join(",")} / ${picks.red.join(",")}`,
        );
      }
      if (d.bans && (!sameSet(existing.blue.bans, bans.blue) || !sameSet(existing.red.bans, bans.red))) {
        conflict(
          "bans",
          `${existing.blue.bans.join(",")} / ${existing.red.bans.join(",")}`,
          `${bans.blue.join(",")} / ${bans.red.join(",")}`,
        );
      }
      continue;
    }
    if (existing) {
      reject(`game ${gameId} was already provided by another manual file`);
      continue;
    }

    const lineup = (side: "blue" | "red", team: Team): LineupEntry[] | null => {
      const lines = d.players?.[side];
      if (!lines) return null;
      return lines.map((line) => {
        const player = findPlayer(team.id, line.player);
        if (!player) warnings.push(`${file}: player "${line.player}" not found on ${team.id}; kept by name`);
        return {
          playerId: player?.id ?? null,
          name: player?.name ?? line.player,
          role: line.role,
          champion: picks[side][ROLES.indexOf(line.role)] ?? "",
          kills: line.kills ?? null,
          deaths: line.deaths ?? null,
          assists: line.assists ?? null,
        };
      });
    };
    const stats = (side: "blue" | "red", team: Team): GameTeamStats => {
      const o = d.objectives?.[side];
      const lines = lineup(side, team);
      const killsFromLines = lines?.every((l) => l.kills !== null)
        ? lines.reduce((a, l) => a + (l.kills ?? 0), 0)
        : null;
      return {
        teamId: team.id,
        kills: o?.kills ?? killsFromLines ?? 0,
        gold: o?.gold ?? 0,
        towers: o?.towers ?? 0,
        inhibitors: o?.inhibitors ?? 0,
        dragons: o?.dragons ?? 0,
        elders: o?.elders ?? 0,
        barons: o?.barons ?? 0,
        heralds: o?.heralds ?? 0,
        voidGrubs: o?.voidGrubs ?? 0,
        bans: bans[side],
        picks: picks[side],
        lineup: lines,
      };
    };
    const game: Game = {
      id: gameId,
      seriesId: s.id,
      stage: s.stage,
      gameNumber: d.game,
      dateTimeUtc: null,
      durationSeconds: duration,
      patch: d.patch ?? s.patch,
      winnerSide: winner.id === blue.id ? "blue" : "red",
      winnerTeamId: winner.id,
      blue: stats("blue", blue),
      red: stats("red", red),
      riotGameId: null,
      vodUrl: d.vod ?? null,
      source: "manual",
      provisional: true,
      statsComplete: Boolean(d.objectives?.blue && d.objectives?.red),
    };
    games.push(game);
    gamesById.set(gameId, game);
    const pad = (list: string[]): (string | null)[] => [...list, null, null, null, null, null].slice(0, 5);
    drafts.push({
      gameId,
      blue: { bans: pad(bans.blue), picks: picks.blue, picksByRole: picks.blue },
      red: { bans: pad(bans.red), picks: picks.red, picksByRole: picks.red },
      complete: bans.blue.length === 5 && bans.red.length === 5,
    });
    applied.push(file);
    touchedSeries.add(s.id);
  }

  // Series results derived from games when Leaguepedia has not closed the series.
  for (const sid of touchedSeries) {
    const s = seriesById.get(sid)!;
    const all = games.filter((g) => g.seriesId === sid).sort((a, b) => a.gameNumber - b.gameNumber);
    s.gameIds = all.map((g) => g.id);
    s.gamesPlayed = Math.max(s.gamesPlayed, all.length);
    const wins1 = all.filter((g) => g.winnerTeamId === s.team1Id).length;
    const wins2 = all.filter((g) => g.winnerTeamId === s.team2Id).length;
    const derivedWinner = wins1 >= winTarget(s.bestOf) ? s.team1Id : wins2 >= winTarget(s.bestOf) ? s.team2Id : null;
    const lpPlayed = s.score ? s.score.team1 + s.score.team2 : 0;
    if (lpFinished.has(sid)) {
      if (s.score && all.length >= lpPlayed && (s.score.team1 !== wins1 || s.score.team2 !== wins2)) {
        conflicts.push({
          seriesId: sid,
          gameId: null,
          field: "score",
          values: { leaguepedia: `${s.score.team1}-${s.score.team2}`, manual: `${wins1}-${wins2}` },
          resolvedWith: "leaguepedia",
        });
      }
      continue;
    }
    if (all.length >= lpPlayed) {
      s.score = { team1: wins1, team2: wins2 };
      s.winnerId = derivedWinner;
      s.status = derivedWinner ? "finished" : "live";
      s.source = "manual";
      s.provisional = true;
    }
  }

  /* ------------------------------------------------------------- lolesports */
  const lol = { matchedSeries: 0, unmatchedEvents: 0 };
  for (const m of input.lolesports ?? []) {
    if (!m.stage) continue;
    const known = m.teams.filter((t) => key(t.name) !== "tbd" && key(t.code) !== "tbd");
    const start = Date.parse(m.startTime);
    let candidates = series.filter(
      (s) => s.stage === m.stage && Math.abs(Date.parse(s.dateTimeUtc) - start) <= MATCH_WINDOW_MS,
    );
    if (known.length === 2) {
      const byTeams = candidates.filter((s) => {
        const a = s.team1Id ? teamsById.get(s.team1Id) : null;
        const b = s.team2Id ? teamsById.get(s.team2Id) : null;
        if (!a || !b) return false;
        return (
          (teamMatches(a, m.teams[0]) && teamMatches(b, m.teams[1])) ||
          (teamMatches(a, m.teams[1]) && teamMatches(b, m.teams[0]))
        );
      });
      candidates = byTeams.length
        ? byTeams
        : candidates.filter((s) => !s.team1Id && !s.team2Id && s.dateTimeUtc === m.startTime);
    } else {
      if (m.state === "unstarted") continue; // nothing to apply, nothing to match on
      candidates = candidates.filter((s) => !s.team1Id && !s.team2Id && s.dateTimeUtc === m.startTime);
    }
    if (candidates.length !== 1) {
      lol.unmatchedEvents += 1;
      if (m.state !== "unstarted" || known.length === 2) {
        warnings.push(
          `lolesports match ${m.id} (${m.teams.map((t) => t.code).join(" vs ")}, ${m.startTime}, ${m.block}) matched ${candidates.length} series`,
        );
      }
      continue;
    }
    const s = candidates[0];
    s.lolesportsMatchId = m.id;
    lol.matchedSeries += 1;
    if (!s.team1Id && !s.team2Id) {
      const a = input.teams.find((t) => teamMatches(t, m.teams[0]));
      const b = input.teams.find((t) => teamMatches(t, m.teams[1]));
      if (!a || !b || a.id === b.id) {
        warnings.push(
          `lolesports match ${m.id}: teams ${m.teams.map((t) => t.code).join(" vs ")} not found in the dataset`,
        );
        continue;
      }
      s.team1Id = a.id;
      s.team2Id = b.id;
      warnings.push(`series ${s.id}: teams ${a.id} vs ${b.id} taken from lolesports`);
    }
    const team1 = teamsById.get(s.team1Id!);
    const team2 = teamsById.get(s.team2Id!);
    const t1 = team1 ? m.teams.find((t) => teamMatches(team1, t)) : undefined;
    const t2 = team2 ? m.teams.find((t) => teamMatches(team2, t)) : undefined;
    if (!t1 || !t2 || t1 === t2) {
      warnings.push(
        `lolesports match ${m.id}: could not orient ${m.teams.map((t) => t.code).join(" vs ")} onto series ${s.id}`,
      );
      continue;
    }
    const lolScore = { team1: t1.gameWins, team2: t2.gameWins };
    const lolPlayed = lolScore.team1 + lolScore.team2;
    const lolWinner = t1.outcome === "win" ? s.team1Id : t2.outcome === "win" ? s.team2Id : null;
    const scoreText = (sc: { team1: number; team2: number } | null) => (sc ? `${sc.team1}-${sc.team2}` : "?");
    const differs = s.score !== null && (s.score.team1 !== lolScore.team1 || s.score.team2 !== lolScore.team2);

    if (lpFinished.has(s.id)) {
      if (m.state === "completed" && (lolWinner !== s.winnerId || differs)) {
        conflicts.push({
          seriesId: s.id,
          gameId: null,
          field: "result",
          values: {
            leaguepedia: `${s.winnerId} ${scoreText(s.score)}`,
            lolesports: `${lolWinner} ${scoreText(lolScore)}`,
          },
          resolvedWith: "leaguepedia",
        });
      }
      continue;
    }
    const knownPlayed = s.score ? s.score.team1 + s.score.team2 : 0;
    if (m.state === "completed") {
      if (s.source === "manual" && (s.status === "finished" || lolPlayed === knownPlayed)) {
        if (differs || (s.status === "finished" && lolWinner !== s.winnerId)) {
          conflicts.push({
            seriesId: s.id,
            gameId: null,
            field: "result",
            values: {
              manual: `${s.winnerId} ${scoreText(s.score)}`,
              lolesports: `${lolWinner} ${scoreText(lolScore)}`,
            },
            resolvedWith: "manual",
          });
        }
        continue;
      }
      if (lolPlayed >= knownPlayed) {
        s.score = lolScore;
        s.winnerId = lolWinner;
        s.status = lolWinner ? "finished" : s.status === "scheduled" ? "live" : s.status;
        s.gamesPlayed = Math.max(s.gamesPlayed, lolPlayed);
        s.source = "lolesports";
        s.provisional = true;
      }
    } else if (m.state === "inProgress") {
      if (s.status !== "finished") {
        s.status = "live";
        if (lolPlayed > knownPlayed) {
          s.score = lolScore;
          s.gamesPlayed = Math.max(s.gamesPlayed, lolPlayed);
          s.source = "lolesports";
          s.provisional = true;
        }
      }
    } else if (s.status === "live" && s.source === "leaguepedia" && !s.score) {
      // Leaguepedia's "started but no winner" guess; lolesports says it has not started.
      s.status = "scheduled";
    }
  }

  const order = new Map(series.map((s) => [s.id, s.dateTimeUtc]));
  games.sort(
    (a, b) =>
      (order.get(a.seriesId) ?? "").localeCompare(order.get(b.seriesId) ?? "") ||
      a.seriesId.localeCompare(b.seriesId) ||
      a.gameNumber - b.gameNumber,
  );
  series.sort((a, b) => a.dateTimeUtc.localeCompare(b.dateTimeUtc) || a.id.localeCompare(b.id));
  drafts.sort((a, b) => games.findIndex((g) => g.id === a.gameId) - games.findIndex((g) => g.id === b.gameId));

  return {
    series,
    games,
    drafts,
    conflicts,
    warnings,
    manual: { applied, superseded, invalid },
    lolesports: lol,
    provisional: {
      seriesIds: series.filter((s) => s.provisional).map((s) => s.id),
      gameIds: games.filter((g) => g.provisional).map((g) => g.id),
    },
  };
}
