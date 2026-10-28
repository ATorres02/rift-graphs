/**
 * Unofficial lolesports.com API (esports-api.lolesports.com), read with the
 * public key embedded in the official site. The pipeline uses it only for
 * provisional series results: whether a series is live, its score and its
 * winner. Riot does not document it, so every call fails soft and the pipeline
 * carries on with Leaguepedia data when it breaks.
 *
 * Observed on 28 Oct 2026: `getSchedule` lists events (state unstarted,
 * inProgress or completed) with the series score per team; `getEventDetails`
 * adds game ids and sides but no per-game winner.
 */
import type { StageId } from "../data/types";

export interface LolesportsClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export type LolesportsState = "unstarted" | "inProgress" | "completed";

export interface LolesportsTeam {
  name: string;
  code: string;
  gameWins: number;
  outcome: "win" | "loss" | null;
}

export interface LolesportsMatch {
  id: string;
  /** ISO 8601 UTC. */
  startTime: string;
  state: LolesportsState;
  /** Block name as shown on lolesports ("Swiss", "Quarterfinals"...). */
  block: string;
  stage: StageId | null;
  bestOf: number;
  teams: [LolesportsTeam, LolesportsTeam];
}

export class LolesportsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LolesportsError";
  }
}

const DEFAULT_BASE_URL = "https://esports-api.lolesports.com/persisted/gw";
const STATES = new Set<LolesportsState>(["unstarted", "inProgress", "completed"]);

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export class LolesportsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (message: string) => void;
  requestCount = 0;

  constructor(options: LolesportsClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    // Bound: Cloudflare Workers throw "Illegal invocation" when fetch is called as a method of another object.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.log = options.log ?? (() => {});
  }

  /** GET one endpoint; retries once on network errors and 5xx. */
  async get(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set("hl", "en-US");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        this.requestCount += 1;
        const res = await this.fetchImpl(url, {
          headers: { "x-api-key": this.apiKey, accept: "application/json" },
          signal: controller.signal,
        });
        if (res.status >= 500) throw new LolesportsError(`${endpoint}: HTTP ${res.status}`);
        if (!res.ok) throw new LolesportsError(`${endpoint}: HTTP ${res.status} (no retry)`);
        return (await res.json()) as unknown;
      } catch (err) {
        lastError = err;
        const retryable = !(err instanceof LolesportsError && err.message.includes("no retry"));
        if (!retryable || attempt === 2) break;
        this.log(`lolesports ${endpoint} failed (${err instanceof Error ? err.message : String(err)}); retrying`);
        await this.sleep(1000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new LolesportsError(String(lastError));
  }
}

/** Maps lolesports block names to the site's stages. */
export function stageFromBlock(block: string): StageId | null {
  const b = block.trim().toLowerCase();
  if (b.startsWith("play")) return "playin";
  if (b.startsWith("swiss")) return "swiss";
  if (b.startsWith("quarter")) return "quarterfinals";
  if (b.startsWith("semi")) return "semifinals";
  if (b.startsWith("final") || b.startsWith("grand")) return "final";
  return null;
}

function parseTeam(v: unknown): LolesportsTeam | null {
  const t = obj(v);
  if (!t) return null;
  const name = str(t.name);
  const code = str(t.code);
  if (!name || !code) return null;
  const result = obj(t.result);
  const outcome = str(result?.outcome);
  return {
    name,
    code,
    gameWins: num(result?.gameWins) ?? 0,
    outcome: outcome === "win" || outcome === "loss" ? outcome : null,
  };
}

/** Pure: turns a `getSchedule` payload into matches plus the token of the older page. */
export function parseScheduleEvents(payload: unknown): { matches: LolesportsMatch[]; olderToken: string | null } {
  const schedule = obj(obj(obj(payload)?.data)?.schedule);
  const events = Array.isArray(schedule?.events) ? schedule.events : [];
  const matches: LolesportsMatch[] = [];
  for (const raw of events) {
    const e = obj(raw);
    if (!e || e.type !== "match") continue;
    const match = obj(e.match);
    const id = str(match?.id);
    const startTime = str(e.startTime);
    const state = str(e.state) as LolesportsState | null;
    const teams = Array.isArray(match?.teams) ? match.teams.map(parseTeam) : [];
    if (!id || !startTime || !state || !STATES.has(state) || teams.length !== 2 || !teams[0] || !teams[1]) continue;
    const block = str(e.blockName) ?? "";
    matches.push({
      id,
      startTime,
      state,
      block,
      stage: stageFromBlock(block),
      bestOf: num(obj(match?.strategy)?.count) ?? 1,
      teams: [teams[0], teams[1]],
    });
  }
  return { matches, olderToken: str(obj(schedule?.pages)?.older) };
}

export async function fetchLeagueId(client: LolesportsClient, slug: string): Promise<string> {
  const payload = await client.get("getLeagues");
  const leagues = obj(obj(payload)?.data)?.leagues;
  const list = Array.isArray(leagues) ? leagues.map(obj) : [];
  const league = list.find((l) => l && l.slug === slug);
  const id = str(league?.id);
  if (!id) throw new LolesportsError(`league "${slug}" not found in getLeagues`);
  return id;
}

/**
 * Matches of one league between two instants (ISO strings). The first page
 * covers roughly the last year up to the future; older pages are fetched only
 * while the page still reaches back past `since`.
 */
export async function fetchSchedule(
  client: LolesportsClient,
  leagueId: string,
  range: { since: string; until: string },
  maxPages = 6,
): Promise<LolesportsMatch[]> {
  const byId = new Map<string, LolesportsMatch>();
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = token ? { leagueId, pageToken: token } : { leagueId };
    const { matches, olderToken } = parseScheduleEvents(await client.get("getSchedule", params));
    for (const m of matches) if (m.startTime >= range.since && m.startTime <= range.until) byId.set(m.id, m);
    const earliest = matches.reduce<string | null>(
      (acc, m) => (acc === null || m.startTime < acc ? m.startTime : acc),
      null,
    );
    if (!olderToken || earliest === null || earliest < range.since) break;
    token = olderToken;
  }
  return Array.from(byId.values()).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}
