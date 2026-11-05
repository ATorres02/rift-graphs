/**
 * Runs before `next build`: downloads from Data Dragon the splash art of each lane duel player's most played champion
 * and saves a half-card crop (600 x 630 JPEG) in .cache/duel-art, which the duel share cards inline. Keeps what is
 * already there. Never fails the build: a card without its art shows the plain backdrop.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { championRef } from "../lib/data/load";
import { indexDataset } from "../lib/data/index";
import { readDataset } from "../lib/data/load";
import { duelArtFile, duelSeries, laneDuel } from "../lib/duels";
import { ROLES } from "../lib/metrics";
import { championSplashUrl } from "../lib/sources/ddragon";

async function main() {
  const data = indexDataset(readDataset());
  const ids = new Set<string>();
  for (const s of duelSeries(data)) {
    for (const role of ROLES) {
      const duel = laneDuel(data, s, role);
      for (const side of [duel?.a, duel?.b]) {
        const top = side?.champions[0];
        const ref = top ? championRef(data, top.champion) : null;
        if (ref) ids.add(ref.id);
      }
    }
  }
  const todo = [...ids].filter((id) => !existsSync(duelArtFile(id)));
  if (!todo.length) {
    console.log(`[duel-art] ${ids.size} champions, all cached`);
    return;
  }
  await mkdir(path.dirname(duelArtFile("x")), { recursive: true });
  let saved = 0;
  for (const id of todo) {
    try {
      const res = await fetch(championSplashUrl(id), { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The splash is 1215 x 717 with the champion near the middle: scaled to the card's height, keep the centre.
      const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: 600, height: 630, fit: "cover", position: "centre" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      await writeFile(duelArtFile(id), jpg);
      saved += 1;
    } catch (err) {
      console.warn(`[duel-art] ${id} skipped: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[duel-art] ${saved} new, ${ids.size - todo.length} cached, ${ids.size} champions`);
}

main().catch((err: unknown) => {
  console.warn(`[duel-art] skipped, duel cards will show no art: ${err instanceof Error ? err.message : err}`);
});
