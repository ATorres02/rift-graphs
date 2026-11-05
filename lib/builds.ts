import type { PlayerGame } from "@/lib/data/types";
import type { ItemKind, LoadoutIndex } from "@/lib/sources/loadout";

/**
 * Pro build summaries for a champion, from the final inventory of each game (Leaguepedia has no purchase order, so an
 * item still being built when the game ended counts as its component, and components are left out here).
 */

export interface CountedName {
  name: string;
  games: number;
}

export interface RunePage {
  primaryTree: string;
  secondaryTree: string | null;
  /** Keystone, three primary runes, two secondary runes, three stat shards. */
  runes: string[];
  games: number;
}

export interface ChampionBuild {
  games: number;
  items: CountedName[];
  boots: CountedName[];
  support: CountedName[];
  keystones: CountedName[];
  page: RunePage | null;
  /** Each pair with Flash last, as most players bind it. */
  spells: { names: string[]; games: number }[];
}

function count(values: string[]): CountedName[] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map, ([name, games]) => ({ name, games })).sort(
    (a, b) => b.games - a.games || a.name.localeCompare(b.name, "en"),
  );
}

/** Spell pair in a fixed order: alphabetical, then Flash moved last. */
export function spellPair(spells: string[]): string[] {
  return [...spells].sort((a, b) => Number(a === "Flash") - Number(b === "Flash") || a.localeCompare(b, "en"));
}

export function championBuild(rows: PlayerGame[], loadout: LoadoutIndex): ChampionBuild {
  const ofKind = (kind: ItemKind) =>
    // Once per game, even if a player held two copies.
    count(rows.flatMap((r) => Array.from(new Set(r.items)).filter((i) => loadout.items[i]?.kind === kind)));

  const pages = new Map<string, RunePage>();
  for (const r of rows) {
    if (!r.primaryTree || r.runes.length === 0) continue;
    const k = [r.primaryTree, r.secondaryTree, ...r.runes].join("|");
    const page = pages.get(k) ?? {
      primaryTree: r.primaryTree,
      secondaryTree: r.secondaryTree,
      runes: r.runes,
      games: 0,
    };
    page.games += 1;
    pages.set(k, page);
  }
  const page = Array.from(pages.values()).sort((a, b) => b.games - a.games)[0] ?? null;

  const spells = new Map<string, { names: string[]; games: number }>();
  for (const r of rows) {
    if (!r.summonerSpells.length) continue;
    const names = spellPair(r.summonerSpells);
    const k = names.join("|");
    const entry = spells.get(k) ?? { names, games: 0 };
    entry.games += 1;
    spells.set(k, entry);
  }

  return {
    games: rows.length,
    items: ofKind("legendary"),
    boots: ofKind("boots"),
    support: ofKind("support"),
    keystones: count(rows.flatMap((r) => (r.keystone ? [r.keystone] : []))),
    page,
    spells: Array.from(spells.values()).sort(
      (a, b) => b.games - a.games || a.names.join().localeCompare(b.names.join()),
    ),
  };
}

/** The six inventory slots in Leaguepedia's order, empty slots as null. */
export function inventorySlots(items: string[]): (string | null)[] {
  return Array.from({ length: 6 }, (_, i) => items[i] ?? null);
}
