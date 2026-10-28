import { describe, expect, it } from "vitest";
import { indexDataset } from "./data/index";
import type { Dataset, Game, PlayerGame, Role } from "./data/types";
import { DEFAULT_CONFIG, buildRows, runQuery, validateConfig, type QueryConfig } from "./query";

const game = (
  id: string,
  blue: string,
  red: string,
  winnerSide: "blue" | "red",
  duration: number,
  blueBans: string[],
  redBans: string[],
): Game => ({
  id,
  seriesId: "s1",
  stage: "swiss",
  gameNumber: Number(id.slice(1)),
  dateTimeUtc: `2026-10-2${id.slice(1)}T18:00:00Z`,
  durationSeconds: duration,
  patch: "26.20",
  winnerSide,
  winnerTeamId: winnerSide === "blue" ? blue : red,
  blue: {
    teamId: blue,
    kills: 10,
    gold: 60000,
    towers: 8,
    inhibitors: 1,
    dragons: 3,
    elders: 0,
    barons: 1,
    heralds: 1,
    voidGrubs: 3,
    bans: blueBans,
    picks: [],
    lineup: null,
  },
  red: {
    teamId: red,
    kills: 5,
    gold: 50000,
    towers: 3,
    inhibitors: 0,
    dragons: 1,
    elders: 0,
    barons: 0,
    heralds: 0,
    voidGrubs: 3,
    bans: redBans,
    picks: [],
    lineup: null,
  },
  riotGameId: null,
  vodUrl: null,
  source: "leaguepedia",
  provisional: false,
  statsComplete: true,
});

const pg = (
  gameId: string,
  playerId: string,
  teamId: string,
  side: "blue" | "red",
  role: Role,
  champion: string,
  win: boolean,
  kills: number,
  damage: number,
  duration: number,
): PlayerGame => ({
  gameId,
  seriesId: "s1",
  stage: "swiss",
  playerId,
  teamId,
  opponentTeamId: teamId === "t1" ? "t2" : "t1",
  role,
  champion,
  side,
  win,
  kills,
  deaths: 2,
  assists: 4,
  gold: 12000,
  cs: 300,
  damageToChampions: damage,
  visionScore: 30,
  teamKills: side === "blue" ? 10 : 5,
  teamGold: side === "blue" ? 60000 : 50000,
  teamDamage: 40000,
  durationSeconds: duration,
  items: [],
  trinket: null,
  keystone: null,
  primaryTree: null,
  secondaryTree: null,
  runes: [],
  summonerSpells: [],
  pentakills: 0,
});

const dataset: Dataset = {
  meta: {
    schemaVersion: 1,
    updatedAt: "2026-10-27T00:00:00Z",
    tournamentId: "t",
    source: { name: "", url: "", license: "", transport: "" },
    ddragonVersion: "16.20.1",
    counts: { teams: 2, players: 4, series: 1, games: 2, playerGames: 8, drafts: 0 },
    pendingGameIds: [],
    warnings: [],
    sources: {
      lolesports: { enabled: false, fetchedAt: null, matchedSeries: 0, unmatchedEvents: 0, error: null },
      manual: { applied: [], superseded: [], invalid: [] },
    },
    provisional: { seriesIds: [], gameIds: [] },
    conflicts: 0,
  },
  tournament: {
    id: "t",
    name: "T",
    overviewPage: "T",
    dateStart: "2026-10-21",
    dateEnd: "2026-10-22",
    country: null,
    patch: "26.20",
    ddragonVersion: "16.20.1",
    officialUrl: null,
    stages: [],
  },
  teams: [
    {
      id: "t1",
      name: "Team One",
      short: "T1",
      page: "T1",
      region: "Korea",
      location: null,
      stages: ["main"],
      roster: [],
    },
    {
      id: "t2",
      name: "Team Two",
      short: "T2",
      page: "T2",
      region: "China",
      location: null,
      stages: ["main"],
      roster: [],
    },
  ],
  players: [
    {
      id: "a",
      name: "A",
      page: "A",
      teamId: "t1",
      role: "mid",
      country: null,
      realName: null,
      nativeName: null,
      residency: null,
      fromScoreboardOnly: false,
    },
    {
      id: "b",
      name: "B",
      page: "B",
      teamId: "t1",
      role: "top",
      country: null,
      realName: null,
      nativeName: null,
      residency: null,
      fromScoreboardOnly: false,
    },
    {
      id: "c",
      name: "C",
      page: "C",
      teamId: "t2",
      role: "mid",
      country: null,
      realName: null,
      nativeName: null,
      residency: null,
      fromScoreboardOnly: false,
    },
    {
      id: "d",
      name: "D",
      page: "D",
      teamId: "t2",
      role: "top",
      country: null,
      realName: null,
      nativeName: null,
      residency: null,
      fromScoreboardOnly: false,
    },
  ],
  series: [
    {
      id: "s1",
      matchId: "m",
      stage: "swiss",
      tab: "Round 1",
      round: 1,
      bestOf: 3,
      team1Id: "t1",
      team2Id: "t2",
      dateTimeUtc: "2026-10-21T18:00:00Z",
      hasTime: true,
      score: { team1: 1, team2: 1 },
      winnerId: null,
      status: "live",
      matchDay: 1,
      patch: null,
      streamUrl: null,
      mvp: null,
      gameIds: ["g1", "g2"],
      gamesPlayed: 2,
      source: "leaguepedia",
      provisional: false,
      lolesportsMatchId: null,
    },
  ],
  games: [
    game("g1", "t1", "t2", "blue", 1800, ["Zed"], ["Ahri"]),
    game("g2", "t2", "t1", "blue", 2400, ["Ahri"], ["Lux"]),
  ],
  drafts: [],
  playerGames: [
    pg("g1", "a", "t1", "blue", "mid", "Ahri", true, 6, 24000, 1800),
    pg("g1", "b", "t1", "blue", "top", "Gnar", true, 4, 15000, 1800),
    pg("g1", "c", "t2", "red", "mid", "Azir", false, 3, 18000, 1800),
    pg("g1", "d", "t2", "red", "top", "Rumble", false, 2, 12000, 1800),
    pg("g2", "a", "t1", "red", "mid", "Syndra", false, 2, 16000, 2400),
    pg("g2", "b", "t1", "red", "top", "Gnar", false, 3, 20000, 2400),
    pg("g2", "c", "t2", "blue", "mid", "Azir", true, 7, 30000, 2400),
    pg("g2", "d", "t2", "blue", "top", "Rumble", true, 3, 14000, 2400),
  ],
  champions: { version: "16.20.1", champions: [] },
};

const data = indexDataset(dataset);
const cfg = (o: Partial<QueryConfig>): QueryConfig => ({ ...DEFAULT_CONFIG, filters: {}, topN: null, ...o });

describe("buildRows", () => {
  it("builds one row per player-game, team-game, champion appearance and game", () => {
    expect(buildRows(data, "players")).toHaveLength(8);
    expect(buildRows(data, "teams")).toHaveLength(4);
    expect(buildRows(data, "champions")).toHaveLength(8 + 4);
    expect(buildRows(data, "games")).toHaveLength(2);
  });
  it("derives team damage and opponent kills for team rows", () => {
    const t1g1 = buildRows(data, "teams").find((r) => r.teamId === "t1" && r.gameId === "g1")!;
    expect(t1g1.n.damage).toBe(39000);
    expect(t1g1.n.deaths).toBe(5);
    expect(t1g1.win).toBe(1);
  });
});

describe("runQuery", () => {
  it("computes ratios over totals and sorts descending", () => {
    const res = runQuery(cfg({ source: "players", measures: ["dpm"], groupBy: "player" }), data);
    expect(res.emptyReason).toBeNull();
    expect(res.rows.map((r) => r.label)).toEqual(["C", "A", "B", "D"]);
    expect(res.rows[0].values.dpm).toBeCloseTo(48000 / 70);
    expect(res.rows[0].games).toBe(2);
    expect(res.overall.dpm).toBeCloseTo((24000 + 15000 + 18000 + 12000 + 16000 + 20000 + 30000 + 14000) / 280);
  });
  it("applies aggregations to sum-kind measures", () => {
    const by = (aggregation: QueryConfig["aggregation"]) =>
      runQuery(cfg({ measures: ["kills"], groupBy: "player", aggregation }), data).rows.find((r) => r.key === "a")!
        .values.kills;
    expect(by("sum")).toBe(8);
    expect(by("mean")).toBe(4);
    expect(by("max")).toBe(6);
    expect(by("min")).toBe(2);
    expect(by("median")).toBe(4);
    expect(by("perGame")).toBe(4);
    expect(by("perMinute")).toBeCloseTo(8 / 70);
  });
  it("names the filter that empties the selection", () => {
    const res = runQuery(cfg({ measures: ["kills"], groupBy: "player", filters: { stages: ["final"] } }), data);
    expect(res.rows).toHaveLength(0);
    expect(res.emptyReason).toContain("stage filter");
  });
  it("drops entities under the minimum games and explains it", () => {
    const ok = runQuery(cfg({ measures: ["kills"], groupBy: "player", filters: { minGames: 2 } }), data);
    expect(ok.rows).toHaveLength(4);
    const none = runQuery(cfg({ measures: ["kills"], groupBy: "player", filters: { minGames: 3 } }), data);
    expect(none.rows).toHaveLength(0);
    expect(none.emptyReason).toContain("at least 3 games");
  });
  it("filters by team, role, side and result", () => {
    const res = runQuery(
      cfg({
        measures: ["kills"],
        groupBy: "player",
        filters: { teams: ["t1"], roles: ["mid"], side: "blue", result: "win" },
      }),
      data,
    );
    expect(res.rows.map((r) => r.key)).toEqual(["a"]);
    expect(res.rows[0].values.kills).toBe(6);
  });
  it("computes team win rate per side as a pivot for heat maps", () => {
    const res = runQuery(
      cfg({ source: "teams", measures: ["winRate"], groupBy: "team", series: "side", chart: "heatmap" }),
      data,
    );
    expect(res.seriesLabels).toEqual(["Blue side", "Red side"]);
    const t1blue = res.rows.find((r) => r.key === "t1" && r.seriesKey === "blue")!;
    expect(t1blue.values.winRate).toBe(1);
    const t1red = res.rows.find((r) => r.key === "t1" && r.seriesKey === "red")!;
    expect(t1red.values.winRate).toBe(0);
  });
  it("computes champion presence against games in scope", () => {
    const res = runQuery(
      cfg({
        source: "champions",
        measures: ["picks", "bans"],
        groupBy: "champion",
        chart: "stackedBar",
        aggregation: "sum",
      }),
      data,
    );
    const ahri = res.rows.find((r) => r.key === "Ahri")!;
    expect(ahri.values.picks).toBe(1);
    expect(ahri.values.bans).toBe(2);
    const presence = runQuery(cfg({ source: "champions", measures: ["presence"], groupBy: "champion" }), data);
    expect(presence.rows.find((r) => r.key === "Ahri")!.values.presence).toBeCloseTo(3 / 2);
    expect(presence.universeGames).toBe(2);
    const wr = runQuery(cfg({ source: "champions", measures: ["winRate"], groupBy: "champion" }), data);
    expect(wr.rows.find((r) => r.key === "Ahri")!.values.winRate).toBe(1);
    expect(wr.rows.find((r) => r.key === "Zed")!.values.winRate).toBeNull();
  });
  it("supports the games source", () => {
    const res = runQuery(cfg({ source: "games", measures: ["duration"], groupBy: "gameNumber" }), data);
    expect(res.rows.map((r) => r.label)).toEqual(["Game 1", "Game 2"]);
    expect(res.rows[1].values.duration).toBe(2400);
    const blue = runQuery(cfg({ source: "games", measures: ["blueWinRate"], groupBy: "stage" }), data);
    expect(blue.overall.blueWinRate).toBe(1);
  });
  it("sorts by label, ascending and applies top N", () => {
    const asc = runQuery(cfg({ measures: ["kills"], groupBy: "player", sort: "asc" }), data);
    expect(asc.rows[0].key).toBe("d");
    const label = runQuery(cfg({ measures: ["kills"], groupBy: "player", sort: "label" }), data);
    expect(label.rows.map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
    const top = runQuery(cfg({ measures: ["kills"], groupBy: "player", topN: 2 }), data);
    expect(top.rows).toHaveLength(2);
  });
  it("keeps ordered dimensions in natural order", () => {
    const res = runQuery(cfg({ source: "teams", measures: ["kills"], groupBy: "day", sort: "desc" }), data);
    expect(res.rows.map((r) => r.key)).toEqual(["2026-10-21", "2026-10-22"]);
  });
  it("colours rows by region or role", () => {
    const region = runQuery(cfg({ measures: ["kills"], groupBy: "player", colorBy: "region" }), data);
    expect(region.rows.find((r) => r.key === "a")!.color).toBe("var(--region-lck)");
    const role = runQuery(cfg({ measures: ["kills"], groupBy: "player", colorBy: "role" }), data);
    expect(role.rows.find((r) => r.key === "b")!.color).toBe("var(--viz-1)");
  });
  it("returns problems instead of rows for invalid configs", () => {
    const res = runQuery(cfg({ measures: ["kills"], groupBy: "player", chart: "scatter" }), data);
    expect(res.rows).toHaveLength(0);
    expect(res.problems[0]).toMatch(/exactly two/);
  });
});

describe("validateConfig", () => {
  it("rejects aggregations that do not apply to ratios", () => {
    expect(validateConfig(cfg({ measures: ["kda"], groupBy: "player", aggregation: "sum" }))).toEqual([
      expect.stringContaining("does not apply"),
    ]);
    expect(validateConfig(cfg({ measures: ["kda"], groupBy: "player", aggregation: "median" }))).toEqual([]);
  });
  it("enforces chart-specific rules", () => {
    expect(validateConfig(cfg({ measures: ["kda", "dpm"], groupBy: "player", chart: "radar", topN: 4 }))).toEqual([
      expect.stringContaining("three and eight"),
    ]);
    expect(
      validateConfig(cfg({ measures: ["kda", "dpm", "cspm"], groupBy: "player", chart: "radar", topN: null })),
    ).toEqual([expect.stringContaining("at most 4")]);
    expect(validateConfig(cfg({ measures: ["kda"], groupBy: "player", chart: "line" }))).toEqual([
      expect.stringContaining("ordered dimension"),
    ]);
    expect(validateConfig(cfg({ measures: ["kda"], groupBy: "round", chart: "line" }))).toEqual([]);
    expect(validateConfig(cfg({ measures: ["kda"], groupBy: "team", chart: "heatmap" }))).toEqual([
      expect.stringContaining("series dimension"),
    ]);
    expect(validateConfig(cfg({ measures: ["kda", "kp"], groupBy: "player", chart: "groupedBar" }))).toEqual([
      expect.stringContaining("share a unit"),
    ]);
    expect(validateConfig(cfg({ measures: ["kp", "winRate"], groupBy: "player", chart: "groupedBar" }))).toEqual([]);
  });
  it("rejects measures and dimensions from another source", () => {
    expect(validateConfig(cfg({ source: "games", measures: ["kda"], groupBy: "player" }))).toHaveLength(2);
  });
});
