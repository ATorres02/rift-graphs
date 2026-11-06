/**
 * Records of the tournament: the single-game extremes (longest game, most kills, biggest comeback...) and the
 * champion and player totals that stand out. Pure, from the indexed dataset and the gold timelines. Confirmed games
 * only, like rankings and charts: a provisional game never sets a record.
 */
import type { IndexedDataset } from "@/lib/data/index";
import type { Game, PlayerGame, Side } from "@/lib/data/types";
import { fmt } from "@/lib/format";
import type { GameTimeline } from "@/lib/sources/livestats";

export interface RecordEntry {
  /** Position, shared by equal values (1, 1, 3). */
  rank: number;
  value: number;
  /** The value as shown: "47:29", "17", "8.3k". */
  display: string;
  /** Extra numbers next to the holder: "27 to 13", "3/0/22". */
  detail?: string;
  /** The game the record was set in, when it belongs to one game. */
  gameId?: string;
  /** Who holds it. A game record names both teams (teamId vs opponentTeamId). */
  playerId?: string;
  teamId?: string;
  opponentTeamId?: string;
  champion?: string;
}

export interface TournamentRecord {
  key: string;
  label: string;
  /** Word after the value: "kills", "gold". */
  unit?: string;
  /** One line on how it is measured. */
  note?: string;
  /** The holder or the numbers give away a result: shown behind the spoiler switch. */
  spoiler: boolean;
  entries: RecordEntry[];
}

export interface RecordGroup {
  key: string;
  title: string;
  description: string;
  records: TournamentRecord[];
}

/** How many holders each record lists: the record and two runners-up. */
export const RECORD_DEPTH = 3;
/** Fewest picks for a champion's win rate to count. */
export const MIN_PICKS_FOR_WIN_RATE = 8;

type Candidate = Omit<RecordEntry, "rank"> & { order: string };

/** The best `RECORD_DEPTH` candidates, highest first (or lowest with `ascending`); earlier games win ties. */
function top(cands: Candidate[], ascending = false): RecordEntry[] {
  const sorted = [...cands].sort(
    (a, b) => (ascending ? a.value - b.value : b.value - a.value) || (a.order < b.order ? -1 : 1),
  );
  const out: RecordEntry[] = [];
  for (const [i, cand] of sorted.slice(0, RECORD_DEPTH).entries()) {
    const c: RecordEntry & { order?: string } = { ...cand, rank: 0 };
    delete c.order;
    const prev = out[i - 1];
    out.push({ ...c, rank: prev && prev.value === c.value ? prev.rank : i + 1 });
  }
  return out;
}

const other = (side: Side): Side => (side === "blue" ? "red" : "blue");
const perMin = (n: number, seconds: number) => (seconds > 0 ? (n * 60) / seconds : 0);

/** All the records, grouped as the page shows them. Empty groups are left out. */
export function computeRecords(data: IndexedDataset, timelines: Map<string, GameTimeline>): RecordGroup[] {
  const games = data.confirmedGames;
  const order = (g: Game | undefined) => `${g?.dateTimeUtc ?? "9999"}|${g?.id ?? ""}`;
  const confirmed = new Set(games.map((g) => g.id));
  const rows = data.playerGames.filter((r) => confirmed.has(r.gameId));

  // A game record names both teams: the one the record is about first (the winner when nothing else decides).
  const gameCand = (
    g: Game,
    value: number,
    display: string,
    first: Side = g.winnerSide,
    detail?: string,
  ): Candidate => ({
    value,
    display,
    detail,
    gameId: g.id,
    teamId: g[first].teamId,
    opponentTeamId: g[other(first)].teamId,
    order: order(g),
  });
  const totalKills = (g: Game) => g.blue.kills + g.red.kills;
  const killsDetail = (g: Game) => `${g.blue.kills} to ${g.red.kills}`;

  // Gold timelines: largest lead and largest deficit the winner came back from.
  const leads: Candidate[] = [];
  const comebacks: Candidate[] = [];
  for (const g of games) {
    const tl = timelines.get(g.id);
    if (!tl) continue;
    let blueTop = 0;
    let redTop = 0;
    tl.blue.gold.forEach((b, i) => {
      const diff = b - tl.red.gold[i];
      blueTop = Math.max(blueTop, diff);
      redTop = Math.max(redTop, -diff);
    });
    const leader: Side = blueTop >= redTop ? "blue" : "red";
    const lead = Math.max(blueTop, redTop);
    if (lead > 0) leads.push(gameCand(g, lead, fmt.int(lead), leader));
    const deficit = g.winnerSide === "blue" ? redTop : blueTop;
    if (deficit > 0) comebacks.push(gameCand(g, deficit, fmt.int(deficit), g.winnerSide));
  }

  const at15: Candidate[] = games.flatMap((g) => {
    const b = g.blue.goldAt15;
    const r = g.red.goldAt15;
    if (b === undefined || r === undefined || b === r) return [];
    const leader: Side = b > r ? "blue" : "red";
    const diff = Math.abs(b - r);
    return [gameCand(g, diff, fmt.int(diff), leader)];
  });

  const gameGroup: TournamentRecord[] = [
    {
      key: "longest-game",
      label: "Longest game",
      spoiler: false,
      entries: top(games.map((g) => gameCand(g, g.durationSeconds, fmt.duration(g.durationSeconds), "blue"))),
    },
    {
      key: "shortest-game",
      label: "Shortest game",
      spoiler: false,
      entries: top(
        games.map((g) => gameCand(g, g.durationSeconds, fmt.duration(g.durationSeconds), "blue")),
        true,
      ),
    },
    {
      key: "most-kills-game",
      label: "Most kills in a game",
      unit: "kills",
      note: "Both teams together.",
      spoiler: false,
      entries: top(games.map((g) => gameCand(g, totalKills(g), String(totalKills(g)), "blue", killsDetail(g)))),
    },
    {
      key: "fewest-kills-game",
      label: "Fewest kills in a game",
      unit: "kills",
      note: "Both teams together.",
      spoiler: false,
      entries: top(
        games.map((g) => gameCand(g, totalKills(g), String(totalKills(g)), "blue", killsDetail(g))),
        true,
      ),
    },
    {
      key: "biggest-lead",
      label: "Biggest gold lead",
      unit: "gold",
      note: "At any point of the game, from the live stats every 30 seconds. The team that held it comes first.",
      spoiler: false,
      entries: top(leads),
    },
    {
      key: "biggest-lead-15",
      label: "Biggest gold lead at 15",
      unit: "gold",
      note: "At 15:00 of game time. The team that held it comes first.",
      spoiler: false,
      entries: top(at15),
    },
    {
      key: "biggest-comeback",
      label: "Biggest comeback",
      unit: "gold",
      note: "The largest gold deficit a team turned into a win. The team that came back comes first.",
      spoiler: true,
      entries: top(comebacks),
    },
  ];

  const playerCand = (r: PlayerGame, value: number, display: string, detail?: string): Candidate => ({
    value,
    display,
    detail,
    gameId: r.gameId,
    playerId: r.playerId,
    teamId: r.teamId,
    opponentTeamId: r.opponentTeamId,
    champion: r.champion,
    order: order(data.gamesById.get(r.gameId)),
  });
  const kdaLine = (r: PlayerGame) => `${r.kills}/${r.deaths}/${r.assists}`;
  const single = (
    key: string,
    label: string,
    pick: (r: PlayerGame) => number,
    show: (v: number) => string,
    opts: { unit?: string; note?: string; rows?: PlayerGame[]; detail?: (r: PlayerGame) => string } = {},
  ): TournamentRecord => ({
    key,
    label,
    unit: opts.unit,
    note: opts.note,
    spoiler: false,
    entries: top((opts.rows ?? rows).map((r) => playerCand(r, pick(r), show(pick(r)), opts.detail?.(r)))),
  });
  const playerGroup: TournamentRecord[] = [
    single("most-kills", "Most kills", (r) => r.kills, String, { unit: "kills", detail: kdaLine }),
    single("most-assists", "Most assists", (r) => r.assists, String, { unit: "assists", detail: kdaLine }),
    single("most-damage", "Most damage to champions", (r) => r.damageToChampions, fmt.int, { unit: "damage" }),
    single("highest-dpm", "Most damage per minute", (r) => perMin(r.damageToChampions, r.durationSeconds), fmt.int, {
      unit: "DPM",
    }),
    single("most-cs", "Most CS", (r) => r.cs, String, { unit: "CS" }),
    single(
      "highest-cspm",
      "Most CS per minute",
      (r) => perMin(r.cs, r.durationSeconds),
      (v) => fmt.dec(v, 1),
      {
        unit: "CS/min",
        note: "Supports left out.",
        rows: rows.filter((r) => r.role !== "support"),
      },
    ),
    single("most-gold", "Most gold", (r) => r.gold, fmt.int, { unit: "gold" }),
    single("highest-vision", "Highest vision score", (r) => r.visionScore, String, { unit: "vision" }),
    single("deathless", "Best game without dying", (r) => r.kills + r.assists, String, {
      unit: "kills + assists",
      note: "Kills plus assists in a game with no deaths.",
      rows: rows.filter((r) => r.deaths === 0),
      detail: kdaLine,
    }),
  ];

  const teamSides = games.flatMap((g) => (["blue", "red"] as const).map((side) => ({ g, side })));
  const teamCand = (g: Game, side: Side, value: number): Candidate => ({ ...gameCand(g, value, String(value), side) });
  const teamGroup: TournamentRecord[] = [
    {
      key: "team-kills",
      label: "Most kills by a team",
      unit: "kills",
      spoiler: false,
      entries: top(teamSides.map(({ g, side }) => teamCand(g, side, g[side].kills))),
    },
    {
      key: "team-barons",
      label: "Most barons by a team",
      unit: "barons",
      spoiler: false,
      entries: top(teamSides.map(({ g, side }) => teamCand(g, side, g[side].barons))),
    },
    {
      key: "team-dragons",
      label: "Most dragons by a team",
      unit: "dragons",
      note: "Elder dragons included.",
      spoiler: false,
      entries: top(teamSides.map(({ g, side }) => teamCand(g, side, g[side].dragons))),
    },
  ];

  // Champions and players over the whole tournament.
  const picks = new Map<string, { n: number; wins: number }>();
  const bans = new Map<string, number>();
  for (const g of games)
    for (const side of ["blue", "red"] as const) {
      for (const c of g[side].picks) {
        const p = picks.get(c) ?? { n: 0, wins: 0 };
        p.n += 1;
        if (g.winnerSide === side) p.wins += 1;
        picks.set(c, p);
      }
      for (const c of g[side].bans) if (c) bans.set(c, (bans.get(c) ?? 0) + 1);
    }
  const champCand = (champion: string, value: number, display: string, detail?: string): Candidate => ({
    value,
    display,
    detail,
    champion,
    order: champion,
  });
  const pools = new Map<string, Set<string>>();
  for (const r of rows) pools.set(r.playerId, (pools.get(r.playerId) ?? new Set()).add(r.champion));
  const playerTeam = (id: string) => data.playersById.get(id)?.teamId;
  const champs = [...new Set([...picks.keys(), ...bans.keys()])];
  const championGroup: TournamentRecord[] = [
    {
      key: "most-picked",
      label: "Most picked champion",
      unit: "picks",
      spoiler: false,
      entries: top(
        [...picks].map(([c, p]) => champCand(c, p.n, String(p.n), `${fmt.pct(p.n / games.length)} of games`)),
      ),
    },
    {
      key: "most-banned",
      label: "Most banned champion",
      unit: "bans",
      spoiler: false,
      entries: top([...bans].map(([c, n]) => champCand(c, n, String(n), `${fmt.pct(n / games.length)} of games`))),
    },
    {
      key: "highest-presence",
      label: "Highest presence",
      note: "Picked or banned, share of games.",
      spoiler: false,
      entries: top(
        champs.map((c) => {
          const n = (picks.get(c)?.n ?? 0) + (bans.get(c) ?? 0);
          return champCand(
            c,
            n / games.length,
            fmt.pct(n / games.length),
            `${picks.get(c)?.n ?? 0} picks, ${bans.get(c) ?? 0} bans`,
          );
        }),
      ),
    },
    {
      key: "best-win-rate",
      label: "Best champion win rate",
      note: `At least ${MIN_PICKS_FOR_WIN_RATE} games.`,
      spoiler: true,
      entries: top(
        [...picks]
          .filter(([, p]) => p.n >= MIN_PICKS_FOR_WIN_RATE)
          .map(([c, p]) => champCand(c, p.wins / p.n, fmt.pct(p.wins / p.n), fmt.record(p.wins, p.n - p.wins))),
      ),
    },
    {
      key: "widest-pool",
      label: "Most champions played",
      unit: "champions",
      note: "Different champions played by one player.",
      spoiler: false,
      entries: top(
        [...pools].map(([id, set]) => ({
          value: set.size,
          display: String(set.size),
          playerId: id,
          teamId: playerTeam(id),
          order: id,
        })),
      ),
    },
  ];

  const groups: RecordGroup[] = [
    {
      key: "games",
      title: "Games",
      description: "The longest, shortest, bloodiest and most lopsided games.",
      records: gameGroup,
    },
    {
      key: "players",
      title: "Players in one game",
      description: "The best single-game numbers by a player.",
      records: playerGroup,
    },
    {
      key: "teams",
      title: "Teams in one game",
      description: "The best single-game numbers by a team.",
      records: teamGroup,
    },
    {
      key: "champions",
      title: "Champions and pools",
      description: "Over the whole tournament.",
      records: championGroup,
    },
  ];
  return groups
    .map((g) => ({ ...g, records: g.records.filter((r) => r.entries.length && r.entries[0].value > 0) }))
    .filter((g) => g.records.length);
}

export interface Pentakill {
  gameId: string;
  playerId: string;
  teamId: string;
  opponentTeamId: string;
  champion: string;
  count: number;
}

/** Every pentakill, in the order they happened. */
export function pentakills(data: IndexedDataset): Pentakill[] {
  const confirmed = new Map(data.confirmedGames.map((g) => [g.id, g]));
  return data.playerGames
    .filter((r) => r.pentakills > 0 && confirmed.has(r.gameId))
    .sort((a, b) =>
      (confirmed.get(a.gameId)?.dateTimeUtc ?? "") < (confirmed.get(b.gameId)?.dateTimeUtc ?? "") ? -1 : 1,
    )
    .map((r) => ({
      gameId: r.gameId,
      playerId: r.playerId,
      teamId: r.teamId,
      opponentTeamId: r.opponentTeamId,
      champion: r.champion,
      count: r.pentakills,
    }));
}
