/**
 * Runs before `next build`: downloads the homepage hero art (the most picked champion) from Data Dragon and saves
 * WebP copies in public/art, so the homepage's largest image comes from the site itself and weighs about a third.
 * Never fails the build: without the copies the homepage loads the art from Data Dragon, as before.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { indexDataset } from "../lib/data/index";
import { readDataset } from "../lib/data/load";
import { finalArtFiles, finalChampions, heroArtFiles, homeChampions } from "../lib/hero-art";
import { championLoadingUrl, championSplashUrl } from "../lib/sources/ddragon";

const PUBLIC = path.join(process.cwd(), "public");
const DIR = path.join(PUBLIC, "art");

async function main() {
  // Copies for an earlier champion go first.
  await rm(DIR, { recursive: true, force: true });
  const data = indexDataset(readDataset());
  const champions = homeChampions(data);
  if (!champions.length) {
    console.log("[hero-art] no champion picked yet, nothing to do");
    return;
  }
  await mkdir(DIR, { recursive: true });
  for (const champion of champions) {
    const files = heroArtFiles(champion.id);
    for (const [url, file] of [
      [championSplashUrl(champion.id), files.splash],
      [championLoadingUrl(champion.id), files.portrait],
    ]) {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const webp = await sharp(Buffer.from(await res.arrayBuffer()))
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(path.join(PUBLIC, file), webp);
      console.log(`[hero-art] ${file} (${Math.round(webp.length / 1024)} KB)`);
    }
  }
  // The final's page: smaller copies, one file at a time (a missing one falls back to Data Dragon on its own).
  for (const champion of finalChampions(data)) {
    const files = finalArtFiles(champion.id);
    for (const [url, file, width] of [
      [championSplashUrl(champion.id), files.splash, 960],
      [championLoadingUrl(champion.id), files.portrait, 308],
    ] as const) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const webp = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 74 })
          .toBuffer();
        await writeFile(path.join(PUBLIC, file), webp);
      } catch (err) {
        console.warn(`[hero-art] ${file} skipped: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log(`[hero-art] final page: ${finalChampions(data).length} champions`);
}

main().catch(async (err: unknown) => {
  // Half a pair would be worse than none: the page only uses the copies when both are there.
  await rm(DIR, { recursive: true, force: true });
  console.warn(`[hero-art] skipped, the hero will load from Data Dragon: ${err instanceof Error ? err.message : err}`);
});
