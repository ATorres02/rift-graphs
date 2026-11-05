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

export interface TimelineTeam {
  /** One value per sample, at the game times in `GameTimeline.t`. */
  gold: number[];
  kills: number[];
  towers: number[];
  inhibitors: number[];
  barons: number[];
  dragons: number[];
  /** Dragons in the order taken, as the feed names them (ocean, infernal, chemtech, elder...). */
  dragonTypes: string[];
}

/** A whole game every `step` seconds of game time, as stored by the ingest (data/<tournament>/gold-timeline.json). */
export interface GameTimeline {
  esportsGameId: string;
  /** Seconds of game time between samples. */
  step: number;
  /** Game time of each sample, in seconds: every `step`, the last one at the end. */
  t: number[];
  /** Game time of the last sample, in seconds: the end of the game, or where the frames stop. */
  end: number;
  /** Pauses found and taken out, in seconds. */
  pausedSeconds: number;
  blue: TimelineTeam;
  red: TimelineTeam;
}

/**
 * The whole game, sampled every `stepMs` of game time with pauses taken out (a pause shorter than the step can slip
 * through between two samples, as in readEarlyGame). The last sample is the first finished frame, with the final
 * totals. About two feed requests per minute of game, plus a few per pause.
 */
export async function readTimeline(
  esportsGameId: string,
  read: WindowReader,
  maxGameMs: number,
  stepMs = 30_000,
): Promise<GameTimeline | null> {
  const opening = await read();
  if (!opening.frames.length) return null;
  const t0 = time(opening.frames[0]);
  const start = await firstFrame(read, t0, t0 + 20 * 60_000, (f) => f.blueTeam.totalGold > 0);
  if (!start) return null;
  const ts = time(start);
  /**
   * The first frame at or after a wall-clock time, looking at most one window ahead. During a pause the feed sends no
   * new frames: a window then repeats the frames before it, the last one paused, and `before` is that frame.
   */
  const frameAt = async (at: number) => {
    const frames = (await read(at)).frames;
    const f = frames.find((x) => time(x) >= at) ?? (await read(at + STEP)).frames.find((x) => time(x) >= at) ?? null;
    return { f, before: frames.filter((x) => time(x) < at).at(-1) ?? null };
  };

  /**
   * The first frame of play after a pause, window by window: a long stop can resume briefly and pause again, which a
   * binary search skips (seen in a 40-minute stop on 29 Oct 2026). Pauses are rare, so the extra requests are few.
   */
  const resumeAfter = async (from: number) => {
    for (let at = from; at <= from + 60 * 60_000; at += STEP) {
      const hit = (await read(at)).frames.find((x) => time(x) > from && x.gameState !== "paused");
      if (hit) return hit;
    }
    return null;
  };

  const samples: { t: number; f: FeedFrame }[] = [];
  /** Each pause: where it started, the frame play resumed with, and the first sample after it. */
  const pauses: { start: FeedFrame; resume: FeedFrame; index: number }[] = [];
  let paused = 0;
  let prev = ts;
  // Some slack past the scoreboard's length: the feed's clock and Leaguepedia's can differ by a few seconds.
  for (let i = 0; i * stepMs <= maxGameMs + 3 * 60_000; i++) {
    const at = ts + i * stepMs + paused;
    const { f, before } = await frameAt(at);
    const pause = f?.gameState === "paused" ? f : !f && before?.gameState === "paused" ? before : null;
    if (pause) {
      const pauseStart = await firstFrame(read, prev, time(pause), (x) => x.gameState === "paused");
      const resume = await resumeAfter(time(pause));
      if (!resume) break;
      paused += time(resume) - time(pauseStart ?? pause);
      pauses.push({ start: pauseStart ?? pause, resume, index: samples.length });
      i -= 1; // the same game time again, past the pause
      continue;
    }
    // The game can end between two samples, after which the feed may only repeat its last frames.
    const finished = f?.gameState === "finished" ? f : !f && before?.gameState === "finished" ? before : null;
    if (finished) {
      const last = (await firstFrame(read, prev, time(finished), (x) => x.gameState === "finished")) ?? finished;
      samples.push({ t: time(last) - ts - paused, f: last });
      break;
    }
    if (!f) break;
    samples.push({ t: i * stepMs, f });
    prev = time(f);
  }
  if (samples.length < 2) return null;
  // The feed can go quiet for a while as play resumes, which reads as more pause than there was. When the game ended
  // in the feed short of the scoreboard's length, give the missing time back after the pause where gold jumps most.
  const ended = samples[samples.length - 1].f.gameState === "finished";
  const missing = maxGameMs - samples[samples.length - 1].t;
  if (ended && pauses.length && missing > 20_000) {
    const total = (f: FeedFrame) => f.blueTeam.totalGold + f.redTeam.totalGold;
    const worst = pauses.reduce((a, b) =>
      total(b.resume) - total(b.start) > total(a.resume) - total(a.start) ? b : a,
    );
    for (let k = worst.index; k < samples.length; k++) samples[k].t += missing;
    paused -= missing;
  }
  const side = (pick: (f: FeedFrame) => FeedTeam): TimelineTeam => ({
    gold: samples.map((s) => pick(s.f).totalGold),
    kills: samples.map((s) => pick(s.f).totalKills),
    towers: samples.map((s) => pick(s.f).towers),
    inhibitors: samples.map((s) => pick(s.f).inhibitors),
    barons: samples.map((s) => pick(s.f).barons),
    dragons: samples.map((s) => pick(s.f).dragons.length),
    dragonTypes: [...pick(samples[samples.length - 1].f).dragons],
  });
  return {
    esportsGameId,
    step: stepMs / 1000,
    t: samples.map((x) => Math.round(x.t / 1000)),
    end: Math.round(samples[samples.length - 1].t / 1000),
    pausedSeconds: Math.round(paused / 1000),
    blue: side((f) => f.blueTeam),
    red: side((f) => f.redTeam),
  };
}
