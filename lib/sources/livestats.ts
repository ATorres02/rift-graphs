/**
 * The lolesports live stats feed (feed.lolesports.com/livestats/v1), the same frames the official site draws its live
 * scoreboard from. Each `window/<gameId>?startingTime=` call returns about ten seconds of frames: game state, team
 * totals and every player's gold, CS and KDA. Frames carry wall-clock times, not the game clock, so a pause shifts
 * everything after it; the reader below finds pauses and adds them back.
 *
 * Checked on 3 Nov 2026 against DPM.LOL for TES and IG (6 games each): first blood rate equal, gold difference at 15
 * within 15 gold on average once pauses are counted.
 */
import type { Role, Side } from "../data/types";

export interface FeedParticipant {
  participantId: number;
  totalGold: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
}

export interface FeedTeam {
  totalGold: number;
  totalKills: number;
  towers: number;
  inhibitors: number;
  barons: number;
  dragons: string[];
  participants: FeedParticipant[];
}

export interface FeedFrame {
  rfc460Timestamp: string;
  gameState: "in_game" | "paused" | "finished" | string;
  blueTeam: FeedTeam;
  redTeam: FeedTeam;
}

export interface FeedWindow {
  frames: FeedFrame[];
  /** participantId → role as the feed names it (top, jungle, mid, bottom, support). */
  roles: Map<number, string>;
}

export interface EarlyTeam {
  gold: number;
  kills: number;
  towers: number;
  dragons: number;
}

export interface EarlyPlayer {
  side: Side;
  role: Role;
  gold: number;
  cs: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
}

/** What one game looked like early on, as stored by the ingest (data/<tournament>/early-game.json). */
export interface EarlyGame {
  esportsGameId: string;
  /** Side that drew first blood; null when no kill was found. */
  firstBlood: Side | null;
  /** Both teams and all ten players at 15:00 of game time; null when the game was shorter or the frames are missing. */
  at15: { blue: EarlyTeam; red: EarlyTeam; players: EarlyPlayer[] } | null;
  /** Pauses before 15:00, in seconds, already added back. */
  pausedSeconds: number;
}

const FEED_ROLE: Record<string, Role> = { top: "top", jungle: "jungle", mid: "mid", bottom: "bot", support: "support" };

const STEP = 10_000;
const time = (f: FeedFrame) => Date.parse(f.rfc460Timestamp);
const kills = (f: FeedFrame) => f.blueTeam.totalKills + f.redTeam.totalKills;

/** Reads a window: `at` in ms since the epoch, or undefined for the first frames of the game. */
export type WindowReader = (at?: number) => Promise<FeedWindow>;

/** The first frame in [lo, hi] matching a predicate that, once true, stays true; null when none does. */
async function firstFrame(
  read: WindowReader,
  lo: number,
  hi: number,
  pred: (f: FeedFrame) => boolean,
): Promise<FeedFrame | null> {
  let a = 0;
  let b = Math.ceil((hi - lo) / STEP);
  let best: FeedFrame | null = null;
  while (a <= b) {
    const m = (a + b) >> 1;
    const hit = (await read(lo + m * STEP)).frames.find(pred);
    if (hit) {
      best = hit;
      b = m - 1;
    } else a = m + 1;
  }
  return best;
}

/**
 * First blood and the 15:00 snapshot of one game. `maxGameMs` bounds the first blood search to the game's length,
 * where every window has frames. Sampling every 30 s finds pauses of that length or more; shorter ones are ignored.
 */
export async function readEarlyGame(
  esportsGameId: string,
  read: WindowReader,
  maxGameMs: number,
  sampleMs = 30_000,
): Promise<EarlyGame | null> {
  const opening = await read();
  if (!opening.frames.length) return null;
  const t0 = time(opening.frames[0]);
  // The game clock starts when the players get their starting gold; the frames before are the loading screen.
  const start = await firstFrame(read, t0, t0 + 20 * 60_000, (f) => f.blueTeam.totalGold > 0);
  if (!start) return null;
  const ts = time(start);

  const fb = await firstFrame(read, ts, ts + maxGameMs, (f) => kills(f) > 0);
  const firstBlood: Side | null = fb ? (fb.blueTeam.totalKills > 0 ? "blue" : "red") : null;

  let paused = 0;
  let t = ts;
  while (t < ts + 15 * 60_000 + paused) {
    const frames = (await read(t)).frames;
    const p = frames.find((f) => f.gameState === "paused");
    if (p) {
      const seen = time(p);
      const back = await firstFrame(read, Math.max(ts, seen - sampleMs), seen, (f) => f.gameState === "paused");
      const pauseStart = back ? time(back) : seen;
      const resume = await firstFrame(
        read,
        seen,
        seen + 20 * 60_000,
        (f) => f.gameState !== "paused" && time(f) > seen,
      );
      if (!resume) break;
      paused += time(resume) - pauseStart;
      t = time(resume);
      continue;
    }
    if (frames.some((f) => f.gameState === "finished")) break;
    t += sampleMs;
  }

  const target = ts + 15 * 60_000 + paused;
  const around = await read(target);
  const after = [...around.frames, ...(await read(target + STEP)).frames].find((f) => time(f) >= target);
  const at15 =
    after && after.gameState === "in_game"
      ? {
          blue: team(after.blueTeam),
          red: team(after.redTeam),
          players: [...players(after.blueTeam, "blue", opening.roles), ...players(after.redTeam, "red", opening.roles)],
        }
      : null;
  return { esportsGameId, firstBlood, at15, pausedSeconds: Math.round(paused / 1000) };
}

function team(t: FeedTeam): EarlyTeam {
  return { gold: t.totalGold, kills: t.totalKills, towers: t.towers, dragons: t.dragons.length };
}

function players(t: FeedTeam, side: Side, roles: Map<number, string>): EarlyPlayer[] {
  return t.participants.flatMap((p) => {
    const role = FEED_ROLE[roles.get(p.participantId) ?? ""];
    return role
      ? [
          {
            side,
            role,
            gold: p.totalGold,
            cs: p.creepScore,
            level: p.level,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
          },
        ]
      : [];
  });
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);

/** Pure: a `window` payload as frames and roles; frames that do not look like frames are dropped. */
export function parseWindow(payload: unknown): FeedWindow {
  const p = obj(payload);
  const frames = (Array.isArray(p?.frames) ? p.frames : []).filter((f): f is FeedFrame => {
    const o = obj(f);
    return typeof o?.rfc460Timestamp === "string" && !!obj(o.blueTeam) && !!obj(o.redTeam);
  });
  const roles = new Map<number, string>();
  const meta = obj(p?.gameMetadata);
  for (const side of ["blueTeamMetadata", "redTeamMetadata"]) {
    const list = obj(meta?.[side])?.participantMetadata;
    for (const m of Array.isArray(list) ? list : []) {
      const o = obj(m);
      if (typeof o?.participantId === "number" && typeof o.role === "string") roles.set(o.participantId, o.role);
    }
  }
  return { frames, roles };
}

/** A window reader over HTTP: no key needed; an empty or missing window reads as no frames. */
export function feedReader(
  esportsGameId: string,
  options: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number; onRequest?: () => void } = {},
): WindowReader {
  const base = (options.baseUrl ?? "https://feed.lolesports.com/livestats/v1").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const cache = new Map<number | undefined, Promise<FeedWindow>>();
  return (at) => {
    // The feed wants a start on a 10 s boundary.
    const key = at === undefined ? undefined : Math.floor(at / STEP) * STEP;
    if (!cache.has(key)) {
      const url = new URL(`${base}/window/${esportsGameId}`);
      if (key !== undefined) url.searchParams.set("startingTime", new Date(key).toISOString().replace(".000", ""));
      options.onRequest?.();
      cache.set(
        key,
        (async () => {
          for (let attempt = 1; ; attempt++) {
            try {
              const res = await fetchImpl(url, {
                headers: { accept: "application/json" },
                signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
              });
              if (res.status === 204 || res.status === 404) return { frames: [], roles: new Map() };
              if (!res.ok) throw new Error(`livestats window: HTTP ${res.status}`);
              return parseWindow(await res.json());
            } catch (err) {
              if (attempt >= 2) throw err;
            }
          }
        })(),
      );
    }
    return cache.get(key)!;
  };
}
