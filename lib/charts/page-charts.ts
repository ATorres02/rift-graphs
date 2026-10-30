/**
 * Chart builder configurations that reproduce the charts drawn on other pages, behind their "Open in Charts" links.
 * Safe to import from client components (the comparison tool builds its link in the browser).
 */
import { DEFAULT_MIN_GAMES } from "@/lib/metrics";
import { DEFAULT_CONFIG, type QueryConfig } from "@/lib/query";
import { serializeConfig } from "./url";

export function chartHref(config: QueryConfig): string {
  return `/charts?${serializeConfig(config)}`;
}

const config = (patch: Partial<QueryConfig>): QueryConfig => ({
  ...DEFAULT_CONFIG,
  filters: {},
  aggregation: "mean",
  topN: null,
  colorBy: "none",
  showAverage: false,
  ...patch,
});

/** /champions: picks and bans of the 20 most present champions. */
export const championPresenceChart = () =>
  config({
    source: "champions",
    measures: ["picks", "bans"],
    groupBy: "champion",
    aggregation: "sum",
    chart: "stackedBar",
    topN: 20,
    title: "Presence: picks + bans",
  });

/** /champions/[id]: wins and losses per role. */
export const championRolesChart = (champion: string) =>
  config({
    source: "champions",
    measures: ["wins", "losses"],
    groupBy: "role",
    aggregation: "sum",
    filters: { champions: [champion] },
    chart: "stackedBar",
    sort: "label",
    title: `${champion} by role`,
  });

/** /champions/[id]: wins, losses and bans per stage. */
export const championStagesChart = (champion: string) =>
  config({
    source: "champions",
    measures: ["wins", "losses", "bans"],
    groupBy: "stage",
    aggregation: "sum",
    filters: { champions: [champion] },
    chart: "stackedBar",
    title: `${champion} by stage`,
  });

/** /teams: average game length against game win rate, one point per team. */
export const teamsStyleChart = () =>
  config({
    source: "teams",
    measures: ["duration", "winRate"],
    groupBy: "team",
    chart: "scatter",
    colorBy: "region",
    showAverage: true,
    title: "Game length vs win rate",
  });

/** Team metrics on the team page radar and the team comparison, in builder measures. */
export const TEAM_RADAR_MEASURES: Record<string, string> = {
  winRate: "winRate",
  killsPerGame: "kills",
  goldPerMinute: "gpm",
  towersPerGame: "towers",
  dragonControl: "dragonControl",
  baronControl: "baronControl",
};

/** /teams/[id]: the team against the tournament average, every axis scaled to the best team. */
export const teamProfileChart = (teamId: string, short: string) =>
  config({
    source: "teams",
    measures: Object.values(TEAM_RADAR_MEASURES),
    groupBy: "team",
    chart: "radar",
    pick: [teamId],
    topN: 1,
    colorBy: "region",
    showAverage: true,
    title: `${short} vs tournament average`,
  });

/** /teams/[id] and /players/[id]: wins and losses per champion. */
export const championRecordChart = (
  filter: { teamId?: string; playerId?: string },
  owner: string,
  topN: number | null,
) =>
  config({
    source: "players",
    measures: ["wins", "losses"],
    groupBy: "champion",
    aggregation: "sum",
    filters: filter.playerId ? { players: [filter.playerId] } : { teams: [filter.teamId!] },
    chart: "stackedBar",
    topN,
    title: `${owner}: champions played`,
  });

/** /players/[id]: one measure game by game, with the player's average as the reference line. */
export const playerGamesChart = (playerId: string, name: string, measure: "dpm" | "vision" | "kda", label: string) =>
  config({
    source: "players",
    measures: [measure],
    groupBy: "game",
    filters: { players: [playerId] },
    chart: "line",
    showAverage: true,
    title: `${name}: ${label} by game`,
  });

/** /compare: two teams or two players on the radar metrics, scaled to the best in the tournament. */
export const compareChart = (type: "teams" | "players", a: string, b: string, metricKeys: string[]) =>
  config({
    source: type,
    measures: metricKeys.map((k) => (type === "teams" ? (TEAM_RADAR_MEASURES[k] ?? k) : k)),
    groupBy: type === "teams" ? "team" : "player",
    chart: "radar",
    pick: [a, b],
    topN: 2,
    colorBy: "region",
  });

/** Homepage tiles: the top 10 players on one measure, among those with enough games (as the tiles rank them). */
export const playerRankingChart = (measure: "kda" | "dpm" | "kp", label: string) =>
  config({
    source: "players",
    measures: [measure],
    groupBy: "player",
    filters: { minGames: DEFAULT_MIN_GAMES },
    chart: "bar",
    topN: 10,
    colorBy: "region",
    showAverage: true,
    title: `Top 10 players by ${label}`,
  });

/** Homepage strip: average game length in each Swiss round. */
export const gameLengthByRoundChart = () =>
  config({
    source: "games",
    measures: ["duration"],
    groupBy: "round",
    filters: { stages: ["swiss"] },
    chart: "line",
    title: "Average game length by Swiss round",
  });

/** Homepage strip: kills per game by region. */
export const killsByRegionChart = () =>
  config({
    source: "teams",
    measures: ["kills"],
    groupBy: "region",
    chart: "bar",
    colorBy: "region",
    showAverage: true,
    title: "Kills per game by region",
  });
