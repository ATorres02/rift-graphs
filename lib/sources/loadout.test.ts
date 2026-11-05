import { describe, expect, it } from "vitest";
import { buildLoadoutIndex, loadoutNames } from "./loadout";

const sr = { "11": true };
const items = {
  data: {
    "1001": { name: "Boots", tags: ["Boots"], into: ["3006"], maps: sr, gold: { total: 300 } },
    "3006": {
      name: "Berserker's Greaves",
      tags: ["Boots"],
      depth: 2,
      from: ["1001"],
      into: ["3172"],
      maps: sr,
      gold: { total: 1100 },
    },
    "3172": {
      name: "Gunmetal Greaves",
      tags: ["AttackSpeed"],
      depth: 3,
      from: ["3006"],
      maps: sr,
      gold: { total: 1100 },
    },
    "3153": { name: "Blade of The Ruined King", tags: ["Damage"], depth: 3, maps: sr, gold: { total: 3200 } },
    "223153": { name: "Blade of The Ruined King", tags: ["Damage"], maps: { "11": false }, gold: { total: 2500 } },
    "773153": { name: "Blade of The Ruined King", tags: ["Damage"], maps: sr, gold: { total: 3200 } },
    "3869": { name: "Celestial Opposition", tags: ["GoldPer"], depth: 2, maps: sr, gold: { total: 400 } },
    "4646": { name: "Stormsurge", tags: ["SpellDamage", "GoldPer"], depth: 3, maps: sr, gold: { total: 2800 } },
    "1036": { name: "Long Sword", tags: ["Damage"], into: ["3153"], maps: sr, gold: { total: 350 } },
    "2055": { name: "Control Ward", tags: ["Consumable"], consumed: true, maps: sr, gold: { total: 75 } },
  },
};
const runes = [
  {
    name: "Precision",
    icon: "perk-images/Styles/7201_Precision.png",
    slots: [
      { runes: [{ name: "Lethal Tempo", icon: "perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png" }] },
    ],
  },
];
const spells = {
  data: {
    SummonerFlash: { id: "SummonerFlash", name: "Flash", modes: ["CLASSIC", "ARAM"] },
    SummonerSnowURFSnowball_Mark: { id: "SummonerSnowURFSnowball_Mark", name: "Mark", modes: ["URF"] },
  },
};

describe("buildLoadoutIndex", () => {
  const { index, missing } = buildLoadoutIndex("16.20.1", items, runes, spells, {
    items: [
      "Blade of the Ruined King",
      "Berserker's Greaves",
      "Gunmetal Greaves",
      "Boots",
      "Celestial Opposition",
      "Stormsurge",
      "Long Sword",
      "Control Ward",
      "Made-up Item",
    ],
    runes: ["Lethal Tempo", "Precision", "Adaptive Force", "Made-up Rune"],
    spells: ["Flash", "Mark"],
  });

  it("matches item names regardless of case and prefers the plain Summoner's Rift id", () => {
    expect(index.items["Blade of the Ruined King"]).toEqual({ id: "3153", kind: "legendary" });
  });

  it("sorts items into finished items, boots, support items and the rest", () => {
    expect(index.items["Berserker's Greaves"].kind).toBe("boots");
    expect(index.items["Gunmetal Greaves"].kind).toBe("boots");
    expect(index.items.Boots.kind).toBe("other");
    expect(index.items["Celestial Opposition"].kind).toBe("support");
    expect(index.items.Stormsurge.kind).toBe("legendary");
    expect(index.items["Long Sword"].kind).toBe("other");
    expect(index.items["Control Ward"].kind).toBe("other");
  });

  it("finds runes, trees and stat shards", () => {
    expect(index.runes["Lethal Tempo"]).toBe("perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png");
    expect(index.runes.Precision).toBe("perk-images/Styles/7201_Precision.png");
    expect(index.runes["Adaptive Force"]).toBe("perk-images/StatMods/StatModsAdaptiveForceIcon.png");
  });

  it("drops spell ids that could not go into a URL and lists every name it could not resolve", () => {
    expect(index.spells).toEqual({ Flash: "SummonerFlash" });
    expect(missing).toEqual(["item Made-up Item", "rune Made-up Rune", "summoner spell Mark"]);
  });

  it("writes names in a fixed order", () => {
    expect(Object.keys(index.items)).toEqual([...Object.keys(index.items)].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("loadoutNames", () => {
  it("collects items, trinkets, runes, trees and spells once", () => {
    const row = {
      items: ["Long Sword", "Long Sword"],
      trinket: "Oracle Lens",
      runes: ["Lethal Tempo"],
      keystone: "Lethal Tempo",
      primaryTree: "Precision",
      secondaryTree: null,
      summonerSpells: ["Flash", "Heal"],
    };
    const names = loadoutNames([row, row]);
    expect([...names.items]).toEqual(["Long Sword", "Oracle Lens"]);
    expect([...names.runes]).toEqual(["Lethal Tempo", "Precision"]);
    expect([...names.spells]).toEqual(["Flash", "Heal"]);
  });
});
