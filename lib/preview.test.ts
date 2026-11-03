import { describe, expect, it } from "vitest";
import { indexDataset } from "./data/index";
import type { Dataset, Game, GameTeamStats, PlayerGame, Team } from "./data/types";
import {
  barShare,
  championPool,
  formatPreview,
  laneMatchups,
  leader,
  previewRound,
  showsPreview,
  teamMatchup,
  type PreviewMetric,
} from "./preview";

const stats = (teamId: string, o: Partial<GameTeamStats> = {}): GameTeamStats => ({
  teamId,
  kills: 10,
  gold: 60000,
  towers: 8,
  inhibitors: 1,
  dragons: 2,
  elders: 0,
  barons: 1,
  heralds: 1,
  voidGrubs: 3,
  bans: [],
  picks: [],
  lineup: null,
  ...o,
});

const game = (id: string, blue: GameTeamStats, red: GameTeamStats, o: Partial<Game> = {}): Game => ({
  id,
  seriesId: "s1",
  stage: "swiss",
  gameNumber: 1,
  dateTimeUtc: "2026-10-23T18:00:00Z",
  durationSeconds: 1800,
  patch: "26.20",
  winnerSide: "blue",
  winnerTeamId: blue.teamId,
  blue,
  red,
  riotGameId: null,
  vodUrl: null,
  source: "leaguepedia",
  provisional: false,
  statsComplete: true,
  ...o,
});

const pg = (o: Partial<PlayerGame>): PlayerGame => ({
  gameId: "g1",
  seriesId: "s1",
  stage: "swiss",
  playerId: "p1",
  teamId: "a",
  opponentTeamId: "b",
  role: "top",
  champion: "Rumble",
  side: "blue",
  win: true,
  kills: 3,
  deaths: 1,
  assists: 4,
  gold: 12000,
  cs: 270,
  damageToChampions: 18000,
  visionScore: 30,
  teamKills: 14,
  teamGold: 60000,
  teamDamage: 80000,
  durationSeconds: 1800,
  items: [],
  trinket: null,
  keystone: null,
  primaryTree: null,
  secondaryTree: null,
  runes: [],
  summonerSpells: [],
  pentakills: 0,
  ...o,
});

const team = (id: string, roster: Team["roster"] = []): Team => ({
  id,
  name: id.toUpperCase(),
  short: id.toUpperCase(),
  page: id,
  region: "Korea",
  location: null,
  stages: ["main"],
  roster,
  coaches: [],
  seed: null,
});

function dataset(games: Game[], playerGames: PlayerGame[], teams: Team[]) {
  return indexDataset({
    teams,
    players: [
      { id: "p1", name: "One" },
      { id: "p2", name: "Two" },
      { id: "p3", name: "Three" },
    ].map((p) => ({
      ...p,
      page: p.name,
      teamId: "a",
      role: "top" as const,
      country: null,
      realName: null,
      nativeName: null,
      residency: null,
      fromScoreboardOnly: false,
    })),
    series: [],
    games,
    drafts: [],
    playerGames,
    champions: { version: "16.20.1", champions: [] },
  } as unknown as Dataset);
}

const metric = (o: Partial<PreviewMetric>): PreviewMetric => ({
  key: "k",
  label: "K",
  format: "dec1",
  a: 1,
  b: 2,
  max: 2,
  min: 0,
  avg: 1.5,
  better: "higher",
  ...o,
});

describe("formatPreview", () => {
  it("formats each kind of value", () => {
    expect(formatPreview(612.6, "int")).toBe("613");
    expect(formatPreview(0.625, "pct")).toBe("63%");
    expect(formatPreview(1859.7, "time")).toBe("31:00");
    expect(formatPreview(null, "dec1")).toBe("–");
    expect(formatPreview(1612.6, "signed")).toBe("+1613");
    expect(formatPreview(-149.2, "signed")).toBe("-149");
  });
});

describe("barShare", () => {
  it("runs from zero, or from the lowest in the group for a signed difference", () => {
    expect(barShare(metric({ max: 4 }), 1)).toBe(0.25);
    expect(barShare(metric({ min: -800, max: 1600, format: "signed" }), -200)).toBe(0.25);
    expect(barShare(metric({}), null)).toBe(0);
  });
});

describe("leader", () => {
  it("picks the higher or the lower value depending on the metric", () => {
    expect(leader(metric({ a: 3, b: 2 }))).toBe("a");
    expect(leader(metric({ a: 3, b: 2, better: "lower" }))).toBe("b");
  });
  it("has no leader when the rounded values match, a value is missing, or neither is better", () => {
    expect(leader(metric({ a: 2.01, b: 2.04 }))).toBeNull();
    expect(leader(metric({ a: null }))).toBeNull();
    expect(leader(metric({ better: null }))).toBeNull();
  });
});

describe("teamMatchup", () => {
  const games = [
    game("g1", stats("a", { kills: 20, dragons: 3 }), stats("b", { kills: 10, dragons: 1 })),
    game("g2", stats("c", { kills: 30 }), stats("a", { kills: 6 }), { winnerSide: "blue", winnerTeamId: "c" }),
    game("g3", stats("b", { kills: 50 }), stats("c"), { provisional: true }),
  ];
  const data = dataset(games, [], [team("a"), team("b"), team("c")]);
  const m = teamMatchup(data, "a", "b");

  it("compares the two teams on confirmed games only", () => {
    expect(m.games).toEqual({ a: 2, b: 1 });
    const kills = m.metrics.find((x) => x.key === "killsPerGame")!;
    expect(kills.a).toBe(13);
    expect(kills.b).toBe(10);
  });
  it("scales to the best team in the tournament and averages every team", () => {
    const kills = m.metrics.find((x) => x.key === "killsPerGame")!;
    expect(kills.max).toBe(30);
    expect(kills.avg).toBeCloseTo((13 + 10 + 30) / 3);
  });
  it("keeps win rates apart", () => {
    expect(m.results.map((x) => x.key)).toEqual(["winRate", "blueWinRate", "redWinRate"]);
    expect(m.results[0].a).toBe(0.5);
    expect(m.results[2].b).toBe(0);
  });
});

describe("laneMatchups", () => {
  const games = [
    game("g1", stats("a"), stats("b")),
    game("g2", stats("a"), stats("b")),
    game("g3", stats("a"), stats("b")),
  ];
  const rows = [
    pg({ gameId: "g1", playerId: "p1", champion: "Rumble" }),
    pg({ gameId: "g2", playerId: "p1", champion: "Rumble" }),
    pg({ gameId: "g3", playerId: "p2", champion: "Gnar" }),
  ];
  const data = dataset(games, rows, [team("a"), team("b", [{ playerId: "p3", role: "top" }])]);
  const top = laneMatchups(data, "a", "b")[0];

  it("puts the player with the most games in the role", () => {
    expect(top.role).toBe("top");
    expect(top.a).toMatchObject({ playerId: "p1", games: 2, champions: [{ champion: "Rumble", count: 2 }] });
  });
  it("falls back to the roster for a team without scoreboard rows", () => {
    expect(top.b).toMatchObject({ playerId: "p3", games: 0, champions: [] });
    expect(top.metrics[0].b).toBeNull();
  });
  it("uses CS per minute in lane and vision per minute for supports", () => {
    const lanes = laneMatchups(data, "a", "b");
    expect(lanes[0].metrics.map((x) => x.key)).toEqual(["kda", "kp", "dpm", "goldDiffAt15", "cspm"]);
    expect(lanes[4].metrics.map((x) => x.key)).toEqual(["kda", "kp", "dpm", "goldDiffAt15", "vspm"]);
  });
});

describe("championPool", () => {
  it("counts the team's picks and the bans made against it", () => {
    const games = [
      game("g1", stats("a", { picks: ["Rumble", "Vi"], bans: ["Azir"] }), stats("b", { bans: ["Yone", "Yone"] })),
      game("g2", stats("b", { bans: ["Yone", "Orianna"] }), stats("a", { picks: ["Rumble"], bans: ["Vi"] })),
    ];
    const pool = championPool(games, "a");
    expect(pool.games).toBe(2);
    expect(pool.played).toEqual([
      { champion: "Rumble", count: 2 },
      { champion: "Vi", count: 1 },
    ]);
    expect(pool.bannedAgainst).toEqual([
      { champion: "Yone", count: 2 },
      { champion: "Orianna", count: 1 },
    ]);
  });
});

describe("showsPreview", () => {
  it("previews a series until its first game is in", () => {
    expect(showsPreview({ status: "scheduled", gamesPlayed: 0 }, 0)).toBe(true);
    expect(showsPreview({ status: "live", gamesPlayed: 0 }, 0)).toBe(true);
    expect(showsPreview({ status: "live", gamesPlayed: 1 }, 0)).toBe(false);
    expect(showsPreview({ status: "live", gamesPlayed: 1 }, 1)).toBe(false);
    expect(showsPreview({ status: "finished", gamesPlayed: 3 }, 3)).toBe(false);
  });
});

describe("previewRound", () => {
  it("names the round in the singular", () => {
    expect(previewRound("quarterfinals", null)).toBe("quarterfinal");
    expect(previewRound("final", null)).toBe("final");
    expect(previewRound("swiss", 5)).toBe("Swiss Round 5");
  });
});
