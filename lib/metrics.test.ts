import { describe, expect, it } from "vitest";
import type { Game, GameTeamStats, PlayerGame } from "./data/types";
import {
  aggregateByPlayer,
  aggregateChampions,
  aggregatePlayerGames,
  aggregateTeamGames,
  kda,
  killParticipation,
  perMinute,
  rankPlayers,
  seriesRecord,
  share,
} from "./metrics";

const pg = (o: Partial<PlayerGame> = {}): PlayerGame => ({
  gameId: "g1",
  seriesId: "s1",
  stage: "swiss",
  playerId: "p1",
  teamId: "t1",
  opponentTeamId: "t2",
  role: "mid",
  champion: "Ahri",
  side: "blue",
  win: true,
  kills: 5,
  deaths: 2,
  assists: 7,
  gold: 15000,
  cs: 300,
  damageToChampions: 24000,
  visionScore: 40,
  teamKills: 20,
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

const game = (o: Partial<Game> = {}): Game => ({
  id: "g1",
  seriesId: "s1",
  stage: "swiss",
  gameNumber: 1,
  dateTimeUtc: "2026-10-23T18:00:00Z",
  durationSeconds: 1800,
  patch: "26.20",
  winnerSide: "blue",
  winnerTeamId: "t1",
  blue: stats("t1"),
  red: stats("t2"),
  riotGameId: null,
  vodUrl: null,
  source: "leaguepedia",
  provisional: false,
  statsComplete: true,
  ...o,
});

describe("primitives", () => {
  it("computes KDA with a floor of one death", () => {
    expect(kda(5, 2, 7)).toBe(6);
    expect(kda(3, 0, 1)).toBe(4);
  });
  it("computes kill participation as a fraction", () => {
    expect(killParticipation(5, 7, 20)).toBeCloseTo(0.6);
    expect(killParticipation(5, 7, 0)).toBeNull();
  });
  it("computes per-minute rates", () => {
    expect(perMinute(300, 1800)).toBe(10);
    expect(perMinute(300, 0)).toBe(0);
  });
  it("computes shares", () => {
    expect(share(15000, 60000)).toBe(0.25);
    expect(share(1, 0)).toBeNull();
  });
});

describe("aggregatePlayerGames", () => {
  const rows = [
    pg(),
    pg({
      gameId: "g2",
      win: false,
      kills: 2,
      deaths: 4,
      assists: 3,
      cs: 400,
      gold: 17000,
      damageToChampions: 20000,
      visionScore: 60,
      teamKills: 10,
      teamGold: 70000,
      teamDamage: 70000,
      durationSeconds: 2400,
      champion: "Azir",
    }),
  ];
  const agg = aggregatePlayerGames(rows);

  it("counts games and wins", () => {
    expect(agg.games).toBe(2);
    expect(agg.wins).toBe(1);
    expect(agg.winRate).toBe(0.5);
  });
  it("uses totals for ratios", () => {
    expect(agg.kda).toBeCloseTo(17 / 6);
    expect(agg.killParticipation).toBeCloseTo(17 / 30);
    expect(agg.cspm).toBeCloseTo(700 / 70);
    expect(agg.dpm).toBeCloseTo(44000 / 70);
    expect(agg.gpm).toBeCloseTo(32000 / 70);
    expect(agg.visionPerMinute).toBeCloseTo(100 / 70);
    expect(agg.goldShare).toBeCloseTo(32000 / 130000);
    expect(agg.damageShare).toBeCloseTo(44000 / 150000);
  });
  it("lists champions by games played", () => {
    expect(agg.champions).toEqual([
      { champion: "Ahri", games: 1, wins: 1 },
      { champion: "Azir", games: 1, wins: 0 },
    ]);
  });
  it("handles an empty sample", () => {
    const empty = aggregatePlayerGames([]);
    expect(empty.games).toBe(0);
    expect(empty.kda).toBe(0);
    expect(empty.killParticipation).toBeNull();
    expect(empty.goldShare).toBeNull();
  });
});

describe("aggregateTeamGames", () => {
  const games = [
    game({ blue: stats("t1", { dragons: 3 }), red: stats("t2", { dragons: 1, barons: 0 }) }),
    game({
      id: "g2",
      durationSeconds: 2400,
      winnerSide: "blue",
      winnerTeamId: "t3",
      blue: stats("t3", { dragons: 4, kills: 15 }),
      red: stats("t1", { dragons: 1, kills: 5, barons: 0 }),
    }),
    game({ id: "g3", blue: stats("t4"), red: stats("t5") }),
  ];
  const agg = aggregateTeamGames(games, "t1");

  it("only counts the team's games", () => {
    expect(agg.games).toBe(2);
    expect(agg.wins).toBe(1);
    expect(agg.losses).toBe(1);
    expect(agg.winRate).toBe(0.5);
  });
  it("splits by side", () => {
    expect(agg.blue).toEqual({ games: 1, wins: 1, winRate: 1 });
    expect(agg.red).toEqual({ games: 1, wins: 0, winRate: 0 });
  });
  it("averages duration and objectives", () => {
    expect(agg.avgDurationSeconds).toBe(2100);
    expect(agg.killsPerGame).toBe(7.5);
    expect(agg.deathsPerGame).toBe(12.5);
    expect(agg.dragonsPerGame).toBe(2);
    expect(agg.dragonControl).toBeCloseTo(4 / 9);
    expect(agg.baronControl).toBeCloseTo(1 / 2);
    expect(agg.goldPerMinute).toBeCloseTo(120000 / 70);
  });
  it("returns zeros and nulls for a team without games", () => {
    const none = aggregateTeamGames(games, "nobody");
    expect(none.games).toBe(0);
    expect(none.dragonControl).toBeNull();
    expect(none.avgDurationSeconds).toBe(0);
  });
});

describe("aggregateChampions", () => {
  const games = [
    game({
      blue: stats("t1", { picks: ["Ahri", "Jinx"], bans: ["Zed"] }),
      red: stats("t2", { picks: ["Azir"], bans: ["Ahri"] }),
    }),
    game({
      id: "g2",
      winnerSide: "red",
      winnerTeamId: "t2",
      blue: stats("t1", { picks: ["Azir"], bans: ["Lux"] }),
      red: stats("t2", { picks: ["Jinx"], bans: ["Zed"] }),
    }),
  ];
  const rows = [
    pg({ champion: "Ahri", role: "mid", win: true }),
    pg({ gameId: "g2", champion: "Azir", role: "mid", win: false }),
    pg({ champion: "Azir", role: "mid", win: false, side: "red", playerId: "p2" }),
  ];
  const champs = aggregateChampions(games, rows);
  const by = Object.fromEntries(champs.map((c) => [c.champion, c]));

  it("counts picks, bans and presence per game", () => {
    expect(by.Ahri).toMatchObject({ picks: 1, bans: 1, presence: 1, pickRate: 0.5, banRate: 0.5, wins: 1, winRate: 1 });
    expect(by.Zed).toMatchObject({ picks: 0, bans: 2, presence: 1, winRate: null });
    expect(by.Jinx).toMatchObject({ picks: 2, bans: 0, wins: 2, winRate: 1 });
    expect(by.Azir).toMatchObject({ picks: 2, wins: 0, winRate: 0 });
  });
  it("tracks roles from player rows", () => {
    expect(by.Azir.byRole.mid).toEqual({ games: 2, wins: 0 });
    expect(by.Ahri.byRole.mid).toEqual({ games: 1, wins: 1 });
  });
  it("sorts by presence", () => {
    expect(champs[0].presence).toBeGreaterThanOrEqual(champs[champs.length - 1].presence);
  });
});

describe("rankPlayers", () => {
  const rows = [
    ...[1, 2, 3].map((i) => pg({ gameId: `g${i}`, playerId: "steady", kills: 3, deaths: 1, assists: 3 })),
    pg({ gameId: "g9", playerId: "one-game-wonder", kills: 20, deaths: 0, assists: 10 }),
  ];
  const byPlayer = aggregateByPlayer(rows);
  it("drops players below the minimum games threshold", () => {
    const ranked = rankPlayers(byPlayer, (a) => a.kda);
    expect(ranked.map((r) => r.playerId)).toEqual(["steady"]);
  });
  it("respects a custom threshold and limit", () => {
    const ranked = rankPlayers(byPlayer, (a) => a.kda, { minGames: 1, limit: 1 });
    expect(ranked[0].playerId).toBe("one-game-wonder");
  });
});

describe("seriesRecord", () => {
  it("counts finished series only", () => {
    const series = [
      { id: "a", status: "finished", winnerId: "t1", team1Id: "t1", team2Id: "t2" },
      { id: "b", status: "finished", winnerId: "t3", team1Id: "t3", team2Id: "t1" },
      { id: "c", status: "scheduled", winnerId: null, team1Id: "t1", team2Id: "t4" },
    ] as unknown as Parameters<typeof seriesRecord>[0];
    expect(seriesRecord(series, "t1")).toEqual({ wins: 1, losses: 1 });
  });
});
