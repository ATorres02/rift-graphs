import { DDRAGON_BASE } from "./ddragon";

/**
 * Icons for the items, runes and summoner spells in the player rows (Leaguepedia gives names only), from Data Dragon.
 * The ingest keeps the names it has seen in data/<tournament>/loadout.json, so pages never fetch Data Dragon's JSON.
 */

/** What an item is for the build summaries: finished items, boots, the upgraded support item, or anything else. */
export type ItemKind = "legendary" | "boots" | "support" | "other";

export interface LoadoutIndex {
  /** Data Dragon version the item and spell icons come from. */
  version: string;
  /** Item name as Leaguepedia writes it → Data Dragon item id and kind. */
  items: Record<string, { id: string; kind: ItemKind }>;
  /** Rune, rune tree or stat shard name → icon path under /cdn/img/. */
  runes: Record<string, string>;
  /** Summoner spell name → Data Dragon spell id ("SummonerFlash"). */
  spells: Record<string, string>;
}

export interface LoadoutNames {
  items: Iterable<string>;
  runes: Iterable<string>;
  spells: Iterable<string>;
}

interface DdItem {
  name: string;
  depth?: number;
  from?: string[];
  into?: string[];
  tags?: string[];
  consumed?: boolean;
  maps?: Record<string, boolean>;
  gold?: { total?: number };
}
interface DdRuneTree {
  name: string;
  icon: string;
  slots: { runes: { name: string; icon: string }[] }[];
}
interface DdSpell {
  id: string;
  name: string;
  modes?: string[];
}

/** Stat shards are not in runesReforged.json; their icons sit next to the rune art. */
const STAT_SHARDS: Record<string, string> = {
  "Adaptive Force": "perk-images/StatMods/StatModsAdaptiveForceIcon.png",
  "Attack Speed": "perk-images/StatMods/StatModsAttackSpeedIcon.png",
  "Ability Haste": "perk-images/StatMods/StatModsCDRScalingIcon.png",
  Health: "perk-images/StatMods/StatModsHealthPlusIcon.png",
  "Health Scaling": "perk-images/StatMods/StatModsHealthScalingIcon.png",
  "Move Speed": "perk-images/StatMods/StatModsMovementSpeedIcon.png",
  "Tenacity and Slow Resist": "perk-images/StatMods/StatModsTenacityIcon.png",
};

/** The shapes that go into image URLs, so a strange Data Dragon value never reaches a page. */
const ITEM_ID = /^\d{1,7}$/;
const SPELL_ID = /^[A-Za-z0-9]{1,40}$/;
const RUNE_ICON = /^perk-images\/[A-Za-z0-9_./-]{1,160}\.png$/;

const key = (name: string) => name.trim().toLowerCase();
/** Distinct names in a fixed order, so the file only changes when the names do. */
const sorted = (names: Iterable<string>) => Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "en"));

function itemKind(item: DdItem, all: Record<string, DdItem>): ItemKind {
  const tags = item.tags ?? [];
  const isBoots = (it: DdItem) => (it.tags ?? []).includes("Boots");
  // Tier 2 boots, and tier 3 boots built from them (Gunmetal Greaves has no Boots tag of its own).
  if ((isBoots(item) && (item.depth ?? 1) >= 2) || (item.from ?? []).some((f) => all[f] && isBoots(all[f])))
    return "boots";
  const finished = !(item.into ?? []).length && !item.consumed;
  if (finished && tags.includes("GoldPer") && (item.gold?.total ?? 0) < 1000) return "support";
  if (finished && (item.gold?.total ?? 0) >= 2000) return "legendary";
  return "other";
}

/**
 * Resolves the names to icons. Item names match case-insensitively ("Blade of the Ruined King" is "Blade of The
 * Ruined King" in Data Dragon) among Summoner's Rift items, preferring the plain id over the Arena copies.
 */
export function buildLoadoutIndex(
  version: string,
  itemJson: { data: Record<string, DdItem> },
  runeJson: DdRuneTree[],
  spellJson: { data: Record<string, DdSpell> },
  names: LoadoutNames,
): { index: LoadoutIndex; missing: string[] } {
  const missing: string[] = [];
  const index: LoadoutIndex = { version, items: {}, runes: {}, spells: {} };

  const itemsByName = new Map<string, string>();
  for (const [id, item] of Object.entries(itemJson.data)) {
    if (!item.maps?.["11"] || !ITEM_ID.test(id)) continue;
    const k = key(item.name);
    const prev = itemsByName.get(k);
    if (!prev || id.length < prev.length || (id.length === prev.length && Number(id) < Number(prev)))
      itemsByName.set(k, id);
  }
  for (const name of sorted(names.items)) {
    const id = itemsByName.get(key(name));
    if (id) index.items[name] = { id, kind: itemKind(itemJson.data[id], itemJson.data) };
    else missing.push(`item ${name}`);
  }

  const runeIcons = new Map<string, string>();
  for (const tree of runeJson) {
    runeIcons.set(key(tree.name), tree.icon);
    for (const slot of tree.slots) for (const r of slot.runes) runeIcons.set(key(r.name), r.icon);
  }
  for (const [name, icon] of Object.entries(STAT_SHARDS)) runeIcons.set(key(name), icon);
  for (const name of sorted(names.runes)) {
    const icon = runeIcons.get(key(name));
    if (icon && RUNE_ICON.test(icon)) index.runes[name] = icon;
    else missing.push(`rune ${name}`);
  }

  const spellsByName = new Map<string, string>();
  for (const spell of Object.values(spellJson.data)) {
    if (!SPELL_ID.test(spell.id)) continue;
    const k = key(spell.name);
    // Mode-specific copies (ARAM, Arena) share some names; the Summoner's Rift one wins.
    if (!spellsByName.has(k) || spell.modes?.includes("CLASSIC")) spellsByName.set(k, spell.id);
  }
  for (const name of sorted(names.spells)) {
    const id = spellsByName.get(key(name));
    if (id) index.spells[name] = id;
    else missing.push(`summoner spell ${name}`);
  }
  return { index, missing };
}

export async function fetchLoadoutIndex(
  version: string,
  names: LoadoutNames,
  fetchImpl: typeof fetch = fetch,
): Promise<{ index: LoadoutIndex; missing: string[] }> {
  const get = async <T>(file: string): Promise<T> => {
    const res = await fetchImpl(`${DDRAGON_BASE}/cdn/${version}/data/en_US/${file}`);
    if (!res.ok) throw new Error(`Data Dragon ${file} ${version}: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  const [items, runes, spells] = await Promise.all([
    get<{ data: Record<string, DdItem> }>("item.json"),
    get<DdRuneTree[]>("runesReforged.json"),
    get<{ data: Record<string, DdSpell> }>("summoner.json"),
  ]);
  return buildLoadoutIndex(version, items, runes, spells, names);
}

/** The names to resolve, from the player rows. */
export function loadoutNames(
  rows: readonly {
    items: string[];
    trinket: string | null;
    runes: string[];
    keystone: string | null;
    primaryTree: string | null;
    secondaryTree: string | null;
    summonerSpells: string[];
  }[],
): LoadoutNames {
  const items = new Set<string>();
  const runes = new Set<string>();
  const spells = new Set<string>();
  for (const r of rows) {
    for (const i of r.items) items.add(i);
    if (r.trinket) items.add(r.trinket);
    for (const x of [...r.runes, r.keystone, r.primaryTree, r.secondaryTree]) if (x) runes.add(x);
    for (const s of r.summonerSpells) spells.add(s);
  }
  return { items, runes, spells };
}

export function itemIconUrl(version: string, id: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/item/${id}.png`;
}

export function runeIconUrl(icon: string): string {
  return `${DDRAGON_BASE}/cdn/img/${icon}`;
}

export function spellIconUrl(version: string, id: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/spell/${id}.png`;
}
