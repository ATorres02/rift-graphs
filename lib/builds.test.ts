import { describe, expect, it } from "vitest";
import { championBuild, inventorySlots, spellPair } from "./builds";
import type { PlayerGame } from "./data/types";
import type { LoadoutIndex } from "./sources/loadout";

const loadout: LoadoutIndex = {
  version: "16.20.1",
  items: {
    "Infinity Edge": { id: "3031", kind: "legendary" },
    "Trinity Force": { id: "3078", kind: "legendary" },
    "Plated Steelcaps": { id: "3047", kind: "boots" },
    "Long Sword": { id: "1036", kind: "other" },
  },
  runes: {},
  spells: {},
};

const row = (over: Partial<PlayerGame>): PlayerGame =>
  ({
    items: [],
    keystone: "Lethal Tempo",
    primaryTree: "Precision",
    secondaryTree: "Inspiration",
    runes: ["Lethal Tempo", "a", "b", "c", "d", "e", "f", "g", "h"],
    summonerSpells: ["Flash", "Heal"],
    ...over,
  }) as PlayerGame;

describe("championBuild", () => {
  const rows = [
    row({ items: ["Infinity Edge", "Plated Steelcaps", "Long Sword", "Long Sword"] }),
    row({ items: ["Infinity Edge", "Trinity Force", "Trinity Force"], summonerSpells: ["Heal", "Flash"] }),
    row({
      items: ["Trinity Force"],
      keystone: "Press the Attack",
      runes: ["Press the Attack"],
      summonerSpells: ["Flash", "Cleanse"],
    }),
  ];
  const build = championBuild(rows, loadout);

  it("counts finished items once per game and leaves components out", () => {
    expect(build.games).toBe(3);
    expect(build.items).toEqual([
      { name: "Infinity Edge", games: 2 },
      { name: "Trinity Force", games: 2 },
    ]);
    expect(build.boots).toEqual([{ name: "Plated Steelcaps", games: 1 }]);
    expect(build.support).toEqual([]);
  });

  it("finds the keystones and the most used full rune page", () => {
    expect(build.keystones).toEqual([
      { name: "Lethal Tempo", games: 2 },
      { name: "Press the Attack", games: 1 },
    ]);
    expect(build.page?.games).toBe(2);
    expect(build.page?.runes[0]).toBe("Lethal Tempo");
  });

  it("treats a spell pair the same whichever key it is on", () => {
    expect(build.spells).toEqual([
      { names: ["Heal", "Flash"], games: 2 },
      { names: ["Cleanse", "Flash"], games: 1 },
    ]);
  });
});

describe("spellPair and inventorySlots", () => {
  it("puts Flash last", () => {
    expect(spellPair(["Flash", "Teleport"])).toEqual(["Teleport", "Flash"]);
    expect(spellPair(["Smite", "Ignite"])).toEqual(["Ignite", "Smite"]);
  });

  it("pads the inventory to six slots", () => {
    expect(inventorySlots(["A", "B"])).toEqual(["A", "B", null, null, null, null]);
  });
});
