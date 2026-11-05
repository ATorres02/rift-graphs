import { describe, expect, it } from "vitest";
import {
  parseWindow,
  readEarlyGame,
  readTimeline,
  type FeedFrame,
  type FeedTeam,
  type FeedWindow,
  type WindowReader,
} from "./livestats";

const T = Date.parse("2026-10-23T17:00:00Z");
const ROLES = ["top", "jungle", "mid", "bottom", "support"];

/**
 * A game as the feed would show it, one frame per second: a minute of loading screen with no gold, then the game
 * clock; a two-minute pause at 5:00, red draws first blood at 3:20, blue's gold grows faster than red's.
 */
function game({ pauseAt = 300, pauseFor = 120, endAt = 1800 } = {}) {
  const loading = 60;
  const frames: FeedFrame[] = [];
  for (let wall = 0; wall < loading + endAt + pauseFor; wall++) {
    const paused = wall >= loading + pauseAt && wall < loading + pauseAt + pauseFor;
    const g =
      wall < loading ? -1 : wall < loading + pauseAt ? wall - loading : paused ? pauseAt : wall - loading - pauseFor;
    const team = (perSecond: number, kills: number, base: number) => ({
      totalGold: g < 0 ? 0 : 2500 + perSecond * g,
      totalKills: kills,
      towers: 0,
      inhibitors: 0,
      barons: 0,
      dragons: g >= 600 ? ["ocean"] : [],
      participants: [0, 1, 2, 3, 4].map((i) => ({
        participantId: base + i,
        totalGold: g < 0 ? 0 : 500 + (perSecond / 5) * g + i,
        level: 1,
        kills: 0,
        deaths: 0,
        assists: 0,
        creepScore: g < 0 ? 0 : Math.floor(g / 10) + i,
      })),
    });
    frames.push({
      rfc460Timestamp: new Date(T + wall * 1000).toISOString(),
      gameState: paused ? "paused" : wall >= loading + endAt + pauseFor - 1 ? "finished" : "in_game",
      blueTeam: team(100, g >= 400 ? 1 : 0, 1),
      redTeam: team(90, g >= 200 ? 1 : 0, 6),
    });
  }
  const roles = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, ROLES[i % 5]]));
  let requests = 0;
  const read = async (at?: number): Promise<FeedWindow> => {
    requests += 1;
    const from = at === undefined ? T : Math.floor(at / 10_000) * 10_000;
    return {
      frames: frames.filter(
        (f) => Date.parse(f.rfc460Timestamp) >= from && Date.parse(f.rfc460Timestamp) < from + 10_000,
      ),
      roles,
    };
  };
  return { read, requests: () => requests };
}

describe("readEarlyGame", () => {
  it("finds first blood and the 15:00 snapshot, with the pause added back", async () => {
    const g = game();
    const e = await readEarlyGame("g1", g.read, 1800 * 1000);
    expect(e?.firstBlood).toBe("red");
    expect(e?.pausedSeconds).toBe(120);
    expect(e?.at15?.blue).toEqual({ gold: 2500 + 100 * 900, kills: 1, towers: 0, dragons: 1 });
    expect(e?.at15?.red.gold).toBe(2500 + 90 * 900);
    expect(e?.at15?.players).toHaveLength(10);
    expect(e?.at15?.players.find((p) => p.side === "red" && p.role === "bot")).toMatchObject({
      gold: 500 + 18 * 900 + 3,
      cs: 93,
    });
    expect(g.requests()).toBeLessThan(80);
  });

  it("has no snapshot for a game over before 15:00", async () => {
    const e = await readEarlyGame("g1", game({ endAt: 840, pauseFor: 0 }).read, 840 * 1000);
    expect(e?.firstBlood).toBe("red");
    expect(e?.at15).toBeNull();
  });

  it("reads nothing from a game without frames", async () => {
    expect(await readEarlyGame("g1", async () => ({ frames: [], roles: new Map() }), 1000)).toBeNull();
  });
});

describe("parseWindow", () => {
  it("keeps frames and roles, and drops what does not look like a frame", () => {
    const w = parseWindow({
      gameMetadata: {
        blueTeamMetadata: { participantMetadata: [{ participantId: 1, role: "top" }] },
        redTeamMetadata: { participantMetadata: [{ participantId: 6, role: "bottom" }] },
      },
      frames: [{ rfc460Timestamp: "2026-10-23T17:00:00Z", blueTeam: {}, redTeam: {} }, { nope: true }],
    });
    expect(w.frames).toHaveLength(1);
    expect(w.roles.get(6)).toBe("bottom");
  });
});

/* ------------------------------------------------------------------ timeline over a simulated feed */

interface Sim {
  /** Seconds of game time; play starts 60 s after the first frame. */
  end: number;
  /** A pause at this game time, lasting `pauseFor` wall-clock seconds. */
  pauseAt?: number;
  pauseFor?: number;
  /** After the pause, the feed sends nothing for this many seconds of play. */
  silentAfterPause?: number;
}

const W0 = Date.parse("2026-11-03T22:00:00Z");

/** One frame a second, like the feed: frozen with a single paused frame during a pause, nothing after the end. */
function simulatedFeed(sim: Sim): WindowReader {
  const frames: FeedFrame[] = [];
  const frame = (wall: number, game: number | null, state: string): FeedFrame => {
    const team = (rate: number): FeedTeam => ({
      totalGold: game === null ? 0 : 2500 + rate * game,
      totalKills: 0,
      towers: 0,
      inhibitors: 0,
      barons: 0,
      dragons: [],
      participants: [],
    });
    return { rfc460Timestamp: new Date(wall).toISOString(), gameState: state, blueTeam: team(10), redTeam: team(9) };
  };
  for (let s = 0; s < 60; s++) frames.push(frame(W0 + s * 1000, null, "in_game"));
  let wall = W0 + 60_000;
  for (let g = 0; g <= sim.end; g++) {
    if (sim.pauseAt !== undefined && g === sim.pauseAt) {
      frames.push(frame(wall, g, "paused"));
      wall += (sim.pauseFor ?? 0) * 1000;
      if (sim.silentAfterPause) {
        wall += sim.silentAfterPause * 1000;
        g += sim.silentAfterPause;
      }
    }
    frames.push(frame(wall, g, g === sim.end ? "finished" : "in_game"));
    wall += 1000;
  }
  return async (at) => {
    if (at === undefined) return { frames: frames.slice(0, 10), roles: new Map() };
    const k = Math.floor(at / 10_000) * 10_000;
    const inside = frames.filter(
      (f) => Date.parse(f.rfc460Timestamp) >= k && Date.parse(f.rfc460Timestamp) < k + 10_000,
    );
    // Like the feed: a window with nothing new repeats the frames before it.
    return {
      frames: inside.length ? inside : frames.filter((f) => Date.parse(f.rfc460Timestamp) < k).slice(-10),
      roles: new Map(),
    };
  };
}

describe("readTimeline", () => {
  it("samples every 30 s of game time and ends on the finished frame", async () => {
    const tl = (await readTimeline("g", simulatedFeed({ end: 615 }), 615_000))!;
    expect(tl.t.slice(0, 3)).toEqual([0, 30, 60]);
    expect(tl.t.at(-1)).toBe(615);
    expect(tl.end).toBe(615);
    expect(tl.blue.gold[2]).toBe(2500 + 10 * 60);
    expect(tl.red.gold.at(-1)).toBe(2500 + 9 * 615);
    expect(tl.pausedSeconds).toBe(0);
  });

  it("takes a pause out, so samples after it still read the game time", async () => {
    const tl = (await readTimeline("g", simulatedFeed({ end: 600, pauseAt: 190, pauseFor: 95 }), 600_000))!;
    expect(tl.pausedSeconds).toBeGreaterThanOrEqual(94);
    expect(tl.pausedSeconds).toBeLessThanOrEqual(96);
    const i = tl.t.indexOf(300);
    expect(Math.abs(tl.blue.gold[i] - (2500 + 10 * 300))).toBeLessThanOrEqual(10);
    expect(tl.end).toBeGreaterThanOrEqual(599);
  });

  it("gives back play the feed missed after a pause when the game ends short of the scoreboard", async () => {
    const tl = (await readTimeline(
      "g",
      simulatedFeed({ end: 900, pauseAt: 300, pauseFor: 120, silentAfterPause: 240 }),
      900_000,
    ))!;
    expect(Math.abs(tl.end - 900)).toBeLessThanOrEqual(2);
    expect(tl.pausedSeconds).toBeGreaterThanOrEqual(119);
    expect(tl.pausedSeconds).toBeLessThanOrEqual(121);
    // The first sample after the gap sits at its real game time.
    const after = tl.t.findIndex((t) => t > 300);
    expect(Math.abs(tl.blue.gold[after] - (2500 + 10 * tl.t[after]))).toBeLessThanOrEqual(20);
  });

  it("has nothing for a game without frames", async () => {
    expect(await readTimeline("g", async () => ({ frames: [], roles: new Map() }), 600_000)).toBeNull();
  });
});
