/**
 * One-off probe of the unofficial lolesports API: saves raw responses under
 * .ingest-cache/lolesports/ (git-ignored) so the ingest source can be designed
 * against real payloads. Not used by the pipeline.
 *
 * Usage: pnpm tsx scripts/probe-lolesports.ts   (reads LOLESPORTS_API_KEY from .env.local or the environment)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: rely on the environment */
}

const KEY = process.env.LOLESPORTS_API_KEY;
if (!KEY) {
  console.error("LOLESPORTS_API_KEY is not set");
  process.exit(1);
}
const BASE = "https://esports-api.lolesports.com/persisted/gw";
const FEED = "https://feed.lolesports.com/livestats/v1";
const OUT = path.resolve(".ingest-cache/lolesports");

type Json = Record<string, unknown>;

async function get(url: string, name: string): Promise<Json | null> {
  const res = await fetch(url, { headers: { "x-api-key": KEY!, accept: "application/json" } });
  const text = await res.text();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, `${name}.json`), text);
  console.log(`${res.status} ${url} -> ${name}.json (${text.length} bytes)`);
  if (!res.ok) return null;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return null;
  }
}

const pick = (o: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Json)[k] : undefined), o);

async function main() {
  const leagues = await get(`${BASE}/getLeagues?hl=en-US`, "leagues");
  const list = (pick(leagues, "data", "leagues") as Json[] | undefined) ?? [];
  const worlds =
    list.find((l) => l.slug === "worlds") ?? list.find((l) => String(l.name).toLowerCase().includes("world"));
  console.log("worlds league:", worlds ? `${worlds.id} ${worlds.slug} ${worlds.name}` : "NOT FOUND");
  if (!worlds) return;

  await get(`${BASE}/getTournamentsForLeague?hl=en-US&leagueId=${worlds.id}`, "tournaments");

  const schedule = await get(`${BASE}/getSchedule?hl=en-US&leagueId=${worlds.id}`, "schedule");
  const events = (pick(schedule, "data", "schedule", "events") as Json[] | undefined) ?? [];
  const pages = pick(schedule, "data", "schedule", "pages") as Json | undefined;
  console.log(`schedule: ${events.length} events on first page; pages:`, pages);
  const states = new Map<string, number>();
  for (const e of events) states.set(String(e.state), (states.get(String(e.state)) ?? 0) + 1);
  console.log("states:", Object.fromEntries(states));
  if (pages?.older)
    await get(`${BASE}/getSchedule?hl=en-US&leagueId=${worlds.id}&pageToken=${pages.older}`, "schedule-older");

  const completed = events.filter((e) => e.state === "completed" && e.type === "match");
  const unstarted = events.filter((e) => e.state === "unstarted" && e.type === "match");
  const inProgress = events.filter((e) => e.state === "inProgress" && e.type === "match");
  const last = completed[completed.length - 1];
  const samples: Array<[string, Json | undefined]> = [
    ["event-completed", last],
    ["event-unstarted", unstarted[0]],
    ["event-inprogress", inProgress[0]],
  ];
  for (const [name, e] of samples) {
    const id = pick(e, "match", "id");
    if (!id) {
      console.log(`${name}: none on this page`);
      continue;
    }
    const details = await get(`${BASE}/getEventDetails?hl=en-US&id=${id}`, name);
    const games = (pick(details, "data", "event", "match", "games") as Json[] | undefined) ?? [];
    console.log(
      `${name}: match ${id}, ${games.length} games:`,
      games.map((g) => `${g.number}:${g.id}:${g.state}`).join(" "),
    );
    if (name === "event-completed" && games[0]?.id) {
      await get(`${BASE}/getGames?hl=en-US&id=${games[0].id}`, "games-completed");
      await get(`${FEED}/window/${games[0].id}`, "window-completed");
      await get(`${FEED}/details/${games[0].id}`, "details-completed");
    }
  }
  await get(`${BASE}/getLive?hl=en-US`, "live");
  await get(`${BASE}/getStandings?hl=en-US&tournamentId=${pick(samples[0][1], "tournament", "id") ?? ""}`, "standings");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
