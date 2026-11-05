/**
 * Lane duels: one page per lane of each knockout series, the two players who are expected to face each other there
 * with their numbers side by side. Everything comes from the confirmed games played before the series started, so a
 * duel page reads the same before and after the series and never gives its result away.
 */
import path from "node:path";
import type { IndexedDataset } from "@/lib/data/load";
import type { Game, PlayerGame, Role, Series, StageId } from "@/lib/data/types";
import { aggregatePlayerGames, DEFAULT_MIN_GAMES, groupBy, ROLES, type PlayerAggregate } from "@/lib/metrics";
import { buildMetric, laneMatchups, type LanePlayer, type MetricDef, type PreviewMetric } from "@/lib/preview";

/** Stages whose series get duel pages: the knockout bracket. */
export const DUEL_STAGES: StageId[] = ["quarterfinals", "semifinals", "final"];

/** Knockout series with both teams known, the ones that have duel pages. */
export function duelSeries(data: IndexedDataset): Series[] {
  return data.series.filter((s) => DUEL_STAGES.includes(s.stage) && s.team1Id && s.team2Id);
}

export function hasDuels(s: Series): boolean {
  return DUEL_STAGES.includes(s.stage) && !!s.team1Id && !!s.team2Id;
}

export const isRole = (v: string): v is Role => (ROLES as string[]).includes(v);

/** Path of a duel page: the series page plus the role. */
export const duelHref = (seriesId: string, role: Role) => `/matches/${seriesId}/${role}`;

/** The confirmed games of every series that started before this one: what both sides brought into it. */
export function gamesBefore(data: IndexedDataset, s: Series): Game[] {
  return data.confirmedGames.filter((g) => (data.seriesById.get(g.seriesId)?.dateTimeUtc ?? "") < s.dateTimeUtc);
}

const ALL_DUEL_METRICS: MetricDef<PlayerAggregate>[] = [
  { key: "kda", label: "KDA", format: "dec1", better: "higher", get: (p) => p.kda },
  { key: "kills", label: "Kills per game", format: "dec1", better: "higher", get: (p) => p.avgKills },
  { key: "deaths", label: "Deaths per game", format: "dec1", better: "lower", get: (p) => p.avgDeaths },
  { key: "assists", label: "Assists per game", format: "dec1", better: "higher", get: (p) => p.avgAssists },
  { key: "kp", label: "Kill participation", format: "pct", better: "higher", get: (p) => p.killParticipation },
  { key: "dpm", label: "Damage per minute", format: "int", better: "higher", get: (p) => p.dpm },
  { key: "damageShare", label: "Damage share", format: "pct", better: "higher", get: (p) => p.damageShare },
  { key: "gpm", label: "Gold per minute", format: "int", better: "higher", get: (p) => p.gpm },
  { key: "goldShare", label: "Gold share", format: "pct", better: "higher", get: (p) => p.goldShare },
  { key: "cspm", label: "CS per minute", format: "dec1", better: "higher", get: (p) => p.cspm },
  { key: "goldDiffAt15", label: "Gold diff at 15", format: "signed", better: "higher", get: (p) => p.goldDiffAt15 },
  { key: "csDiffAt15", label: "CS diff at 15", format: "signed", better: "higher", get: (p) => p.csDiffAt15 },
  { key: "vspm", label: "Vision per minute", format: "dec1", better: "higher", get: (p) => p.visionPerMinute },
];

/** Supports farm little by design: their duel leaves CS per minute out. */
const DUEL_METRICS = (role: Role) => ALL_DUEL_METRICS.filter((d) => !(role === "support" && d.key === "cspm"));

const RESULT_METRICS: MetricDef<PlayerAggregate>[] = [
  { key: "winRate", label: "Game win rate", format: "pct", better: "higher", get: (p) => p.winRate },
];

/** The four numbers of the duel's share card, as on the Players page: supports get their own set. */
export const CARD_METRICS = (role: Role): string[] =>
  role === "support" ? ["kda", "kp", "vspm", "assists"] : ["kda", "dpm", "cspm", "kills"];

export interface DuelSide {
  teamId: string;
  player: LanePlayer;
  /** Their games in this role before the series; null without any. */
  stats: PlayerAggregate | null;
  /** Every champion they played in the role, most played first. */
  champions: { champion: string; games: number; wins: number }[];
}

/** A game before the series in which both players met in this lane. */
export interface Meeting {
  game: Game;
  a: PlayerGame;
  b: PlayerGame;
}

export interface LaneDuel {
  series: Series;
  role: Role;
  a: DuelSide | null;
  b: DuelSide | null;
  metrics: PreviewMetric[];
  results: PreviewMetric[];
  /** Players in the role with enough games, the group the bars and the average refer to. */
  roleCount: number;
  meetings: Meeting[];
}

export function laneDuel(data: IndexedDataset, s: Series, role: Role): LaneDuel | null {
  if (!s.team1Id || !s.team2Id) return null;
  const games = gamesBefore(data, s);
  const lane = laneMatchups(data, s.team1Id, s.team2Id, games).find((l) => l.role === role);
  if (!lane) return null;
  const ids = new Set(games.map((g) => g.id));
  const rows = data.playerGames.filter((r) => ids.has(r.gameId) && r.role === role);
  const byPlayer = groupBy(rows, (r) => r.playerId);
  const reference = Array.from(byPlayer.values())
    .filter((list) => list.length >= DEFAULT_MIN_GAMES)
    .map((list) => aggregatePlayerGames(list));

  const side = (teamId: string, p: LanePlayer | null): DuelSide | null => {
    if (!p) return null;
    const list = byPlayer.get(p.playerId) ?? [];
    const stats = list.length ? aggregatePlayerGames(list) : null;
    return {
      teamId,
      player: p,
      stats,
      champions: [...(stats?.champions ?? [])].sort(
        (x, y) => y.games - x.games || y.wins - x.wins || x.champion.localeCompare(y.champion),
      ),
    };
  };
  const a = side(s.team1Id, lane.a);
  const b = side(s.team2Id, lane.b);

  const meetings: Meeting[] = [];
  if (a && b) {
    const mine = byPlayer.get(a.player.playerId) ?? [];
    const theirs = new Map((byPlayer.get(b.player.playerId) ?? []).map((r) => [r.gameId, r]));
    const gameById = new Map(games.map((g) => [g.id, g]));
    for (const ra of mine) {
      const rb = theirs.get(ra.gameId);
      const game = gameById.get(ra.gameId);
      if (rb && game && rb.side !== ra.side) meetings.push({ game, a: ra, b: rb });
    }
  }

  return {
    series: s,
    role,
    a,
    b,
    metrics: DUEL_METRICS(role).map((d) => buildMetric(d, a?.stats ?? null, b?.stats ?? null, reference)),
    results: RESULT_METRICS.map((d) => buildMetric(d, a?.stats ?? null, b?.stats ?? null, reference)),
    roleCount: reference.length,
    meetings,
  };
}

/** How each lane reads in a duel's title: "Top lane duel", "Jungle duel". */
export const DUEL_LABEL: Record<Role, string> = {
  top: "Top lane",
  jungle: "Jungle",
  mid: "Mid lane",
  bot: "Bot lane",
  support: "Support",
};

/** The half-card crop of a champion's splash for duel share cards, made before the build by scripts/duel-art.ts. */
export function duelArtFile(ddragonId: string): string {
  return path.join(process.cwd(), ".cache", "duel-art", `${ddragonId}.jpg`);
}
