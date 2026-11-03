import { describe, expect, it } from "vitest";
import type { Game, PlayerGame } from "../data/types";
import type { EarlyGame, EarlyPlayer } from "../sources/livestats";
import { applyEarly, parseEventGames } from "./early";

const side = (teamId: string) => ({
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
});

const game = (id: string): Game => ({
  id,
  seriesId: "s1",
  stage: "quarterfinals",
  gameNumber: 1,
  dateTimeUtc: null,
  durationSeconds: 1800,
  patch: null,
  winnerSide: "blue",
  winnerTeamId: "a",
  blue: side("a"),
  red: side("b"),
  riotGameId: null,
  vodUrl: null,
  source: "leaguepedia",
  provisional: false,
  statsComplete: true,
});

const row = (o: Partial<PlayerGame>) => ({ gameId: "g1", role: "mid", side: "blue", ...o }) as PlayerGame;
const player = (o: Partial<EarlyPlayer>): EarlyPlayer => ({
  side: "blue",
  role: "mid",
  gold: 5000,
  cs: 130,
  level: 9,
  kills: 0,
  deaths: 0,
  assists: 0,
  ...o,
});

const early: EarlyGame = {
  esportsGameId: "1",
  firstBlood: "red",
  at15: {
    blue: { gold: 25000, kills: 2, towers: 1, dragons: 1 },
    red: { gold: 24000, kills: 3, towers: 0, dragons: 0 },
    players: [player({}), player({ side: "red", gold: 4400, cs: 121 })],
  },
  pausedSeconds: 0,
};

describe("applyEarly", () => {
  const out = applyEarly([game("g1"), game("g2")], [row({}), row({ side: "red" }), row({ gameId: "g2" })], {
    g1: early,
    g2: { unavailable: "no frames in the live stats feed" },
  });

  it("gives each team its first blood and its gold at 15", () => {
    expect(out.games[0].blue).toMatchObject({ firstBlood: false, goldAt15: 25000 });
    expect(out.games[0].red).toMatchObject({ firstBlood: true, goldAt15: 24000 });
  });

  it("gives each player their gold and CS at 15 and the difference with their lane opponent", () => {
    expect(out.playerGames[0]).toMatchObject({ goldAt15: 5000, csAt15: 130, goldDiffAt15: 600, csDiffAt15: 9 });
    expect(out.playerGames[1]).toMatchObject({ goldAt15: 4400, goldDiffAt15: -600 });
  });

  it("leaves games without early numbers as they are", () => {
    expect(out.games[1].blue).not.toHaveProperty("firstBlood");
    expect(out.playerGames[2]).not.toHaveProperty("goldAt15");
  });
});

describe("parseEventGames", () => {
  it("reads game ids, numbers and the team on each side", () => {
    const games = parseEventGames({
      data: {
        event: {
          match: {
            teams: [
              { id: "t1", name: "Top Esports", code: "TES" },
              { id: "t2", name: "Invictus Gaming", code: "IG" },
            ],
            games: [
              {
                id: "100",
                number: 1,
                teams: [
                  { id: "t1", side: "blue" },
                  { id: "t2", side: "red" },
                ],
              },
              {
                id: "101",
                number: 2,
                teams: [
                  { id: "t2", side: "blue" },
                  { id: "t1", side: "red" },
                ],
              },
            ],
          },
        },
      },
    });
    expect(games[1]).toEqual({
      id: "101",
      number: 2,
      blue: { name: "Invictus Gaming", code: "IG" },
      red: { name: "Top Esports", code: "TES" },
    });
  });
});
