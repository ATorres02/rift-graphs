import { existsSync } from "node:fs";
import path from "node:path";
import { championRef, type IndexedDataset } from "@/lib/data/load";
import type { ChampionRef } from "@/lib/data/types";
import { laneDuel } from "@/lib/duels";
import { aggregateChampions, ROLES } from "@/lib/metrics";
import { championPool } from "@/lib/preview";
import { championLoadingUrl, championSplashUrl } from "@/lib/sources/ddragon";

/** The homepage hero shows the most picked champion of the tournament. */
export function heroChampion(data: IndexedDataset): ChampionRef | null {
  const mostPicked = aggregateChampions(data.confirmedGames, data.playerGames)
    .filter((c) => c.picks > 0)
    .sort((a, b) => b.picks - a.picks)[0];
  return mostPicked ? championRef(data, mostPicked.champion) : null;
}

/** Art of a team's most played champion, supports aside (they share a few picks across the whole field). */
export function signatureChampion(data: IndexedDataset, teamId: string): ChampionRef | null {
  const counts = new Map<string, number>();
  for (const p of data.playerGames)
    if (p.teamId === teamId && p.role !== "support") counts.set(p.champion, (counts.get(p.champion) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? championRef(data, top[0]) : null;
}

export function signatureArt(data: IndexedDataset, teamId: string) {
  const champion = signatureChampion(data, teamId);
  return champion ? heroArt(champion) : null;
}

/** Everything the homepage may show: the hero's champion and, once the final is set, each finalist's. */
export function homeChampions(data: IndexedDataset): ChampionRef[] {
  const final = data.series.find((s) => s.stage === "final");
  const refs = [
    heroChampion(data),
    ...[final?.team1Id, final?.team2Id].map((id) => (id ? signatureChampion(data, id) : null)),
  ];
  return [...new Map(refs.filter((c): c is ChampionRef => !!c).map((c) => [c.id, c])).values()];
}

/** WebP copies of a champion's art, made before each build by scripts/hero-art.ts (public/art, not in git). */
export function heroArtFiles(ddragonId: string) {
  return { splash: `/art/hero-${ddragonId}-splash.webp`, portrait: `/art/hero-${ddragonId}-loading.webp` };
}

const inPublic = (file: string) => existsSync(path.join(process.cwd(), "public", file));

/**
 * Hero art served from the site itself when the build made the copies: the hero image is the homepage's largest
 * paint, and a second origin (Data Dragon) delays it. Falls back to Data Dragon otherwise.
 */
export function heroArt(champion: ChampionRef, exists: (file: string) => boolean = inPublic) {
  const local = heroArtFiles(champion.id);
  const selfHosted = exists(local.splash) && exists(local.portrait);
  return {
    name: champion.name,
    splash: selfHosted ? local.splash : championSplashUrl(champion.id),
    portrait: selfHosted ? local.portrait : championLoadingUrl(champion.id),
  };
}

/** The final once both teams are known. */
export function finalWithTeams(data: IndexedDataset) {
  const s = data.series.find((x) => x.stage === "final");
  return s?.team1Id && s.team2Id ? s : null;
}

/**
 * Art the final's page shows: each lane player's most played champion (the duel splashes) and each finalist's most
 * played champions (the portraits).
 */
export function finalChampions(data: IndexedDataset): ChampionRef[] {
  const s = finalWithTeams(data);
  if (!s) return [];
  const names = [
    ...ROLES.flatMap((role) => {
      const duel = laneDuel(data, s, role);
      return [duel?.a?.champions[0]?.champion, duel?.b?.champions[0]?.champion];
    }),
    ...[s.team1Id!, s.team2Id!].flatMap((id) => championPool(data.confirmedGames, id).played.map((c) => c.champion)),
  ];
  const refs = names.flatMap((n) => (n ? [championRef(data, n)] : [])).filter((c): c is ChampionRef => !!c);
  return [...new Map(refs.map((c) => [c.id, c])).values()];
}

/** Smaller WebP copies for the final's page, made by scripts/hero-art.ts next to the hero's. */
export function finalArtFiles(ddragonId: string) {
  return { splash: `/art/final-${ddragonId}-splash.webp`, portrait: `/art/final-${ddragonId}-loading.webp` };
}

/** A champion's art for the final's page: the site's own copies when the build made them, Data Dragon otherwise. */
export function finalArt(champion: ChampionRef, exists: (file: string) => boolean = inPublic) {
  const local = finalArtFiles(champion.id);
  return {
    name: champion.name,
    splash: exists(local.splash) ? local.splash : championSplashUrl(champion.id),
    portrait: exists(local.portrait) ? local.portrait : championLoadingUrl(champion.id),
  };
}
