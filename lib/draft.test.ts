import { describe, expect, it } from "vitest";
import type { Draft, Game } from "./data/types";
import { draftSequence, lockedChampionsBefore } from "./draft";

const draft: Draft = {
  gameId: "g1",
  blue: {
    bans: ["B-ban1", "B-ban2", "B-ban3", "B-ban4", "B-ban5"],
    picks: ["B-pick1", "B-pick2", "B-pick3", "B-pick4", "B-pick5"],
    picksByRole: ["B-pick2", "B-pick1", "B-pick3", "B-pick4", "B-pick5"],
  },
  red: {
    bans: ["R-ban1", "R-ban2", "R-ban3", "R-ban4", "R-ban5"],
    picks: ["R-pick1", "R-pick2", "R-pick3", "R-pick4", "R-pick5"],
    picksByRole: ["R-pick2", "R-pick1", "R-pick3", "R-pick4", "R-pick5"],
  },
  complete: true,
};

describe("draftSequence", () => {
  const seq = draftSequence(draft);
  it("has twenty steps", () => {
    expect(seq).toHaveLength(20);
    expect(seq.map((s) => s.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("follows the standard order", () => {
    expect(seq.map((s) => s.champion)).toEqual([
      "B-ban1",
      "R-ban1",
      "B-ban2",
      "R-ban2",
      "B-ban3",
      "R-ban3",
      "B-pick1",
      "R-pick1",
      "R-pick2",
      "B-pick2",
      "B-pick3",
      "R-pick3",
      "R-ban4",
      "B-ban4",
      "R-ban5",
      "B-ban5",
      "R-pick4",
      "B-pick4",
      "B-pick5",
      "R-pick5",
    ]);
    expect(seq.filter((s) => s.phase === 1)).toHaveLength(12);
    expect(seq.filter((s) => s.type === "ban")).toHaveLength(10);
  });
  it("keeps empty slots as null", () => {
    const partial = { ...draft, red: { ...draft.red, bans: ["R-ban1", null, null, null, null] } };
    expect(draftSequence(partial)[3].champion).toBeNull();
  });
});

describe("lockedChampionsBefore", () => {
  const g = (n: number, bluePicks: string[], redPicks: string[]): Game =>
    ({ gameNumber: n, blue: { picks: bluePicks }, red: { picks: redPicks } }) as unknown as Game;
  const games = [g(1, ["Ahri", "Jinx"], ["Azir"]), g(2, ["Zed"], ["Yone"]), g(3, ["Ahri"], ["Lux"])];

  it("locks picks from earlier games only", () => {
    expect(lockedChampionsBefore(games, 1)).toEqual([]);
    expect(lockedChampionsBefore(games, 2)).toEqual(["Ahri", "Azir", "Jinx"]);
    expect(lockedChampionsBefore(games, 3)).toEqual(["Ahri", "Azir", "Jinx", "Yone", "Zed"]);
  });
});
