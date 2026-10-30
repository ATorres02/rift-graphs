import { describe, expect, it } from "vitest";
import { indexDataset } from "@/lib/data/index";
import { readDataset } from "@/lib/data/load";
import { aggregateChampions, aggregateTeamGames } from "@/lib/metrics";
import { runQuery, validateConfig, type QueryConfig } from "@/lib/query";
import {
  championPresenceChart,
  championRecordChart,
  championRolesChart,
  championStagesChart,
  chartHref,
  compareChart,
  playerGamesChart,
  teamProfileChart,
  teamsStyleChart,
} from "./page-charts";
import { parseConfig } from "./url";

const data = indexDataset(readDataset());
const pg = data.playerGames[0];
const player = data.playersById.get(pg.playerId)!;
const otherPlayer = data.players.find((p) => p.id !== player.id && data.playerGamesByPlayer.get(p.id)?.length)!;
const champion = pg.champion;
const team = data.teamsById.get(pg.teamId)!;
const otherTeam = data.teams.find((t) => t.id !== team.id && data.playerGamesByTeam.get(t.id)?.length)!;

const PAGE_CHARTS: [string, QueryConfig][] = [
  ["champion presence", championPresenceChart()],
  ["champion by role", championRolesChart(champion)],
  ["champion by stage", championStagesChart(champion)],
  ["teams scatter", teamsStyleChart()],
  ["team radar", teamProfileChart(team.id, team.short)],
  ["team champions", championRecordChart({ teamId: team.id }, team.short, 10)],
  ["player DPM", playerGamesChart(player.id, player.name, "dpm", "damage per minute")],
  ["player KDA", playerGamesChart(player.id, player.name, "kda", "KDA")],
  ["player champions", championRecordChart({ playerId: player.id }, player.name, null)],
  ["compare teams", compareChart("teams", team.id, otherTeam.id, ["winRate", "killsPerGame", "goldPerMinute"])],
  ["compare players", compareChart("players", player.id, otherPlayer.id, ["kda", "kp", "cspm", "dpm"])],
];

describe("page charts in the builder", () => {
  it.each(PAGE_CHARTS)("%s is a valid builder chart with data", (_, config) => {
    expect(validateConfig(config)).toEqual([]);
    const result = runQuery(config, data);
    expect(result.emptyReason).toBeNull();
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it.each(PAGE_CHARTS)("%s survives the link", (_, config) => {
    const href = chartHref(config);
    expect(parseConfig(new URLSearchParams(href.split("?")[1]))).toEqual(config);
  });

  it("keeps the tournament average and the scale when a radar shows one team", () => {
    const result = runQuery(teamProfileChart(team.id, team.short), data);
    expect(result.rows.map((r) => r.key)).toEqual([team.id]);
    const agg = aggregateTeamGames(data.confirmedGames, team.id);
    expect(result.rows[0].values.winRate).toBeCloseTo(agg.winRate, 6);
    expect(result.rows[0].values.kills).toBeCloseTo(agg.killsPerGame, 6);
    // The average and the axis maxima come from every team, not only the one shown.
    expect(result.overall.winRate).toBeCloseTo(0.5, 6);
    expect(result.maxima.winRate).toBeGreaterThanOrEqual(result.rows[0].values.winRate!);
  });

  it("counts wins and losses per champion, ranked by games", () => {
    const result = runQuery(championRecordChart({ teamId: team.id }, team.short, null), data);
    const games = (data.playerGamesByTeam.get(team.id) ?? []).length;
    const total = result.rows.reduce((a, r) => a + (r.values.wins ?? 0) + (r.values.losses ?? 0), 0);
    expect(total).toBe(games);
    expect(result.rows.some((r) => (r.values.wins ?? 0) > 0)).toBe(true);
    const heights = result.rows.map((r) => (r.values.wins ?? 0) + (r.values.losses ?? 0));
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it("ranks champion presence like the champions page", () => {
    const result = runQuery(championPresenceChart(), data);
    const top = aggregateChampions(data.confirmedGames, data.playerGames)
      .sort((a, b) => b.picks + b.bans - (a.picks + a.bans))
      .slice(0, 3)
      .map((c) => c.picks + c.bans);
    expect(result.rows.slice(0, 3).map((r) => (r.values.picks ?? 0) + (r.values.bans ?? 0))).toEqual(top);
  });

  it("draws a player's games in order, one point per game", () => {
    const result = runQuery(playerGamesChart(player.id, player.name, "dpm", "damage per minute"), data);
    expect(result.rows).toHaveLength((data.playerGamesByPlayer.get(player.id) ?? []).length);
    expect(result.rows[0].label).toMatch(/G\d+ vs /);
  });
});
