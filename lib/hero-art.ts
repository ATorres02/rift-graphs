import { existsSync } from "node:fs";
import path from "node:path";
import { championRef, type IndexedDataset } from "@/lib/data/load";
import type { ChampionRef } from "@/lib/data/types";
import { aggregateChampions } from "@/lib/metrics";
import { championLoadingUrl, championSplashUrl } from "@/lib/sources/ddragon";

/** The homepage hero shows the most picked champion of the tournament. */
export function heroChampion(data: IndexedDataset): ChampionRef | null {
  const mostPicked = aggregateChampions(data.confirmedGames, data.playerGames)
    .filter((c) => c.picks > 0)
    .sort((a, b) => b.picks - a.picks)[0];
  return mostPicked ? championRef(data, mostPicked.champion) : null;
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
