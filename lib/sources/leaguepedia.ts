/**
 * Minimal client for Leaguepedia's Cargo tables (lol.fandom.com).
 *
 * Two transports expose the same query language:
 *  - "export": `Special:CargoExport?format=json` (plain array of rows). Not
 *    subject to the strict anonymous `cargoquery` limiter observed in Oct 2026.
 *  - "api": `api.php?action=cargoquery`. Supports bot login for higher limits.
 *
 * Both are paginated with limit/offset, throttled between requests and retried
 * with exponential backoff when a usage limit shows up in the response body
 * (Leaguepedia answers HTTP 200 with an error payload, not 429).
 */

export interface CargoQuery {
  tables: string;
  fields: string;
  where?: string;
  joinOn?: string;
  orderBy?: string;
  groupBy?: string;
  /** Page size (max 500 on the API for anonymous users). */
  limit?: number;
}

export type CargoRow = Record<string, unknown>;
export type Transport = "export" | "api";

export interface LeaguepediaClientOptions {
  transport?: Transport;
  baseUrl?: string;
  userAgent?: string;
  /** Pause between consecutive requests. */
  delayMs?: number;
  /** Total attempts per page (first try + retries). */
  maxAttempts?: number;
  /** First backoff wait; doubles on every retry. */
  backoffBaseMs?: number;
  pageSize?: number;
  credentials?: { username: string; password: string } | null;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class CargoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CargoError";
  }
}

const DEFAULTS = {
  transport: "export" as Transport,
  baseUrl: "https://lol.fandom.com",
  userAgent: "rift-ledger-ingest/0.1 (+https://github.com/unstable-devs/rift-ledger)",
  delayMs: 1500,
  maxAttempts: 5,
  backoffBaseMs: 5000,
  pageSize: 500,
};

/** True when the response body (or status) reports a usage limit or a transient block. */
export function detectRateLimit(status: number, body: string): boolean {
  if (status === 429 || status === 503 || status === 502 || status === 504) return true;
  const head = body.slice(0, 4000);
  if (/"code"\s*:\s*"ratelimited"/i.test(head)) return true;
  if (/rate ?limit/i.test(head) && !/No field named/i.test(head)) return true;
  if (status === 403 && /Just a moment|cf-browser-verification|challenge-platform/i.test(head)) return true;
  return false;
}

/** Parses a successful body into rows, throwing CargoError on query errors. */
export function parseCargoBody(transport: Transport, body: string): CargoRow[] {
  const trimmed = body.trimStart();
  if (transport === "export") {
    if (trimmed.startsWith("Error") || trimmed.startsWith("<")) {
      throw new CargoError(`CargoExport error: ${trimmed.slice(0, 300)}`);
    }
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new CargoError("CargoExport returned a non-array payload");
    return parsed as CargoRow[];
  }
  const parsed = JSON.parse(trimmed) as {
    error?: { code?: string; info?: string };
    cargoquery?: { title: CargoRow }[];
  };
  if (parsed.error) throw new CargoError(`cargoquery error ${parsed.error.code ?? ""}: ${parsed.error.info ?? ""}`);
  if (!Array.isArray(parsed.cargoquery)) throw new CargoError("cargoquery returned no rows array");
  return parsed.cargoquery.map((r) => r.title);
}

export class LeaguepediaClient {
  private readonly opts: Required<Omit<LeaguepediaClientOptions, "credentials" | "fetchImpl" | "sleep" | "log">> & {
    credentials: { username: string; password: string } | null;
    fetchImpl: typeof fetch;
    sleep: (ms: number) => Promise<void>;
    log: (message: string) => void;
  };
  private cookies = new Map<string, string>();
  private loggedIn = false;
  private lastRequestAt = 0;
  requestCount = 0;

  constructor(options: LeaguepediaClientOptions = {}) {
    this.opts = {
      ...DEFAULTS,
      ...stripUndefined(options),
      credentials: options.credentials ?? null,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      log: options.log ?? (() => {}),
    };
  }

  get transport(): Transport {
    return this.opts.transport;
  }

  /** Runs a query and follows limit/offset pagination until a short page comes back. */
  async query(q: CargoQuery): Promise<CargoRow[]> {
    const rows: CargoRow[] = [];
    const limit = q.limit ?? this.opts.pageSize;
    let offset = 0;
    for (;;) {
      const page = await this.fetchPage(q, limit, offset);
      rows.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return rows;
  }

  private async fetchPage(q: CargoQuery, limit: number, offset: number): Promise<CargoRow[]> {
    if (this.opts.transport === "api" && this.opts.credentials && !this.loggedIn) await this.login();
    const url = this.buildUrl(q, limit, offset);
    let attempt = 0;
    for (;;) {
      attempt += 1;
      await this.throttle();
      const { status, body } = await this.request(url);
      if (!detectRateLimit(status, body)) {
        if (status >= 400) throw new CargoError(`HTTP ${status} for ${q.tables}: ${body.slice(0, 200)}`);
        return parseCargoBody(this.opts.transport, body);
      }
      if (attempt >= this.opts.maxAttempts) {
        throw new RateLimitError(`Usage limit persisted after ${attempt} attempts (${q.tables}, offset ${offset})`);
      }
      const wait = this.opts.backoffBaseMs * 2 ** (attempt - 1);
      this.opts.log(
        `usage limit detected (status ${status}); waiting ${Math.round(wait / 1000)}s before attempt ${attempt + 1}`,
      );
      await this.opts.sleep(wait);
    }
  }

  private buildUrl(q: CargoQuery, limit: number, offset: number): string {
    const params = new URLSearchParams();
    params.set("tables", q.tables);
    params.set("fields", q.fields);
    if (q.where) params.set("where", q.where);
    if (q.joinOn) params.set("join_on", q.joinOn);
    if (q.orderBy) params.set("order_by", q.orderBy);
    if (q.groupBy) params.set("group_by", q.groupBy);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("format", "json");
    if (this.opts.transport === "export") {
      return `${this.opts.baseUrl}/wiki/Special:CargoExport?${params.toString()}`;
    }
    params.set("action", "cargoquery");
    return `${this.opts.baseUrl}/api.php?${params.toString()}`;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.opts.delayMs) await this.opts.sleep(this.opts.delayMs - elapsed);
  }

  private async request(url: string, init: RequestInit = {}): Promise<{ status: number; body: string }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", this.opts.userAgent);
    headers.set("Accept", "application/json, text/plain;q=0.8, */*;q=0.5");
    if (this.cookies.size > 0) {
      headers.set("Cookie", Array.from(this.cookies, ([k, v]) => `${k}=${v}`).join("; "));
    }
    this.requestCount += 1;
    this.lastRequestAt = Date.now();
    const res = await this.opts.fetchImpl(url, { ...init, headers, redirect: "follow" });
    this.lastRequestAt = Date.now();
    this.captureCookies(res);
    return { status: res.status, body: await res.text() };
  }

  private captureCookies(res: Response): void {
    const setCookies: string[] =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  /** MediaWiki bot-password login (api.php). Only used with the "api" transport. */
  async login(): Promise<void> {
    const creds = this.opts.credentials;
    if (!creds) return;
    await this.throttle();
    const tokenRes = await this.request(`${this.opts.baseUrl}/api.php?action=query&meta=tokens&type=login&format=json`);
    const token = (JSON.parse(tokenRes.body) as { query?: { tokens?: { logintoken?: string } } }).query?.tokens
      ?.logintoken;
    if (!token) throw new CargoError("Could not obtain a login token");
    const form = new URLSearchParams({
      action: "login",
      lgname: creds.username,
      lgpassword: creds.password,
      lgtoken: token,
      format: "json",
    });
    await this.throttle();
    const loginRes = await this.request(`${this.opts.baseUrl}/api.php`, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = (JSON.parse(loginRes.body) as { login?: { result?: string; reason?: string } }).login;
    if (result?.result !== "Success")
      throw new CargoError(`Login failed: ${result?.result ?? "unknown"} ${result?.reason ?? ""}`);
    this.loggedIn = true;
    this.opts.log(`logged in as ${creds.username}`);
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/* ---------- Value coercion (export returns typed JSON, the API returns strings) ---------- */

export function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length ? asString(v.join(",")) : null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n === null ? null : Math.round(n);
}

export function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "yes" || s === "true";
}

/** Lists arrive as arrays (export) or comma-separated strings (API); empty slots are dropped. */
export function asList(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  const parts = Array.isArray(v) ? v.map((x) => String(x ?? "")) : String(v).split(",");
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Lists that must keep their positions (e.g. five pick slots): empty strings become null. */
export function asSlots(v: unknown, size: number): (string | null)[] {
  const parts = Array.isArray(v)
    ? v.map((x) => String(x ?? ""))
    : v === null || v === undefined
      ? []
      : String(v).split(",");
  const out = parts.map((s) => (s.trim() === "" ? null : s.trim()));
  while (out.length < size) out.push(null);
  return out.slice(0, size);
}
