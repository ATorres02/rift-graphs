/**
 * The preview of a series that has not started: both teams side by side, their five lane match-ups and the champions
 * each team plays and sees banned against it. Built from confirmed games only, like every other stat on the site.
 */
import type { IndexedDataset } from "@/lib/data/load";
import type { Game, PlayerGame, Role, Series, Side, StageId } from "@/lib/data/types";
import {
  aggregatePlayerGames,
  aggregateTeamGames,
  DEFAULT_MIN_GAMES,
  groupBy,
  ROLES,
  type PlayerAggregate,
  type TeamAggregate,
} from "@/lib/metrics";

/** A series page shows the preview until a game is in: scheduled, or live before the first game ends. */
export function showsPreview(s: Pick<Series, "status" | "gamesPlayed">, games: number): boolean {
  return games === 0 && (s.status === "scheduled" || (s.status === "live" && s.gamesPlayed === 0));
}

/** The round as it reads in a preview title: "quarterfinal", "Swiss Round 5". */
export function previewRound(stage: StageId, round: number | null): string {
  switch (stage) {
    case "quarterfinals":
      return "quarterfinal";
    case "semifinals":
      return "semifinal";
    case "final":
      return "final";
    case "swiss":
      return round ? `Swiss Round ${round}` : "Swiss Stage";
    case "playin":
      return round ? `Play-In Round ${round}` : "Play-In";
  }
}

export type PreviewFormat = "int" | "signed" | "dec1" | "dec2" | "pct" | "time";

export interface PreviewMetric {
  key: string;
  label: string;
  format: PreviewFormat;
  a: number | null;
  b: number | null;
  /** Largest value in the reference group (every team, or every player in the role): a full-length bar. */
  max: number;
  /** Where a bar starts: 0, or for a signed difference the smallest value in the group, so that two teams both
   * behind at 15 minutes still show who is less behind. */
  min: number;
  /** Average of the reference group, drawn as a tick; null when nobody qualifies. */
  avg: number | null;
  /** Which way is better; null when neither is (game length). */
  better: "higher" | "lower" | null;
}

export function formatPreview(value: number | null, format: PreviewFormat): string {
  if (value === null || Number.isNaN(value)) return "–";
  switch (format) {
    case "int":
      return String(Math.round(value));
    case "signed": {
      const n = Math.round(value);
      return n > 0 ? `+${n}` : String(n);
    }
    case "dec1":
      return value.toFixed(1);
    case "dec2":
      return value.toFixed(2);
    case "pct":
      return `${Math.round(value * 100)}%`;
    case "time": {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
    }
  }
}

/** The side that does better on a metric; none when the values read the same once rounded, or neither is better. */
/** Length of a value's bar as a share (0–1) of the full bar. */
export function barShare(m: PreviewMetric, v: number | null): number {
  if (v === null || m.max <= m.min) return 0;
  return Math.min(1, Math.max(0, (v - m.min) / (m.max - m.min)));
}

export function leader(m: PreviewMetric): "a" | "b" | null {
  if (m.a === null || m.b === null || m.better === null) return null;
  if (formatPreview(m.a, m.format) === formatPreview(m.b, m.format)) return null;
  return (m.better === "higher") === m.a > m.b ? "a" : "b";
}

export interface MetricDef<T> {
  key: string;
  label: string;
  format: PreviewFormat;
  better: "higher" | "lower" | null;
  get: (x: T) => number | null;
}

export function buildMetric<T>(def: MetricDef<T>, a: T | null, b: T | null, reference: T[]): PreviewMetric {
  const values = reference.map(def.get).filter((v): v is number => v !== null && !Number.isNaN(v));
  const va = a ? def.get(a) : null;
  const vb = b ? def.get(b) : null;
  return {
    key: def.key,
    label: def.label,
    format: def.format,
    a: va,
    b: vb,
    max: Math.max(...values, va ?? 0, vb ?? 0, 0.0001),
    min: def.format === "signed" ? Math.min(...values, va ?? 0, vb ?? 0) : 0,
    avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
    better: def.better,
  };
}

/* ------------------------------------------------------------------ teams */

const TEAM_METRICS: MetricDef<TeamAggregate>[] = [
  { key: "killsPerGame", label: "Kills per game", format: "dec1", better: "higher", get: (t) => t.killsPerGame },
  { key: "deathsPerGame", label: "Deaths per game", format: "dec1", better: "lower", get: (t) => t.deathsPerGame },
  { key: "firstBloodRate", label: "First blood rate", format: "pct", better: "higher", get: (t) => t.firstBloodRate },
  { key: "goldDiffAt15", label: "Gold diff at 15", format: "signed", better: "higher", get: (t) => t.goldDiffAt15 },
  { key: "goldPerMinute", label: "Gold per minute", format: "int", better: "higher", get: (t) => t.goldPerMinute },
  { key: "towersPerGame", label: "Towers per game", format: "dec1", better: "higher", get: (t) => t.towersPerGame },
  {
    key: "voidGrubsPerGame",
    label: "Void grubs per game",
    format: "dec1",
    better: "higher",
    get: (t) => t.voidGrubsPerGame,
  },
  { key: "dragonControl", label: "Dragon control", format: "pct", better: "higher", get: (t) => t.dragonControl },
  { key: "baronControl", label: "Baron control", format: "pct", better: "higher", get: (t) => t.baronControl },
  {
    key: "avgDurationSeconds",
    label: "Average game length",
    format: "time",
    better: null,
    get: (t) => t.avgDurationSeconds,
  },
];

/** Results, kept apart so the page can hide them behind the spoiler switch. */
const RESULT_METRICS: MetricDef<TeamAggregate>[] = [
  { key: "winRate", label: "Game win rate", format: "pct", better: "higher", get: (t) => t.winRate },
  {
    key: "blueWinRate",
    label: "Blue side win rate",
    format: "pct",
    better: "higher",
    get: (t) => (t.blue.games ? t.blue.winRate : null),
  },
  {
    key: "redWinRate",
    label: "Red side win rate",
    format: "pct",
    better: "higher",
    get: (t) => (t.red.games ? t.red.winRate : null),
  },
];

export interface TeamMatchup {
  games: { a: number; b: number };
  metrics: PreviewMetric[];
  results: PreviewMetric[];
}

/** `games` narrows the sample, e.g. to the games played before a series for its share card. */
export function teamMatchup(
  data: IndexedDataset,
  a: string,
  b: string,
  games: Game[] = data.confirmedGames,
): TeamMatchup {
  const byTeam = new Map(data.teams.map((t) => [t.id, aggregateTeamGames(games, t.id)]));
  const reference = Array.from(byTeam.values()).filter((t) => t.games > 0);
  const ta = byTeam.get(a) ?? null;
  const tb = byTeam.get(b) ?? null;
  const pa = ta?.games ? ta : null;
  const pb = tb?.games ? tb : null;
  return {
    games: { a: ta?.games ?? 0, b: tb?.games ?? 0 },
    metrics: TEAM_METRICS.map((d) => buildMetric(d, pa, pb, reference)),
    results: RESULT_METRICS.map((d) => buildMetric(d, pa, pb, reference)),
  };
}

/* ------------------------------------------------------------------ lanes */

export interface ChampionCount {
  champion: string;
  count: number;
}

export interface LanePlayer {
  playerId: string;
  name: string;
  games: number;
  /** Most played champions, at most three. */
  champions: ChampionCount[];
}

export interface LaneMatchup {
  role: Role;
  a: LanePlayer | null;
  b: LanePlayer | null;
  metrics: PreviewMetric[];
}

const LANE_METRICS = (role: Role): MetricDef<PlayerAggregate>[] => [
  { key: "kda", label: "KDA", format: "dec1", better: "higher", get: (p) => p.kda },
  { key: "kp", label: "KP", format: "pct", better: "higher", get: (p) => p.killParticipation },
  { key: "dpm", label: "DPM", format: "int", better: "higher", get: (p) => p.dpm },
  { key: "goldDiffAt15", label: "GD@15", format: "signed", better: "higher", get: (p) => p.goldDiffAt15 },
  role === "support"
    ? { key: "vspm", label: "Vision/min", format: "dec1", better: "higher", get: (p) => p.visionPerMinute }
    : { key: "cspm", label: "CS/min", format: "dec1", better: "higher", get: (p) => p.cspm },
];

/** The builder measures behind each lane's "Open in Charts" radar. */
export const LANE_CHART_MEASURES = ["kda", "kp", "dpm", "cspm", "damageShare", "vspm"];

function topCounts(names: string[], limit: number): ChampionCount[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return Array.from(counts, ([champion, count]) => ({ champion, count }))
    .sort((x, y) => y.count - x.count || x.champion.localeCompare(y.champion))
    .slice(0, limit);
}

/**
 * Who plays a role for a team: the player with the most games there (the latest game breaks a tie, so a recent
 * substitute wins over the starter only when they have played as much), else the listed roster.
 */
function lanePlayer(data: IndexedDataset, rows: PlayerGame[], teamId: string, role: Role): LanePlayer | null {
  const inRole = rows.filter((r) => r.teamId === teamId && r.role === role);
  const order = new Map(data.confirmedGames.map((g, i) => [g.id, i]));
  const byPlayer = Array.from(groupBy(inRole, (r) => r.playerId)).map(([id, list]) => ({
    id,
    list,
    last: Math.max(...list.map((r) => order.get(r.gameId) ?? -1)),
  }));
  byPlayer.sort((x, y) => y.list.length - x.list.length || y.last - x.last);
  const pick = byPlayer[0];
  const id = pick?.id ?? data.teamsById.get(teamId)?.roster.find((r) => r.role === role)?.playerId;
  if (!id) return null;
  const list = pick?.list ?? [];
  return {
    playerId: id,
    name: data.playersById.get(id)?.name ?? id,
    games: list.length,
    champions: topCounts(
      list.map((r) => r.champion),
      3,
    ),
  };
}

/** `games` narrows the sample, e.g. to the games played before a series for its lane duels. */
export function laneMatchups(
  data: IndexedDataset,
  a: string,
  b: string,
  games: Game[] = data.confirmedGames,
): LaneMatchup[] {
  const confirmed = new Set(games.map((g) => g.id));
  const rows = data.playerGames.filter((r) => confirmed.has(r.gameId));
  const byRolePlayer = groupBy(rows, (r) => `${r.role}|${r.playerId}`);
  return ROLES.map((role) => {
    const pa = lanePlayer(data, rows, a, role);
    const pb = lanePlayer(data, rows, b, role);
    const reference = Array.from(byRolePlayer)
      .filter(([k, list]) => k.startsWith(`${role}|`) && list.length >= DEFAULT_MIN_GAMES)
      .map(([, list]) => aggregatePlayerGames(list));
    const agg = (p: LanePlayer | null) => {
      const list = p ? (byRolePlayer.get(`${role}|${p.playerId}`) ?? []) : [];
      return list.length ? aggregatePlayerGames(list) : null;
    };
    return {
      role,
      a: pa,
      b: pb,
      metrics: LANE_METRICS(role).map((d) => buildMetric(d, agg(pa), agg(pb), reference)),
    };
  });
}

/* ------------------------------------------------------------------ champions */

export interface ChampionPool {
  teamId: string;
  games: number;
  /** The team's most picked champions. */
  played: ChampionCount[];
  /** Champions its opponents banned most often in its games. */
  bannedAgainst: ChampionCount[];
}

const other = (side: Side): Side => (side === "blue" ? "red" : "blue");

export function championPool(games: Game[], teamId: string, limit = 5): ChampionPool {
  const own = games.flatMap((g) => {
    const side: Side | null = g.blue.teamId === teamId ? "blue" : g.red.teamId === teamId ? "red" : null;
    return side ? [{ g, side }] : [];
  });
  return {
    teamId,
    games: own.length,
    played: topCounts(
      own.flatMap(({ g, side }) => g[side].picks),
      limit,
    ),
    bannedAgainst: topCounts(
      own.flatMap(({ g, side }) => Array.from(new Set(g[other(side)].bans))),
      limit,
    ),
  };
}
