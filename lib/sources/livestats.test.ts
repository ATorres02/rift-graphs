import { describe, expect, it } from "vitest";
import { parseWindow, readEarlyGame, type FeedFrame, type FeedWindow } from "./livestats";

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
