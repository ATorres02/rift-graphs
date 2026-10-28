import type { ChampionIndex } from "@/lib/data/types";

export const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

export async function fetchDdragonVersions(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`${DDRAGON_BASE}/api/versions.json`);
  if (!res.ok) throw new Error(`Data Dragon versions: HTTP ${res.status}`);
  return (await res.json()) as string[];
}

/**
 * Maps a Leaguepedia patch ("26.20") to the matching Data Dragon version.
 * Observed convention: patch YY.NN ↔ Data Dragon (YY-10).NN.x (25.x ↔ 15.x, 26.x ↔ 16.x).
 * Falls back to the latest version when nothing matches.
 */
export function pickDdragonVersion(versions: string[], patch: string | null): string {
  if (!versions.length) throw new Error("Data Dragon returned no versions");
  if (patch) {
    const m = /^(\d{2})\.(\d{1,2})$/.exec(patch.trim());
    if (m) {
      const prefix = `${Number(m[1]) - 10}.${Number(m[2])}.`;
      const found = versions.find((v) => v.startsWith(prefix));
      if (found) return found;
    }
  }
  return versions[0];
}

interface ChampionJson {
  version: string;
  data: Record<string, { id: string; key: string; name: string; title: string }>;
}

export async function fetchChampionIndex(version: string, fetchImpl: typeof fetch = fetch): Promise<ChampionIndex> {
  const res = await fetchImpl(`${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`);
  if (!res.ok) throw new Error(`Data Dragon champion.json ${version}: HTTP ${res.status}`);
  const json = (await res.json()) as ChampionJson;
  const champions = Object.values(json.data)
    .map((c) => ({ id: c.id, key: c.key, name: c.name, title: c.title }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { version: json.version, champions };
}

/** Normalises a champion name so "K'Sante", "KSante" and "k sante" compare equal. */
export function normalizeChampionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function championIconUrl(version: string, ddragonId: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${ddragonId}.png`;
}

/** Vertical "loading screen" art, 308×560, about 55 KB. Not versioned on the CDN. */
export function championLoadingUrl(ddragonId: string, skin = 0): string {
  return `${DDRAGON_BASE}/cdn/img/champion/loading/${ddragonId}_${skin}.jpg`;
}

/** Full splash art, 1215×717, about 160 KB. Not versioned on the CDN. */
export function championSplashUrl(ddragonId: string, skin = 0): string {
  return `${DDRAGON_BASE}/cdn/img/champion/splash/${ddragonId}_${skin}.jpg`;
}

/** Route segment for a champion page: the Data Dragon id in lower case ("ksante"). */
export function championSlug(ddragonId: string): string {
  return ddragonId.toLowerCase();
}
