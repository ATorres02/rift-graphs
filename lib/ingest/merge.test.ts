import { describe, expect, it } from "vitest";
import type { Draft, Game, Player, Series, Team } from "../data/types";
import type { LolesportsMatch } from "../sources/lolesports";
import type { ManualEntry } from "../sources/manual";
import { mergeSources, teamMatches, type MergeInput } from "./merge";

const team = (id: string, name: string, short: string): Team => ({
  id,
  name,
  short,
  page: name,
  region: "EMEA",
  location: null,
  stages: ["main"],
  roster: [],
});
const teams = [
  team("movistar-koi", "Movistar KOI", "MKOI"),
  team("t1", "T1", "T1"),
  team("team-liquid", "Team Liquid", "TL"),
  team("los", "LØS", "LOS"),
];
const player = (id: string, teamId: string, role: Player["role"]): Player => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  page: id,
  teamId,
  role,
  country: null,
  realName: null,
  nativeName: null,
  residency: null,
  fromScoreboardOnly: false,
});
const players = [player("elyoya", "movistar-koi", "jungle"), player("oner", "t1", "jungle")];

const series = (over: Partial<Series> = {}): Series => ({
  id: "main-event-round-4-1",
  matchId: "x",
  stage: "swiss",
  tab: "Round 4",
  round: 4,
  bestOf: 3,
  team1Id: "movistar-koi",
  team2Id: "t1",
  dateTimeUtc: "2026-10-28T20:00:00Z",
  hasTime: true,
  score: null,
  winnerId: null,
  status: "scheduled",
  matchDay: 1,
  patch: "26.20",
  streamUrl: null,
  mvp: null,
  gameIds: [],
  gamesPlayed: 0,
  source: "leaguepedia",
  provisional: false,
  lolesportsMatchId: null,
  ...over,
});

const stats = (teamId: string, picks: string[]): Game["blue"] => ({
  teamId,
  kills: 10,
  gold: 60000,
  towers: 8,
  inhibitors: 1,
  dragons: 3,
  elders: 0,
  barons: 1,
  heralds: 1,
  voidGrubs: 3,
  bans: ["Vi", "Sylas", "Akali", "Jhin", "Orianna"],
  picks,
  lineup: null,
});
const lpGame = (over: Partial<Game> = {}): Game => ({
  id: "main-event-round-4-1-1",
  seriesId: "main-event-round-4-1",
  stage: "swiss",
  gameNumber: 1,
  dateTimeUtc: "2026-10-28T20:10:00Z",
  durationSeconds: 1900,
  patch: "26.20",
  winnerSide: "red",
  winnerTeamId: "t1",
  blue: stats("movistar-koi", ["Rumble", "Lee Sin", "Syndra", "Miss Fortune", "Nautilus"]),
  red: stats("t1", ["Gnar", "Xin Zhao", "Azir", "Ezreal", "Karma"]),
  riotGameId: null,
  vodUrl: null,
  source: "leaguepedia",
  provisional: false,
  statsComplete: true,
  ...over,
});
const lpDraft: Draft = {
  gameId: "main-event-round-4-1-1",
  blue: { bans: [], picks: [], picksByRole: [] },
  red: { bans: [], picks: [], picksByRole: [] },
  complete: true,
};

const manual = (game: number, winner: string, over: Partial<ManualEntry["data"]> = {}): ManualEntry => ({
  file: `main-event-round-4-1-g${game}.json`,
  data: {
    series: "main-event-round-4-1",
    game,
    blue: game % 2 ? "movistar-koi" : "t1",
    red: game % 2 ? "t1" : "movistar-koi",
    winner,
    duration: "31:42",
    picks: {
      blue: ["Rumble", "Lee Sin", "Syndra", "Miss Fortune", "Nautilus"],
      red: ["Gnar", "Xin Zhao", "Azir", "Ezreal", "Karma"],
    },
    ...over,
  },
});

const lolMatch = (
  over: Partial<LolesportsMatch> = {},
  t1 = { gameWins: 0, outcome: null as "win" | "loss" | null },
  t2 = { gameWins: 0, outcome: null as "win" | "loss" | null },
): LolesportsMatch => ({
  id: "115",
  startTime: "2026-10-28T20:00:00Z",
  state: "unstarted",
  block: "Swiss",
  stage: "swiss",
  bestOf: 3,
  teams: [
    { name: "Movistar KOI", code: "MKOI", ...t1 },
    { name: "T1", code: "T1", ...t2 },
  ],
  ...over,
});

const input = (over: Partial<MergeInput> = {}): MergeInput => ({
  series: [series()],
  games: [],
  drafts: [],
  teams,
  players,
  manual: [],
  lolesports: null,
  resolveChampion: (n) => (n.toLowerCase() === "typo" ? null : n),
  ...over,
});

describe("teamMatches", () => {
  it("matches by tag, exact name or name containment", () => {
    expect(teamMatches(teams[2], { name: "Team Liquid Alienware", code: "TLAW" })).toBe(true);
    expect(teamMatches(teams[3], { name: "LOS", code: "LOS" })).toBe(true);
    expect(teamMatches(teams[1], { name: "T1", code: "T1" })).toBe(true);
    expect(teamMatches(teams[1], { name: "TBD", code: "TBD" })).toBe(false);
    expect(teamMatches(teams[0], { name: "Team Liquid Alienware", code: "TLAW" })).toBe(false);
  });
});

describe("mergeSources · manual files", () => {
  it("adds a provisional game and derives the series score", () => {
    const r = mergeSources(input({ manual: [manual(1, "t1")] }));
    expect(r.manual.applied).toEqual(["main-event-round-4-1-g1.json"]);
    const g = r.games[0];
    expect(g).toMatchObject({
      id: "main-event-round-4-1-1",
      source: "manual",
      provisional: true,
      statsComplete: false,
      winnerSide: "red",
      winnerTeamId: "t1",
      durationSeconds: 1902,
    });
    expect(r.drafts[0]).toMatchObject({ gameId: "main-event-round-4-1-1", complete: false });
    const s = r.series[0];
    expect(s).toMatchObject({
      score: { team1: 0, team2: 1 },
      winnerId: null,
      status: "live",
      source: "manual",
      provisional: true,
      gameIds: ["main-event-round-4-1-1"],
      gamesPlayed: 1,
    });
    expect(r.provisional).toEqual({ seriesIds: ["main-event-round-4-1"], gameIds: ["main-event-round-4-1-1"] });
  });

  it("closes a Bo3 after two wins and keeps objectives and lineups", () => {
    const withStats = manual(2, "t1", {
      objectives: { blue: { kills: 5, gold: 50000 }, red: { kills: 15, gold: 62000, barons: 1 } },
      players: {
        blue: [
          { player: "Oner", role: "jungle", kills: 3, deaths: 0, assists: 9 },
          { player: "Doran", role: "top" },
          { player: "Faker", role: "mid" },
          { player: "Gumayusi", role: "bot" },
          { player: "Keria", role: "support" },
        ],
        red: [
          { player: "elyoya", role: "jungle", kills: 1, deaths: 4, assists: 2 },
          { player: "Myrwn", role: "top" },
          { player: "Jojopyun", role: "mid" },
          { player: "Supa", role: "bot" },
          { player: "Alvaro", role: "support" },
        ],
      },
    });
    const r = mergeSources(input({ manual: [manual(1, "t1"), withStats] }));
    expect(r.series[0]).toMatchObject({
      score: { team1: 0, team2: 2 },
      winnerId: "t1",
      status: "finished",
      source: "manual",
    });
    const g2 = r.games[1];
    expect(g2.statsComplete).toBe(true);
    expect(g2.blue).toMatchObject({ teamId: "t1", kills: 5, gold: 50000 });
    expect(g2.blue.lineup?.[0]).toMatchObject({
      playerId: "oner",
      name: "Oner",
      role: "jungle",
      champion: "Lee Sin",
      kills: 3,
    });
    expect(g2.red.lineup?.[0]).toMatchObject({ playerId: "elyoya", champion: "Xin Zhao" });
    expect(g2.red.lineup?.[1]).toMatchObject({ playerId: null, name: "Myrwn" });
    expect(r.warnings.some((w) => w.includes('"Myrwn" not found'))).toBe(true);
  });

  it("is superseded by a validated Leaguepedia game and records disagreements", () => {
    const r = mergeSources(
      input({
        games: [lpGame()],
        drafts: [lpDraft],
        series: [series({ score: { team1: 0, team2: 1 }, gameIds: ["main-event-round-4-1-1"], gamesPlayed: 1 })],
        manual: [manual(1, "movistar-koi", { duration: "45:00" })],
      }),
    );
    expect(r.manual.superseded).toEqual(["main-event-round-4-1-g1.json"]);
    expect(r.games).toHaveLength(1);
    expect(r.games[0].source).toBe("leaguepedia");
    expect(r.conflicts.map((c) => c.field)).toEqual(["winner", "duration"]);
    expect(r.conflicts[0]).toMatchObject({
      gameId: "main-event-round-4-1-1",
      resolvedWith: "leaguepedia",
      values: { leaguepedia: "t1", manual: "movistar-koi" },
    });
    expect(r.provisional.gameIds).toEqual([]);
  });

  it("never overrides a series Leaguepedia has closed", () => {
    const closed = series({ score: { team1: 2, team2: 0 }, winnerId: "movistar-koi", status: "finished" });
    const r = mergeSources(input({ series: [closed], manual: [manual(1, "t1"), manual(2, "t1")] }));
    expect(r.series[0]).toMatchObject({
      winnerId: "movistar-koi",
      status: "finished",
      source: "leaguepedia",
      provisional: false,
    });
    expect(r.conflicts).toEqual([
      {
        seriesId: "main-event-round-4-1",
        gameId: null,
        field: "score",
        values: { leaguepedia: "2-0", manual: "0-2" },
        resolvedWith: "leaguepedia",
      },
    ]);
  });

  it("creates a series the dataset does not have when the file is self-contained, and rejects it otherwise", () => {
    const qf = manual(1, "t1", {
      series: "main-event-quarterfinals-9",
      stage: "quarterfinals",
      date: "2026-11-03T22:00:00Z",
      bestOf: 5,
      teams: { team1: "MKOI", team2: "T1" },
    });
    qf.file = "main-event-quarterfinals-9-g1.json";
    const r = mergeSources(input({ manual: [qf] }));
    expect(r.series.find((s) => s.id === "main-event-quarterfinals-9")).toMatchObject({
      stage: "quarterfinals",
      bestOf: 5,
      team1Id: "movistar-koi",
      team2Id: "t1",
      status: "live",
      score: { team1: 0, team2: 1 },
      source: "manual",
    });

    const bare = manual(1, "t1", { series: "main-event-quarterfinals-9" });
    bare.file = "main-event-quarterfinals-9-g1.json";
    const r2 = mergeSources(input({ manual: [bare] }));
    expect(r2.manual.invalid[0].error).toContain("must include stage");
  });

  it("rejects games whose teams are not the series teams, and keeps unknown champions with a warning", () => {
    const wrong = manual(1, "team-liquid", { blue: "team-liquid", red: "los", winner: "team-liquid" });
    const r = mergeSources(input({ manual: [wrong] }));
    expect(r.manual.invalid[0].error).toContain("not the teams of series");
    const typo = manual(1, "t1", {
      picks: {
        blue: ["typo", "Lee Sin", "Syndra", "Miss Fortune", "Nautilus"],
        red: ["Gnar", "Xin Zhao", "Azir", "Ezreal", "Karma"],
      },
    });
    const r2 = mergeSources(input({ manual: [typo] }));
    expect(r2.games[0].blue.picks[0]).toBe("typo");
    expect(r2.warnings.some((w) => w.includes('champion "typo"'))).toBe(true);
  });
});

describe("mergeSources · lolesports", () => {
  it("marks a series live while in progress and finished when completed", () => {
    const live = mergeSources(
      input({
        lolesports: [lolMatch({ state: "inProgress" }, { gameWins: 1, outcome: null }, { gameWins: 0, outcome: null })],
      }),
    );
    expect(live.series[0]).toMatchObject({
      status: "live",
      score: { team1: 1, team2: 0 },
      source: "lolesports",
      provisional: true,
      lolesportsMatchId: "115",
    });

    const done = mergeSources(
      input({
        lolesports: [
          lolMatch({ state: "completed" }, { gameWins: 1, outcome: "loss" }, { gameWins: 2, outcome: "win" }),
        ],
      }),
    );
    expect(done.series[0]).toMatchObject({
      status: "finished",
      score: { team1: 1, team2: 2 },
      winnerId: "t1",
      gamesPlayed: 3,
      source: "lolesports",
      provisional: true,
    });
    expect(done.lolesports).toEqual({ matchedSeries: 1, unmatchedEvents: 0 });
  });

  it("orients the score by team even when lolesports lists the teams the other way round", () => {
    const swapped = lolMatch({ state: "completed" });
    swapped.teams = [swapped.teams[1], swapped.teams[0]];
    swapped.teams[0] = { ...swapped.teams[0], gameWins: 2, outcome: "win" };
    swapped.teams[1] = { ...swapped.teams[1], gameWins: 0, outcome: "loss" };
    const r = mergeSources(input({ lolesports: [swapped] }));
    expect(r.series[0]).toMatchObject({ score: { team1: 0, team2: 2 }, winnerId: "t1" });
  });

  it("fills TBD pairings from lolesports and matches aliases such as TLAW", () => {
    const tbd = series({
      id: "main-event-round-5-1",
      team1Id: null,
      team2Id: null,
      dateTimeUtc: "2026-10-31T17:00:00Z",
      round: 5,
    });
    const m = lolMatch({ id: "9", startTime: "2026-10-31T17:00:00Z", state: "inProgress" });
    m.teams = [
      { name: "Team Liquid Alienware", code: "TLAW", gameWins: 0, outcome: null },
      { name: "LOS", code: "LOS", gameWins: 0, outcome: null },
    ];
    const r = mergeSources(input({ series: [tbd], lolesports: [m] }));
    expect(r.series[0]).toMatchObject({
      team1Id: "team-liquid",
      team2Id: "los",
      status: "live",
      lolesportsMatchId: "9",
    });
  });

  it("only records a conflict when Leaguepedia has closed the series", () => {
    const closed = series({ score: { team1: 2, team2: 0 }, winnerId: "movistar-koi", status: "finished" });
    const r = mergeSources(
      input({
        series: [closed],
        lolesports: [
          lolMatch({ state: "completed" }, { gameWins: 1, outcome: "loss" }, { gameWins: 2, outcome: "win" }),
        ],
      }),
    );
    expect(r.series[0]).toMatchObject({
      winnerId: "movistar-koi",
      score: { team1: 2, team2: 0 },
      source: "leaguepedia",
      provisional: false,
    });
    expect(r.conflicts).toEqual([
      {
        seriesId: "main-event-round-4-1",
        gameId: null,
        field: "result",
        values: { leaguepedia: "movistar-koi 2-0", lolesports: "t1 1-2" },
        resolvedWith: "leaguepedia",
      },
    ]);
  });

  it("prefers manual games over lolesports when they cover the same games, and reports the disagreement", () => {
    const r = mergeSources(
      input({
        manual: [manual(1, "movistar-koi"), manual(2, "movistar-koi")],
        lolesports: [
          lolMatch({ state: "completed" }, { gameWins: 0, outcome: "loss" }, { gameWins: 2, outcome: "win" }),
        ],
      }),
    );
    expect(r.series[0]).toMatchObject({ winnerId: "movistar-koi", score: { team1: 2, team2: 0 }, source: "manual" });
    expect(r.conflicts).toEqual([
      {
        seriesId: "main-event-round-4-1",
        gameId: null,
        field: "result",
        values: { manual: "movistar-koi 2-0", lolesports: "t1 0-2" },
        resolvedWith: "manual",
      },
    ]);
  });

  it("lets lolesports complete a series when manual files only cover part of it", () => {
    const r = mergeSources(
      input({
        manual: [manual(1, "t1")],
        lolesports: [
          lolMatch({ state: "completed" }, { gameWins: 0, outcome: "loss" }, { gameWins: 2, outcome: "win" }),
        ],
      }),
    );
    expect(r.series[0]).toMatchObject({
      winnerId: "t1",
      score: { team1: 0, team2: 2 },
      status: "finished",
      source: "lolesports",
      gameIds: ["main-event-round-4-1-1"],
      gamesPlayed: 2,
    });
    expect(r.conflicts).toEqual([]);
  });

  it("undoes Leaguepedia's started-but-no-winner guess when lolesports says unstarted, and counts unmatched events", () => {
    const guessed = series({ status: "live" });
    const stranger = lolMatch(
      { id: "77", startTime: "2026-10-29T20:00:00Z", state: "completed" },
      { gameWins: 2, outcome: "win" },
      { gameWins: 0, outcome: "loss" },
    );
    stranger.teams = [
      { name: "G2 Esports", code: "G2", gameWins: 2, outcome: "win" },
      { name: "Gen.G", code: "GEN", gameWins: 0, outcome: "loss" },
    ];
    const r = mergeSources(input({ series: [guessed], lolesports: [lolMatch(), stranger] }));
    expect(r.series[0].status).toBe("scheduled");
    expect(r.lolesports).toEqual({ matchedSeries: 1, unmatchedEvents: 1 });
    expect(r.warnings.some((w) => w.includes("match 77"))).toBe(true);
  });
});
