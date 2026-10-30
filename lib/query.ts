/**
 * Chart builder query engine: pure functions over the indexed dataset.
 *
 * `runQuery(config, data)` turns a serialisable config into grouped rows that
 * `lib/charts/build.ts` renders. Every measure is defined once here; ratios are
 * computed over group totals (same convention as lib/metrics.ts).
 */
import type { IndexedDataset } from "./data/index";
import { regionInfo } from "./data/regions";
import type { Role, Side, StageId } from "./data/types";
import type { Unit } from "./charts/spec";
import { ROLE_LABEL, STAGE_LABEL, STAGE_SHORT } from "./format";
import { kda as kdaOf } from "./metrics";

export type DataSource = "players" | "teams" | "champions" | "games";
export type ChartType = "bar" | "groupedBar" | "stackedBar" | "line" | "scatter" | "radar" | "heatmap" | "boxplot";
export type Aggregation = "mean" | "median" | "sum" | "max" | "min" | "perGame" | "perMinute";
export type SortMode = "desc" | "asc" | "label";
export type ColorBy = "none" | "region" | "team" | "role";
export type MeasureGroup = "combat" | "economy" | "damage" | "vision" | "objectives" | "duration" | "draft" | "results";

export interface QueryFilters {
  stages?: StageId[];
  teams?: string[];
  regions?: string[];
  roles?: Role[];
  side?: Side;
  result?: "win" | "loss";
  champions?: string[];
  /** Player ids (player and champion sources). */
  players?: string[];
  minGames?: number;
  durationMin?: number;
  durationMax?: number;
}

export interface QueryConfig {
  source: DataSource;
  measures: string[];
  groupBy: string;
  series: string | null;
  aggregation: Aggregation;
  filters: QueryFilters;
  chart: ChartType;
  sort: SortMode;
  topN: number | null;
  colorBy: ColorBy;
  showAverage: boolean;
  title: string | null;
  /**
   * Keys of the group-by dimension to keep (e.g. two teams for a radar). Unlike a filter, the others still count for
   * the tournament average and for the radar scale.
   */
  pick?: string[];
}

export const DEFAULT_CONFIG: QueryConfig = {
  source: "players",
  measures: ["dpm"],
  groupBy: "player",
  series: null,
  aggregation: "mean",
  filters: { minGames: 3 },
  chart: "bar",
  sort: "desc",
  topN: 10,
  colorBy: "none",
  showAverage: true,
  title: null,
};

/* ------------------------------------------------------------------ base rows */

export interface BaseRow {
  gameId: string;
  seriesId: string;
  stage: StageId;
  round: number | null;
  day: string;
  gameNumber: number;
  duration: number;
  playerId: string | null;
  player: string | null;
  teamId: string;
  team: string;
  region: string;
  role: Role | null;
  champion: string | null;
  side: Side | null;
  win: number;
  /** Scheduled start of the game (ISO), to order games. */
  time: string;
  /** Opponent tag (null for the games source). */
  opponent: string | null;
  /** Numeric fields referenced by measures (missing → 0). */
  n: Record<string, number>;
}

const rowCache = new WeakMap<IndexedDataset, Partial<Record<DataSource, BaseRow[]>>>();

function dayOf(iso: string | null): string {
  return (iso ?? "").slice(0, 10) || "unknown";
}

export function buildRows(data: IndexedDataset, source: DataSource): BaseRow[] {
  const cache = rowCache.get(data) ?? {};
  if (cache[source]) return cache[source]!;
  const rows: BaseRow[] = [];
  const base = (gameId: string) => {
    const g = data.gamesById.get(gameId);
    const s = g ? data.seriesById.get(g.seriesId) : undefined;
    return g && s ? { g, s } : null;
  };
  const teamName = (id: string) => data.teamsById.get(id)?.short ?? id;
  const teamRegion = (id: string) => data.teamsById.get(id)?.region ?? "Unknown";

  if (source === "players" || source === "champions") {
    for (const pg of data.playerGames) {
      const b = base(pg.gameId);
      if (!b) continue;
      rows.push({
        gameId: pg.gameId,
        seriesId: pg.seriesId,
        stage: pg.stage,
        round: b.s.round,
        day: dayOf(b.g.dateTimeUtc ?? b.s.dateTimeUtc),
        gameNumber: b.g.gameNumber,
        duration: pg.durationSeconds,
        playerId: pg.playerId,
        player: data.playersById.get(pg.playerId)?.name ?? pg.playerId,
        teamId: pg.teamId,
        team: teamName(pg.teamId),
        region: teamRegion(pg.teamId),
        role: pg.role,
        champion: pg.champion,
        side: pg.side,
        win: pg.win ? 1 : 0,
        time: b.g.dateTimeUtc ?? b.s.dateTimeUtc,
        opponent: teamName(pg.opponentTeamId),
        n: {
          kills: pg.kills,
          deaths: pg.deaths,
          assists: pg.assists,
          gold: pg.gold,
          cs: pg.cs,
          damage: pg.damageToChampions,
          vision: pg.visionScore,
          teamKills: pg.teamKills,
          teamGold: pg.teamGold,
          teamDamage: pg.teamDamage,
          pick: 1,
          ban: 0,
          games: 1,
        },
      });
    }
    if (source === "champions") {
      for (const g of data.confirmedGames) {
        const s = data.seriesById.get(g.seriesId);
        if (!s) continue;
        for (const side of ["blue", "red"] as const) {
          for (const champion of g[side].bans) {
            rows.push({
              gameId: g.id,
              seriesId: g.seriesId,
              stage: g.stage,
              round: s.round,
              day: dayOf(g.dateTimeUtc ?? s.dateTimeUtc),
              gameNumber: g.gameNumber,
              duration: g.durationSeconds,
              playerId: null,
              player: null,
              teamId: g[side].teamId,
              team: teamName(g[side].teamId),
              region: teamRegion(g[side].teamId),
              role: null,
              champion,
              side,
              win: g.winnerSide === side ? 1 : 0,
              time: g.dateTimeUtc ?? s.dateTimeUtc,
              opponent: teamName(g[side === "blue" ? "red" : "blue"].teamId),
              n: { pick: 0, ban: 1, games: 0 },
            });
          }
        }
      }
    }
  } else if (source === "teams") {
    for (const g of data.confirmedGames) {
      const s = data.seriesById.get(g.seriesId);
      if (!s) continue;
      const pgs = data.playerGamesByGame.get(g.id) ?? [];
      for (const side of ["blue", "red"] as const) {
        const own = g[side];
        const opp = g[side === "blue" ? "red" : "blue"];
        const teamDamage = pgs.filter((r) => r.side === side).reduce((a, r) => a + r.damageToChampions, 0);
        const teamCs = pgs.filter((r) => r.side === side).reduce((a, r) => a + r.cs, 0);
        const teamVision = pgs.filter((r) => r.side === side).reduce((a, r) => a + r.visionScore, 0);
        rows.push({
          gameId: g.id,
          seriesId: g.seriesId,
          stage: g.stage,
          round: s.round,
          day: dayOf(g.dateTimeUtc ?? s.dateTimeUtc),
          gameNumber: g.gameNumber,
          duration: g.durationSeconds,
          playerId: null,
          player: null,
          teamId: own.teamId,
          team: teamName(own.teamId),
          region: teamRegion(own.teamId),
          role: null,
          champion: null,
          side,
          win: g.winnerSide === side ? 1 : 0,
          time: g.dateTimeUtc ?? s.dateTimeUtc,
          opponent: teamName(opp.teamId),
          n: {
            kills: own.kills,
            deaths: opp.kills,
            assists: 0,
            gold: own.gold,
            cs: teamCs,
            damage: teamDamage,
            vision: teamVision,
            towers: own.towers,
            inhibitors: own.inhibitors,
            dragons: own.dragons,
            elders: own.elders,
            barons: own.barons,
            heralds: own.heralds,
            voidGrubs: own.voidGrubs,
            oppDragons: opp.dragons,
            oppBarons: opp.barons,
            oppTowers: opp.towers,
            games: 1,
          },
        });
      }
    }
  } else {
    for (const g of data.confirmedGames) {
      const s = data.seriesById.get(g.seriesId);
      if (!s) continue;
      rows.push({
        gameId: g.id,
        seriesId: g.seriesId,
        stage: g.stage,
        round: s.round,
        day: dayOf(g.dateTimeUtc ?? s.dateTimeUtc),
        gameNumber: g.gameNumber,
        duration: g.durationSeconds,
        playerId: null,
        player: null,
        teamId: `${g.blue.teamId}+${g.red.teamId}`,
        team: `${teamName(g.blue.teamId)} vs ${teamName(g.red.teamId)}`,
        region: "",
        role: null,
        champion: null,
        side: g.winnerSide,
        win: g.winnerSide === "blue" ? 1 : 0,
        time: g.dateTimeUtc ?? s.dateTimeUtc,
        opponent: null,
        n: {
          totalKills: g.blue.kills + g.red.kills,
          totalGold: g.blue.gold + g.red.gold,
          totalDragons: g.blue.dragons + g.red.dragons,
          totalBarons: g.blue.barons + g.red.barons,
          totalTowers: g.blue.towers + g.red.towers,
          blueWin: g.winnerSide === "blue" ? 1 : 0,
          games: 1,
        },
      });
    }
  }
  cache[source] = rows;
  rowCache.set(data, cache);
  return rows;
}

/* ------------------------------------------------------------------ measures */

export interface GroupContext {
  /** Distinct games in the group. */
  games: number;
  /** Total minutes of the group's distinct games. */
  minutes: number;
  /** Distinct games in the whole filtered universe (for presence rates). */
  universeGames: number;
}

export interface MeasureDef {
  key: string;
  label: string;
  group: MeasureGroup;
  unit: Unit;
  kind: "sum" | "ratio" | "count";
  sources: DataSource[];
  /** sum-kind: per-row field. */
  field?: string;
  /** ratio-kind: value from the group's field sums. */
  ratio?: (sums: Record<string, number>, ctx: GroupContext) => number | null;
  /** Per-row value, used by median/max/min and box plots. */
  perRow?: (row: BaseRow) => number | null;
  /** Only rows passing this predicate feed the measure (e.g. champion picks only). */
  rowFilter?: (row: BaseRow) => boolean;
  description: string;
}

const PLAYERLIKE: DataSource[] = ["players", "champions"];
/** Champion ban rows carry pick=0; every other source has no pick field and passes. */
const picksOnly = (r: BaseRow) => r.n.pick !== 0;
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : null);

export const MEASURES: MeasureDef[] = [
  // combat
  {
    key: "kills",
    label: "Kills",
    group: "combat",
    unit: "decimal1",
    kind: "sum",
    field: "kills",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Kills per game (or total/median/max depending on aggregation).",
  },
  {
    key: "deaths",
    label: "Deaths",
    group: "combat",
    unit: "decimal1",
    kind: "sum",
    field: "deaths",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Deaths per game.",
  },
  {
    key: "assists",
    label: "Assists",
    group: "combat",
    unit: "decimal1",
    kind: "sum",
    field: "assists",
    sources: ["players", "champions"],
    rowFilter: picksOnly,
    description: "Assists per game.",
  },
  {
    key: "kda",
    label: "KDA",
    group: "combat",
    unit: "decimal1",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s) => kdaOf(s.kills ?? 0, s.deaths ?? 0, s.assists ?? 0),
    perRow: (r) => kdaOf(r.n.kills ?? 0, r.n.deaths ?? 0, r.n.assists ?? 0),
    description: "(Kills + Assists) / Deaths over all games in the group.",
  },
  {
    key: "kp",
    label: "Kill participation",
    group: "combat",
    unit: "percent",
    kind: "ratio",
    sources: PLAYERLIKE,
    rowFilter: picksOnly,
    ratio: (s) => safeDiv((s.kills ?? 0) + (s.assists ?? 0), s.teamKills ?? 0),
    perRow: (r) => safeDiv(r.n.kills + r.n.assists, r.n.teamKills),
    description: "Share of the team's kills the player took part in.",
  },
  {
    key: "totalKills",
    label: "Total kills (both teams)",
    group: "combat",
    unit: "decimal1",
    kind: "sum",
    field: "totalKills",
    sources: ["games"],
    description: "Kills by both teams in a game.",
  },
  {
    key: "killsPerMinute",
    label: "Kills per minute (both teams)",
    group: "combat",
    unit: "decimal2",
    kind: "ratio",
    sources: ["games"],
    ratio: (s, c) => safeDiv(s.totalKills ?? 0, c.minutes),
    perRow: (r) => safeDiv(r.n.totalKills, r.duration / 60),
    description: "Combined kills divided by game minutes.",
  },
  // economy
  {
    key: "gold",
    label: "Gold",
    group: "economy",
    unit: "gold",
    kind: "sum",
    field: "gold",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Gold earned per game.",
  },
  {
    key: "gpm",
    label: "Gold per minute",
    group: "economy",
    unit: "number",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s, c) => safeDiv(s.gold ?? 0, c.minutes),
    perRow: (r) => safeDiv(r.n.gold, r.duration / 60),
    description: "Gold divided by minutes played.",
  },
  {
    key: "goldShare",
    label: "Gold share",
    group: "economy",
    unit: "percent",
    kind: "ratio",
    sources: PLAYERLIKE,
    rowFilter: picksOnly,
    ratio: (s) => safeDiv(s.gold ?? 0, s.teamGold ?? 0),
    perRow: (r) => safeDiv(r.n.gold, r.n.teamGold),
    description: "Share of the team's gold.",
  },
  {
    key: "cs",
    label: "CS",
    group: "economy",
    unit: "decimal1",
    kind: "sum",
    field: "cs",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Creep score per game.",
  },
  {
    key: "cspm",
    label: "CS per minute",
    group: "economy",
    unit: "decimal1",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s, c) => safeDiv(s.cs ?? 0, c.minutes),
    perRow: (r) => safeDiv(r.n.cs, r.duration / 60),
    description: "Creep score divided by minutes played.",
  },
  {
    key: "totalGold",
    label: "Total gold (both teams)",
    group: "economy",
    unit: "gold",
    kind: "sum",
    field: "totalGold",
    sources: ["games"],
    description: "Gold of both teams in a game.",
  },
  // damage
  {
    key: "damage",
    label: "Damage to champions",
    group: "damage",
    unit: "number",
    kind: "sum",
    field: "damage",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Damage dealt to champions per game.",
  },
  {
    key: "dpm",
    label: "Damage per minute",
    group: "damage",
    unit: "number",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s, c) => safeDiv(s.damage ?? 0, c.minutes),
    perRow: (r) => safeDiv(r.n.damage, r.duration / 60),
    description: "Damage to champions divided by minutes played.",
  },
  {
    key: "damageShare",
    label: "Damage share",
    group: "damage",
    unit: "percent",
    kind: "ratio",
    sources: PLAYERLIKE,
    rowFilter: picksOnly,
    ratio: (s) => safeDiv(s.damage ?? 0, s.teamDamage ?? 0),
    perRow: (r) => safeDiv(r.n.damage, r.n.teamDamage),
    description: "Share of the team's damage to champions.",
  },
  // vision
  {
    key: "vision",
    label: "Vision score",
    group: "vision",
    unit: "decimal1",
    kind: "sum",
    field: "vision",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    description: "Vision score per game.",
  },
  {
    key: "vspm",
    label: "Vision score per minute",
    group: "vision",
    unit: "decimal2",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s, c) => safeDiv(s.vision ?? 0, c.minutes),
    perRow: (r) => safeDiv(r.n.vision, r.duration / 60),
    description: "Vision score divided by minutes played.",
  },
  // objectives
  {
    key: "towers",
    label: "Towers",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "towers",
    sources: ["teams"],
    description: "Towers destroyed per game.",
  },
  {
    key: "inhibitors",
    label: "Inhibitors",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "inhibitors",
    sources: ["teams"],
    description: "Inhibitors destroyed per game.",
  },
  {
    key: "dragons",
    label: "Dragons",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "dragons",
    sources: ["teams"],
    description: "Dragons taken per game.",
  },
  {
    key: "elders",
    label: "Elder dragons",
    group: "objectives",
    unit: "decimal2",
    kind: "sum",
    field: "elders",
    sources: ["teams"],
    description: "Elder dragons taken per game.",
  },
  {
    key: "barons",
    label: "Barons",
    group: "objectives",
    unit: "decimal2",
    kind: "sum",
    field: "barons",
    sources: ["teams"],
    description: "Barons taken per game.",
  },
  {
    key: "heralds",
    label: "Rift Heralds",
    group: "objectives",
    unit: "decimal2",
    kind: "sum",
    field: "heralds",
    sources: ["teams"],
    description: "Rift Heralds taken per game.",
  },
  {
    key: "voidGrubs",
    label: "Void grubs",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "voidGrubs",
    sources: ["teams"],
    description: "Void grubs taken per game.",
  },
  {
    key: "dragonControl",
    label: "Dragon control",
    group: "objectives",
    unit: "percent",
    kind: "ratio",
    sources: ["teams"],
    ratio: (s) => safeDiv(s.dragons ?? 0, (s.dragons ?? 0) + (s.oppDragons ?? 0)),
    perRow: (r) => safeDiv(r.n.dragons, r.n.dragons + r.n.oppDragons),
    description: "Share of all dragons taken in the team's games.",
  },
  {
    key: "baronControl",
    label: "Baron control",
    group: "objectives",
    unit: "percent",
    kind: "ratio",
    sources: ["teams"],
    ratio: (s) => safeDiv(s.barons ?? 0, (s.barons ?? 0) + (s.oppBarons ?? 0)),
    perRow: (r) => safeDiv(r.n.barons, r.n.barons + r.n.oppBarons),
    description: "Share of all barons taken in the team's games.",
  },
  {
    key: "totalDragons",
    label: "Dragons (both teams)",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "totalDragons",
    sources: ["games"],
    description: "Dragons taken by both teams.",
  },
  {
    key: "totalBarons",
    label: "Barons (both teams)",
    group: "objectives",
    unit: "decimal2",
    kind: "sum",
    field: "totalBarons",
    sources: ["games"],
    description: "Barons taken by both teams.",
  },
  {
    key: "totalTowers",
    label: "Towers (both teams)",
    group: "objectives",
    unit: "decimal1",
    kind: "sum",
    field: "totalTowers",
    sources: ["games"],
    description: "Towers destroyed by both teams.",
  },
  // duration
  {
    key: "duration",
    label: "Game length",
    group: "duration",
    unit: "seconds",
    kind: "sum",
    field: "duration",
    sources: ["players", "teams", "champions", "games"],
    rowFilter: picksOnly,
    perRow: (r) => r.duration,
    description: "Game length in minutes and seconds.",
  },
  // draft
  {
    key: "picks",
    label: "Picks",
    group: "draft",
    unit: "number",
    kind: "sum",
    field: "pick",
    sources: ["champions"],
    description: "Games in which the champion was picked.",
  },
  {
    key: "bans",
    label: "Bans",
    group: "draft",
    unit: "number",
    kind: "sum",
    field: "ban",
    sources: ["champions"],
    description: "Games in which the champion was banned.",
  },
  {
    key: "presence",
    label: "Presence",
    group: "draft",
    unit: "percent",
    kind: "ratio",
    sources: ["champions"],
    ratio: (s, c) => safeDiv((s.pick ?? 0) + (s.ban ?? 0), c.universeGames),
    description: "(Picks + bans) / games in the selection.",
  },
  {
    key: "pickRate",
    label: "Pick rate",
    group: "draft",
    unit: "percent",
    kind: "ratio",
    sources: ["champions"],
    ratio: (s, c) => safeDiv(s.pick ?? 0, c.universeGames),
    description: "Picks / games in the selection.",
  },
  {
    key: "banRate",
    label: "Ban rate",
    group: "draft",
    unit: "percent",
    kind: "ratio",
    sources: ["champions"],
    ratio: (s, c) => safeDiv(s.ban ?? 0, c.universeGames),
    description: "Bans / games in the selection.",
  },
  // results
  {
    key: "winRate",
    label: "Win rate",
    group: "results",
    unit: "percent",
    kind: "ratio",
    sources: ["players", "teams", "champions"],
    rowFilter: picksOnly,
    ratio: (s) => safeDiv(s.win ?? 0, s.games ?? 0),
    perRow: (r) => r.win,
    description: "Wins / games (champions: wins / picks).",
  },
  {
    key: "blueWinRate",
    label: "Blue side win rate",
    group: "results",
    unit: "percent",
    kind: "ratio",
    sources: ["games"],
    ratio: (s) => safeDiv(s.blueWin ?? 0, s.games ?? 0),
    perRow: (r) => r.n.blueWin,
    description: "Share of games won by the blue side.",
  },
  {
    key: "wins",
    label: "Wins",
    group: "results",
    unit: "number",
    kind: "sum",
    sources: ["players", "teams", "champions"],
    // The result is a row field, not one of the `n` sums.
    perRow: (r) => r.win,
    rowFilter: picksOnly,
    description: "Games won.",
  },
  {
    key: "losses",
    label: "Losses",
    group: "results",
    unit: "number",
    kind: "sum",
    sources: ["players", "teams", "champions"],
    perRow: (r) => 1 - r.win,
    rowFilter: picksOnly,
    description: "Games lost.",
  },
  {
    key: "games",
    label: "Games",
    group: "results",
    unit: "number",
    kind: "count",
    sources: ["players", "teams", "champions", "games"],
    rowFilter: picksOnly,
    description: "Number of games.",
  },
];

export const MEASURE_GROUP_LABEL: Record<MeasureGroup, string> = {
  combat: "Combat",
  economy: "Economy",
  damage: "Damage",
  vision: "Vision",
  objectives: "Objectives",
  duration: "Duration",
  draft: "Draft",
  results: "Results",
};

export const measureByKey = new Map(MEASURES.map((m) => [m.key, m]));

export function measuresFor(source: DataSource): MeasureDef[] {
  return MEASURES.filter((m) => m.sources.includes(source));
}

/* ------------------------------------------------------------------ dimensions */

export interface DimensionDef {
  key: string;
  label: string;
  sources: DataSource[];
  /** Ordered dimensions can be drawn as lines. */
  ordered: boolean;
  entity: "player" | "team" | "champion" | null;
  keyOf: (row: BaseRow) => string | null;
  labelOf: (row: BaseRow) => string;
  order?: (a: { key: string; row: BaseRow }, b: { key: string; row: BaseRow }) => number;
}

const STAGE_ORDER: StageId[] = ["playin", "swiss", "quarterfinals", "semifinals", "final"];

export const DIMENSIONS: DimensionDef[] = [
  {
    key: "player",
    label: "Player",
    sources: PLAYERLIKE,
    ordered: false,
    entity: "player",
    keyOf: (r) => r.playerId,
    labelOf: (r) => r.player ?? "",
  },
  {
    key: "team",
    label: "Team",
    sources: ["players", "teams", "champions"],
    ordered: false,
    entity: "team",
    keyOf: (r) => r.teamId,
    labelOf: (r) => r.team,
  },
  {
    key: "region",
    label: "Region",
    sources: ["players", "teams", "champions"],
    ordered: false,
    entity: null,
    keyOf: (r) => r.region || null,
    labelOf: (r) => regionInfo(r.region).code,
  },
  {
    key: "role",
    label: "Role",
    sources: PLAYERLIKE,
    ordered: false,
    entity: null,
    keyOf: (r) => r.role,
    labelOf: (r) => (r.role ? ROLE_LABEL[r.role] : ""),
    order: (a, b) => ROLE_INDEX[a.key] - ROLE_INDEX[b.key],
  },
  {
    key: "champion",
    label: "Champion",
    sources: PLAYERLIKE,
    ordered: false,
    entity: "champion",
    keyOf: (r) => r.champion,
    labelOf: (r) => r.champion ?? "",
  },
  {
    key: "side",
    label: "Side",
    sources: ["players", "teams", "champions"],
    ordered: false,
    entity: null,
    keyOf: (r) => r.side,
    labelOf: (r) => (r.side === "blue" ? "Blue side" : "Red side"),
    order: (a) => (a.key === "blue" ? -1 : 1),
  },
  {
    key: "winnerSide",
    label: "Winning side",
    sources: ["games"],
    ordered: false,
    entity: null,
    keyOf: (r) => r.side,
    labelOf: (r) => (r.side === "blue" ? "Blue side" : "Red side"),
    order: (a) => (a.key === "blue" ? -1 : 1),
  },
  {
    key: "stage",
    label: "Stage",
    sources: ["players", "teams", "champions", "games"],
    ordered: true,
    entity: null,
    keyOf: (r) => r.stage,
    labelOf: (r) => STAGE_LABEL[r.stage],
    order: (a, b) => STAGE_ORDER.indexOf(a.key as StageId) - STAGE_ORDER.indexOf(b.key as StageId),
  },
  {
    key: "round",
    label: "Round",
    sources: ["players", "teams", "champions", "games"],
    ordered: true,
    entity: null,
    keyOf: (r) => (r.round ? `${r.stage}:${r.round}` : null),
    labelOf: (r) => `${r.stage === "playin" ? "PI" : "Swiss"} R${r.round}`,
    order: (a, b) =>
      STAGE_ORDER.indexOf(a.row.stage) - STAGE_ORDER.indexOf(b.row.stage) || (a.row.round ?? 0) - (b.row.round ?? 0),
  },
  {
    key: "day",
    label: "Day (UTC)",
    sources: ["players", "teams", "champions", "games"],
    ordered: true,
    entity: null,
    keyOf: (r) => r.day,
    labelOf: (r) => r.day.slice(5).replace("-", "/"),
    order: (a, b) => a.key.localeCompare(b.key),
  },
  {
    key: "gameNumber",
    label: "Game in series",
    sources: ["players", "teams", "champions", "games"],
    ordered: true,
    entity: null,
    keyOf: (r) => String(r.gameNumber),
    labelOf: (r) => `Game ${r.gameNumber}`,
    order: (a, b) => Number(a.key) - Number(b.key),
  },
  {
    key: "game",
    label: "Game",
    sources: ["players", "teams", "champions", "games"],
    ordered: true,
    entity: null,
    keyOf: (r) => r.gameId,
    labelOf: (r) =>
      `${STAGE_SHORT[r.stage]}${r.round ? ` R${r.round}` : ""} G${r.gameNumber}${r.opponent ? ` vs ${r.opponent}` : ""}`,
    order: (a, b) => a.row.time.localeCompare(b.row.time) || a.row.gameNumber - b.row.gameNumber,
  },
  {
    key: "result",
    label: "Result",
    sources: ["players", "teams"],
    ordered: false,
    entity: null,
    keyOf: (r) => (r.win ? "win" : "loss"),
    labelOf: (r) => (r.win ? "Wins" : "Losses"),
    order: (a) => (a.key === "win" ? -1 : 1),
  },
];

const ROLE_INDEX: Record<string, number> = { top: 0, jungle: 1, mid: 2, bot: 3, support: 4 };

export const dimensionByKey = new Map(DIMENSIONS.map((d) => [d.key, d]));

export function dimensionsFor(source: DataSource): DimensionDef[] {
  return DIMENSIONS.filter((d) => d.sources.includes(source));
}

/* ------------------------------------------------------------------ validation */

export const CHART_LABEL: Record<ChartType, string> = {
  bar: "Bars",
  groupedBar: "Grouped bars",
  stackedBar: "Stacked bars",
  line: "Line",
  scatter: "Scatter",
  radar: "Radar",
  heatmap: "Heat map",
  boxplot: "Box plot",
};

export const AGGREGATION_LABEL: Record<Aggregation, string> = {
  mean: "Average",
  median: "Median",
  sum: "Total",
  max: "Maximum",
  min: "Minimum",
  perGame: "Per game",
  perMinute: "Per minute",
};

/** Aggregations that make sense for a measure (ratios are already "over totals"). */
export function allowedAggregations(measure: MeasureDef): Aggregation[] {
  if (measure.kind === "count") return ["sum"];
  if (measure.kind === "ratio") return measure.perRow ? ["mean", "median", "max", "min"] : ["mean"];
  return ["mean", "median", "sum", "max", "min", "perGame", "perMinute"];
}

export const RADAR_MAX_ENTITIES = 4;

/** Explains why a configuration cannot be drawn; empty when it can. */
export function validateConfig(config: QueryConfig): string[] {
  return [...generalProblems(config), ...chartProblems(config, config.chart)];
}

/** Problems independent of the chart type (sources, aggregation, dimensions). */
export function generalProblems(config: QueryConfig): string[] {
  const problems: string[] = [];
  const measures = config.measures.map((k) => measureByKey.get(k)).filter((m): m is MeasureDef => !!m);
  const dim = dimensionByKey.get(config.groupBy);
  const series = config.series ? dimensionByKey.get(config.series) : null;
  if (measures.length === 0) problems.push("Pick at least one measure.");
  if (!dim) problems.push("Pick what to group by.");
  for (const m of measures) {
    if (!m.sources.includes(config.source)) problems.push(`${m.label} is not available for ${config.source}.`);
    if (!allowedAggregations(m).includes(config.aggregation)) {
      problems.push(
        `${AGGREGATION_LABEL[config.aggregation]} does not apply to ${m.label}: it is a ratio computed over totals (use average, median, maximum or minimum).`,
      );
    }
  }
  if (dim && !dim.sources.includes(config.source)) problems.push(`${dim.label} is not available for ${config.source}.`);
  if (config.series && !series) problems.push("Unknown series dimension.");
  if (series && dim && series.key === dim.key) problems.push("Series must differ from the group-by dimension.");
  return problems;
}

/** Why a given chart type cannot draw this configuration (empty when it can). */
export function chartProblems(config: QueryConfig, chart: ChartType): string[] {
  const problems: string[] = [];
  const measures = config.measures.map((k) => measureByKey.get(k)).filter((m): m is MeasureDef => !!m);
  const dim = dimensionByKey.get(config.groupBy);
  const units = new Set(measures.map((m) => m.unit));
  config = { ...config, chart };
  switch (config.chart) {
    case "bar":
    case "boxplot":
      if (measures.length !== 1) problems.push(`${CHART_LABEL[config.chart]} needs exactly one measure.`);
      if (config.series)
        problems.push(`${CHART_LABEL[config.chart]} cannot use a series dimension; choose grouped or stacked bars.`);
      if (config.chart === "boxplot" && measures[0] && measures[0].kind === "count")
        problems.push("Box plots need a per-game measure, not a count.");
      break;
    case "groupedBar":
    case "stackedBar":
      if (config.series) {
        if (measures.length !== 1)
          problems.push(`${CHART_LABEL[config.chart]} with a series dimension needs exactly one measure.`);
      } else if (measures.length < 2)
        problems.push(`${CHART_LABEL[config.chart]} needs a series dimension or at least two measures.`);
      else if (units.size > 1) problems.push("Measures on the same bars must share a unit (e.g. all percentages).");
      if (measures.length > 6) problems.push("At most six measures on one chart.");
      break;
    case "line":
      if (dim && !dim.ordered)
        problems.push("Lines need an ordered dimension on the X axis: stage, round, day or game in series.");
      if (config.series && measures.length !== 1)
        problems.push("A line chart with a series dimension needs exactly one measure.");
      if (!config.series && (measures.length < 1 || measures.length > 4))
        problems.push("Lines take one to four measures.");
      if (!config.series && units.size > 1) problems.push("Lines on the same axis must share a unit.");
      break;
    case "scatter":
      if (measures.length !== 2) problems.push("Scatter needs exactly two numeric measures (X and Y).");
      if (config.series) problems.push("Scatter cannot use a series dimension; use colour instead.");
      break;
    case "radar":
      if (measures.length < 3 || measures.length > 8) problems.push("Radar needs between three and eight measures.");
      if (config.series) problems.push("Radar cannot use a series dimension.");
      if (config.topN === null || config.topN > RADAR_MAX_ENTITIES)
        problems.push(
          `Radar shows at most ${RADAR_MAX_ENTITIES} entities: set Top N to ${RADAR_MAX_ENTITIES} or fewer.`,
        );
      break;
    case "heatmap":
      if (measures.length !== 1) problems.push("Heat maps need exactly one measure.");
      if (!config.series) problems.push("Heat maps need a series dimension for the columns (e.g. side).");
      break;
  }
  return problems;
}

/* ------------------------------------------------------------------ query */

export interface QueryRow {
  key: string;
  label: string;
  seriesKey: string | null;
  seriesLabel: string | null;
  /** Distinct games in the group. */
  games: number;
  values: Record<string, number | null>;
  /** Per-row values for box plots. */
  distribution: Record<string, number[]>;
  color: string | null;
  entity: { type: "player" | "team" | "champion"; id: string } | null;
}

export interface QueryResult {
  config: QueryConfig;
  measures: MeasureDef[];
  dimension: DimensionDef | null;
  seriesDimension: DimensionDef | null;
  rows: QueryRow[];
  /** Distinct series labels in display order (when a series dimension is set). */
  seriesLabels: string[];
  /** Measure values over the whole filtered universe (tournament average). */
  overall: Record<string, number | null>;
  /** Highest value of each measure among all groups, before Top N and the pick (scale of radars). */
  maxima: Record<string, number>;
  universeGames: number;
  emptyReason: string | null;
  problems: string[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Games are distinct game ids; minutes are summed per row (a player-game, team-game or game), so per-minute rates stay per entity. */
function contextOf(rows: BaseRow[], universeGames: number): GroupContext {
  const seen = new Set<string>();
  let minutes = 0;
  for (const r of rows) {
    seen.add(r.gameId);
    minutes += r.duration / 60;
  }
  return { games: seen.size, minutes, universeGames };
}

function sumsOf(rows: BaseRow[]): Record<string, number> {
  const sums: Record<string, number> = { win: 0 };
  for (const r of rows) {
    sums.win += r.win;
    for (const [k, v] of Object.entries(r.n)) sums[k] = (sums[k] ?? 0) + v;
  }
  return sums;
}

export function aggregateMeasure(
  measure: MeasureDef,
  rows: BaseRow[],
  ctx: GroupContext,
  aggregation: Aggregation,
): number | null {
  const subset = measure.rowFilter ? rows.filter(measure.rowFilter) : rows;
  if (measure.kind === "count") return contextOf(subset, ctx.universeGames).games;
  if (measure.kind === "ratio") {
    if (!subset.length) return null;
    if (aggregation === "mean" || !measure.perRow)
      return measure.ratio?.(sumsOf(subset), contextOf(subset, ctx.universeGames)) ?? null;
    const values = subset.map(measure.perRow).filter((v): v is number => v !== null);
    if (!values.length) return null;
    if (aggregation === "median") return median(values);
    if (aggregation === "max") return Math.max(...values);
    return Math.min(...values);
  }
  const values = subset.map((r) => (measure.perRow ? (measure.perRow(r) ?? 0) : (r.n[measure.field ?? ""] ?? 0)));
  if (!values.length) return null;
  const total = values.reduce((a, v) => a + v, 0);
  const sub = contextOf(subset, ctx.universeGames);
  switch (aggregation) {
    case "sum":
      return total;
    case "median":
      return median(values);
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    case "perGame":
      return safeDiv(total, sub.games);
    case "perMinute":
      return safeDiv(total, sub.minutes);
    default:
      return total / values.length;
  }
}

export function perRowValues(measure: MeasureDef, rows: BaseRow[]): number[] {
  const subset = measure.rowFilter ? rows.filter(measure.rowFilter) : rows;
  return subset
    .map((r) => (measure.perRow ? measure.perRow(r) : (r.n[measure.field ?? ""] ?? null)))
    .filter((v): v is number => v !== null);
}

interface FilterStep {
  name: string;
  active: boolean;
  test: (row: BaseRow) => boolean;
}

function filterSteps(f: QueryFilters, source: DataSource): FilterStep[] {
  return [
    { name: "stage", active: !!f.stages?.length, test: (r) => f.stages!.includes(r.stage) },
    {
      name: "team",
      active: !!f.teams?.length,
      test: (r) =>
        source === "games" ? f.teams!.some((t) => r.teamId.split("+").includes(t)) : f.teams!.includes(r.teamId),
    },
    {
      name: "player",
      active: !!f.players?.length,
      test: (r) => r.playerId !== null && f.players!.includes(r.playerId),
    },
    { name: "region", active: !!f.regions?.length, test: (r) => f.regions!.includes(r.region) },
    { name: "role", active: !!f.roles?.length, test: (r) => r.role !== null && f.roles!.includes(r.role) },
    { name: "side", active: !!f.side, test: (r) => r.side === f.side },
    {
      name: "result",
      active: !!f.result && source !== "games",
      test: (r) => (f.result === "win" ? r.win === 1 : r.win === 0),
    },
    {
      name: "champion",
      active: !!f.champions?.length,
      test: (r) => r.champion !== null && f.champions!.includes(r.champion),
    },
    {
      name: "game length",
      active: f.durationMin !== undefined || f.durationMax !== undefined,
      test: (r) =>
        (f.durationMin === undefined || r.duration >= f.durationMin) &&
        (f.durationMax === undefined || r.duration <= f.durationMax),
    },
  ];
}

function colorFor(config: QueryConfig, row: BaseRow, dim: DimensionDef | null): string | null {
  const by = config.colorBy;
  if (by === "region" || (by === "team" && row.region)) return `var(${regionInfo(row.region).cssVar})`;
  if (by === "role" && row.role) return `var(--viz-${ROLE_INDEX[row.role] + 1})`;
  if (by === "none" && dim?.key === "side") return row.side === "blue" ? "var(--side-blue)" : "var(--side-red)";
  if (by === "none" && dim?.key === "winnerSide") return row.side === "blue" ? "var(--side-blue)" : "var(--side-red)";
  return null;
}

export function runQuery(config: QueryConfig, data: IndexedDataset): QueryResult {
  const problems = validateConfig(config);
  const measures = config.measures.map((k) => measureByKey.get(k)).filter((m): m is MeasureDef => !!m);
  const dimension = dimensionByKey.get(config.groupBy) ?? null;
  const seriesDimension = config.series ? (dimensionByKey.get(config.series) ?? null) : null;
  const empty = (emptyReason: string | null): QueryResult => ({
    config,
    measures,
    dimension,
    seriesDimension,
    rows: [],
    seriesLabels: [],
    overall: {},
    maxima: {},
    universeGames: 0,
    emptyReason,
    problems,
  });
  if (problems.length || !dimension) return empty(null);

  // Filters, applied one by one so an empty result can name the culprit.
  let rows = buildRows(data, config.source);
  if (!rows.length) return empty("No games with published data yet.");
  for (const step of filterSteps(config.filters, config.source)) {
    if (!step.active) continue;
    const next = rows.filter(step.test);
    if (!next.length) return empty(`No games match the ${step.name} filter.`);
    rows = next;
  }
  const universe = contextOf(rows, 0);
  const universeGames = universe.games;
  const ctxAll: GroupContext = { ...universe, universeGames };

  // Grouping.
  type Group = {
    key: string;
    label: string;
    seriesKey: string | null;
    seriesLabel: string | null;
    rows: BaseRow[];
    first: BaseRow;
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const k = dimension.keyOf(r);
    if (k === null || k === "") continue;
    const sk = seriesDimension ? seriesDimension.keyOf(r) : null;
    if (seriesDimension && (sk === null || sk === "")) continue;
    const id = sk === null ? k : `${k}\u0000${sk}`;
    const g = groups.get(id);
    if (g) g.rows.push(r);
    else
      groups.set(id, {
        key: k,
        label: dimension.labelOf(r),
        seriesKey: sk,
        seriesLabel: seriesDimension && sk !== null ? seriesDimension.labelOf(r) : null,
        rows: [r],
        first: r,
      });
  }
  if (!groups.size) return empty(`Nothing to group by ${dimension.label} in the selection.`);

  let out: QueryRow[] = [];
  for (const g of groups.values()) {
    const ctx = { ...contextOf(g.rows, universeGames) };
    const values: Record<string, number | null> = {};
    const distribution: Record<string, number[]> = {};
    for (const m of measures) {
      values[m.key] = aggregateMeasure(m, g.rows, ctx, config.aggregation);
      if (config.chart === "boxplot") distribution[m.key] = perRowValues(m, g.rows);
    }
    out.push({
      key: g.key,
      label: g.label,
      seriesKey: g.seriesKey,
      seriesLabel: g.seriesLabel,
      games: ctx.games,
      values,
      distribution,
      color: colorFor(config, g.first, dimension),
      entity: dimension.entity ? { type: dimension.entity, id: g.key } : null,
    });
  }

  // Minimum games (entities only).
  if (dimension.entity && config.filters.minGames) {
    const kept = out.filter((r) => r.games >= config.filters.minGames!);
    if (!kept.length)
      return empty(
        `No ${dimension.label.toLowerCase()} has at least ${config.filters.minGames} games in the selection.`,
      );
    out = kept;
  }

  const maxima: Record<string, number> = {};
  for (const m of measures)
    maxima[m.key] = Math.max(0, ...out.map((r) => r.values[m.key]).filter((v): v is number => v !== null));
  if (config.pick?.length) {
    out = out.filter((r) => config.pick!.includes(r.key));
    if (!out.length) return empty(`None of the selected ${dimension.label.toLowerCase()} entries is in the selection.`);
  }

  // Order of the primary dimension (by first measure, or by the dimension's natural order).
  const firstKey = measures[0]?.key ?? "";
  const totalsByKey = new Map<string, number>();
  const firstRowByKey = new Map<string, BaseRow>();
  const gamesByKey = new Map<string, number>();
  // Stacked bars without a series are ranked by their full height, the sum of every measure.
  const rankKeys = config.chart === "stackedBar" && !seriesDimension ? measures.map((m) => m.key) : [firstKey];
  for (const r of out) {
    const value = rankKeys.reduce((a, k) => a + (r.values[k] ?? 0), 0);
    totalsByKey.set(r.key, (totalsByKey.get(r.key) ?? 0) + value);
    gamesByKey.set(r.key, (gamesByKey.get(r.key) ?? 0) + r.games);
    if (!firstRowByKey.has(r.key))
      firstRowByKey.set(r.key, groups.get(r.seriesKey === null ? r.key : `${r.key}\u0000${r.seriesKey}`)!.first);
  }
  const keys = Array.from(totalsByKey.keys());
  const labelOf = (k: string) => out.find((r) => r.key === k)?.label ?? k;
  if (dimension.ordered || config.sort === "label") {
    keys.sort((a, b) =>
      dimension.order
        ? dimension.order({ key: a, row: firstRowByKey.get(a)! }, { key: b, row: firstRowByKey.get(b)! })
        : labelOf(a).localeCompare(labelOf(b)),
    );
  } else {
    keys.sort(
      (a, b) =>
        (config.sort === "asc"
          ? totalsByKey.get(a)! - totalsByKey.get(b)!
          : totalsByKey.get(b)! - totalsByKey.get(a)!) ||
        // Ties: more games first (as the site's own rankings), then by name.
        gamesByKey.get(b)! - gamesByKey.get(a)! ||
        labelOf(a).localeCompare(labelOf(b)),
    );
  }
  const limit =
    config.chart === "radar" ? Math.min(config.topN ?? RADAR_MAX_ENTITIES, RADAR_MAX_ENTITIES) : config.topN;
  const keptKeys = limit ? keys.slice(0, limit) : keys;
  const keyIndex = new Map(keptKeys.map((k, i) => [k, i]));
  out = out.filter((r) => keyIndex.has(r.key));

  // Series order.
  let seriesLabels: string[] = [];
  if (seriesDimension) {
    const seriesKeys = Array.from(new Set(out.map((r) => r.seriesKey!)));
    const seriesFirst = new Map<string, BaseRow>();
    for (const g of groups.values())
      if (g.seriesKey !== null && !seriesFirst.has(g.seriesKey)) seriesFirst.set(g.seriesKey, g.first);
    seriesKeys.sort((a, b) =>
      seriesDimension.order
        ? seriesDimension.order({ key: a, row: seriesFirst.get(a)! }, { key: b, row: seriesFirst.get(b)! })
        : a.localeCompare(b),
    );
    const seriesIndex = new Map(seriesKeys.map((k, i) => [k, i]));
    out.sort(
      (a, b) =>
        keyIndex.get(a.key)! - keyIndex.get(b.key)! || seriesIndex.get(a.seriesKey!)! - seriesIndex.get(b.seriesKey!)!,
    );
    seriesLabels = seriesKeys.map((k) => out.find((r) => r.seriesKey === k)?.seriesLabel ?? k);
  } else {
    out.sort((a, b) => keyIndex.get(a.key)! - keyIndex.get(b.key)!);
  }

  const overall: Record<string, number | null> = {};
  for (const m of measures) overall[m.key] = aggregateMeasure(m, rows, ctxAll, config.aggregation);

  return {
    config,
    measures,
    dimension,
    seriesDimension,
    rows: out,
    seriesLabels,
    overall,
    maxima,
    universeGames,
    emptyReason: null,
    problems,
  };
}
