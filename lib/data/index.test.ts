import { describe, expect, it } from "vitest";
import { indexDataset } from "./index";
import type { Dataset, Game } from "./types";

const game = (id: string, seriesId: string, provisional: boolean): Game =>
  ({ id, seriesId, gameNumber: Number(id.slice(-1)), provisional, blue: { picks: [], bans: [] }, red: { picks: [], bans: [] } }) as unknown as Game;

const dataset = {
  teams: [],
  players: [],
  series: [{ id: "s1", team1Id: "a", team2Id: "b" }],
  games: [game("s1-1", "s1", false), game("s1-2", "s1", true)],
  drafts: [],
  playerGames: [],
  champions: { version: "1", champions: [] },
} as unknown as Dataset;

describe("indexDataset", () => {
  it("keeps provisional games out of confirmedGames but lists them per series", () => {
    const data = indexDataset(dataset);
    expect(data.games.map((g) => g.id)).toEqual(["s1-1", "s1-2"]);
    expect(data.confirmedGames.map((g) => g.id)).toEqual(["s1-1"]);
    expect(data.gamesBySeries.get("s1")?.map((g) => g.id)).toEqual(["s1-1", "s1-2"]);
    expect(data.gamesById.get("s1-2")?.provisional).toBe(true);
  });
});
