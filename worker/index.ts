/**
 * Cloudflare Worker for riftgraphs.com. Static files are served by Workers Static Assets before
 * this script runs; `fetch` only sees requests that match no file and hands them back to the
 * assets (404 page). `scheduled` runs every two minutes and starts the GitHub ingest workflow
 * when lib/ingest/trigger.ts says so: GitHub's own cron is too unreliable for match days.
 *
 * Secrets (Cloudflare dashboard): GITHUB_DISPATCH_TOKEN (fine-grained, Actions read and write on
 * this repository only) and LOLESPORTS_API_KEY. Without the token the cron only logs its decision.
 */
import { decide, inPlay, lolesportsAhead, watched, type LastRun, type ScheduleEntry } from "../lib/ingest/trigger";
import { LolesportsClient, fetchLeagueId, fetchSchedule, type LolesportsMatch } from "../lib/sources/lolesports";

interface Env {
  ASSETS: { fetch(input: Request | string): Promise<Response> };
  GITHUB_REPO: string;
  INGEST_WORKFLOW: string;
  GITHUB_DISPATCH_TOKEN?: string;
  LOLESPORTS_API_KEY?: string;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

const LOLESPORTS_LEAGUE_SLUG = "worlds";
const HOUR_MS = 60 * 60_000;
let leagueId: string | null = null;

const log = (message: string) => console.log(`[cron] ${message}`);

function githubHeaders(env: Env): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "rift-graphs-cron",
    "x-github-api-version": "2022-11-28",
    ...(env.GITHUB_DISPATCH_TOKEN ? { authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}` } : {}),
  };
}

async function lastIngestRun(env: Env): Promise<LastRun | null> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.INGEST_WORKFLOW}/runs?per_page=1`;
  const res = await fetch(url, { headers: githubHeaders(env) });
  if (!res.ok) throw new Error(`GitHub runs: HTTP ${res.status}`);
  const body = (await res.json()) as { workflow_runs?: { created_at: string; status: string }[] };
  const run = body.workflow_runs?.[0];
  return run ? { createdAt: run.created_at, active: run.status !== "completed" } : null;
}

async function dispatchIngest(env: Env): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.INGEST_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...githubHeaders(env), "content-type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch: HTTP ${res.status} ${await res.text()}`);
}

async function lolesportsMatches(env: Env, now: number): Promise<LolesportsMatch[] | null> {
  if (!env.LOLESPORTS_API_KEY) return null;
  try {
    const client = new LolesportsClient({ apiKey: env.LOLESPORTS_API_KEY, log });
    leagueId ??= await fetchLeagueId(client, LOLESPORTS_LEAGUE_SLUG);
    const range = { since: new Date(now - 13 * HOUR_MS).toISOString(), until: new Date(now + HOUR_MS).toISOString() };
    return await fetchSchedule(client, leagueId, range, 2);
  } catch (err) {
    log(`lolesports unavailable (${err instanceof Error ? err.message : String(err)}); periodic refresh only`);
    return null;
  }
}

async function tick(env: Env, now: number): Promise<void> {
  const res = await env.ASSETS.fetch("https://riftgraphs.com/api/schedule.json");
  if (!res.ok) return log(`schedule.json: HTTP ${res.status}`);
  const schedule = (await res.json()) as ScheduleEntry[];
  const near = watched(schedule, now);
  if (!near.length) return; // no match around: nothing to do, nothing to log
  const playing = inPlay(schedule, now);
  const matches = await lolesportsMatches(env, now);
  const ahead = matches ? lolesportsAhead(schedule, matches) : null;
  if (!ahead && !playing.length) return; // only upcoming series, and lolesports has nothing new
  // Without the token the cron only logs, so it does not spend GitHub's anonymous rate limit either.
  const lastRun = env.GITHUB_DISPATCH_TOKEN ? await lastIngestRun(env) : null;
  const decision = decide({ ahead, inPlay: playing.length > 0, lastRun, now });
  log(`${near.map((s) => s.id).join(", ")}: ${decision.reason}`);
  if (!decision.dispatch) return;
  if (!env.GITHUB_DISPATCH_TOKEN) return log("GITHUB_DISPATCH_TOKEN not set; not dispatching");
  await dispatchIngest(env);
  log("ingest workflow dispatched");
}

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await tick(env, event.scheduledTime);
  },
};

export default worker;
