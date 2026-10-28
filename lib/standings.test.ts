import { describe, expect, it } from "vitest";
import type { Series, Team } from "./data/types";
import { swissGroups, swissStandings, teamStatus } from "./standings";

const s = (o: Partial<Series>): Series =>
  ({
    id: "s",
    matchId: "m",
    stage: "swiss",
    tab: "Round 1",
    round: 1,
    bestOf: 1,
    team1Id: "a",
    team2Id: "b",
    dateTimeUtc: "2026-10-23T18:00:00Z",
    hasTime: true,
    score: null,
    winnerId: "a",
    status: "finished",
    matchDay: 1,
    patch: null,
    streamUrl: null,
    mvp: null,
    gameIds: [],
    gamesPlayed: 1,
    ...o,
  }) as Series;

const series: Series[] = [
  s({ id: "r1a", round: 1, team1Id: "a", team2Id: "b", winnerId: "a" }),
  s({ id: "r1b", round: 1, team1Id: "c", team2Id: "d", winnerId: "d" }),
  s({ id: "r2a", round: 2, team1Id: "a", team2Id: "d", winnerId: "a" }),
  s({ id: "r2b", round: 2, team1Id: "b", team2Id: "c", winnerId: "b" }),
  s({ id: "r3a", round: 3, team1Id: "a", team2Id: "b", winnerId: "a", bestOf: 3 }),
  s({ id: "r3b", round: 3, team1Id: "c", team2Id: "d", winnerId: "d", bestOf: 3 }),
  s({ id: "r4", round: 4, team1Id: "c", team2Id: "b", winnerId: null, status: "scheduled" }),
  s({ id: "qf", stage: "quarterfinals", round: null, team1Id: "a", team2Id: "d", winnerId: "d", bestOf: 5 }),
];

describe("swissStandings", () => {
  const table = swissStandings(series, ["a", "b", "c", "d"]);
  const by = Object.fromEntries(table.map((r) => [r.teamId, r]));

  it("counts finished swiss series only", () => {
    expect(by.a).toMatchObject({ wins: 3, losses: 0, status: "qualified" });
    expect(by.c).toMatchObject({ wins: 0, losses: 3, status: "eliminated" });
    expect(by.b).toMatchObject({ wins: 1, losses: 2, status: "active" });
    expect(by.d).toMatchObject({ wins: 2, losses: 1, status: "active" });
  });
  it("records opponents per round", () => {
    expect(by.a.results.map((r) => `${r.round}:${r.opponentId}:${r.won ? "W" : "L"}`)).toEqual([
      "1:b:W",
      "2:d:W",
      "3:b:W",
    ]);
  });
  it("sorts best records first", () => {
    expect(table.map((r) => r.teamId)).toEqual(["a", "d", "b", "c"]);
  });
  it("groups by record label", () => {
    expect(swissGroups(table).map((g) => `${g.label}:${g.teams.length}`)).toEqual(["3-0:1", "2-1:1", "1-2:1", "0-3:1"]);
  });
});

describe("teamStatus", () => {
  const team = (id: string, stages: Team["stages"]): Team => ({
    id,
    name: id,
    short: id,
    page: id,
    region: "Korea",
    location: null,
    stages,
    roster: [],
    coaches: [],
    seed: null,
  });
  const table = swissStandings(series, ["a", "b", "c", "d"]);

  it("marks swiss eliminations", () => {
    expect(teamStatus(team("c", ["main"]), series, table)).toBe("eliminated");
  });
  it("marks knockout losers as eliminated and others alive", () => {
    expect(teamStatus(team("a", ["main"]), series, table)).toBe("eliminated");
    expect(teamStatus(team("d", ["main"]), series, table)).toBe("alive");
    expect(teamStatus(team("b", ["main"]), series, table)).toBe("alive");
  });
  it("marks play-in-only teams as eliminated", () => {
    expect(teamStatus(team("x", ["playin"]), series, table)).toBe("eliminated");
  });
  it("marks the final winner as champion", () => {
    const withFinal = [
      ...series,
      s({ id: "final", stage: "final", round: null, team1Id: "d", team2Id: "b", winnerId: "d", bestOf: 5 }),
    ];
    expect(teamStatus(team("d", ["main"]), withFinal, table)).toBe("champion");
    expect(teamStatus(team("b", ["main"]), withFinal, table)).toBe("eliminated");
  });
});
