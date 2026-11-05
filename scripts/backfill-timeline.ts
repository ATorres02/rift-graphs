/**
 * Reads the gold graph timeline of every finished game missing from data/<tournament>/gold-timeline.json, several at
 * a time, and writes only that file. The ingest reads a few new games per run; this catches up in one go (first run,
 * or after the feed was down). Needs LOLESPORTS_API_KEY: pnpm exec tsx --env-file=.env.local scripts/backfill-timeline.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readDataset, TOURNAMENT_ID } from "../lib/data/load";
import { timelineCacheSchema } from "../lib/data/schema";
import { fetchTimelines, timelineJson, type TimelineCache } from "../lib/ingest/timeline";
import { feedReader } from "../lib/sources/livestats";
import { LolesportsClient } from "../lib/sources/lolesports";

const FILE = path.join(process.cwd(), "data", TOURNAMENT_ID, "gold-timeline.json");

async function main() {
  const apiKey = process.env.LOLESPORTS_API_KEY;
  if (!apiKey) throw new Error("LOLESPORTS_API_KEY is not set");
  const data = readDataset();
  const cache = (JSON.parse(await readFile(FILE, "utf8").catch(() => "{}")) as TimelineCache) ?? {};
  let requests = 0;
  const started = Date.now();
  const result = await fetchTimelines(data.series, data.games, data.teams, cache, {
    client: new LolesportsClient({ apiKey, log: () => {} }),
    reader: (id) => feedReader(id, { onRequest: () => (requests += 1) }),
    log: (m) => console.warn(`[backfill] ${m}`),
    maxGames: Number(process.env.TIMELINE_MAX_GAMES ?? 500),
    concurrency: Number(process.env.TIMELINE_CONCURRENCY ?? 6),
  });
  const valid = timelineCacheSchema.parse(result.cache);
  await writeFile(FILE, timelineJson(valid), "utf8");
  const missing = data.games.filter((g) => !g.provisional && !(g.id in valid)).length;
  console.log(
    `[backfill] ${result.read} games read, ${result.failed} failed, ${missing} still missing, ${requests} feed requests, ${Math.round((Date.now() - started) / 1000)}s`,
  );
}

main().catch((err: unknown) => {
  console.error("[backfill] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
