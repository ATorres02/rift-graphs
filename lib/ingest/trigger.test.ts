import { describe, expect, it } from "vitest";
import type { LolesportsMatch } from "../sources/lolesports";
import { COOLDOWN_MS, PERIODIC_MS, decide, inPlay, lolesportsAhead, watched, type ScheduleEntry } from "./trigger";

const NOW = Date.parse("2026-10-28T22:05:00Z");

const entry = (partial: Partial<ScheduleEntry>): ScheduleEntry => ({
  id: "s",
  dateTimeUtc: "2026-10-28T23:00:00Z",
  status: "scheduled",
  score: null,
  provisional: false,
  gamesPlayed: 0,
  scoreboards: 0,
  lolesportsMatchId: "m",
  ...partial,
});

const match = (partial: Partial<LolesportsMatch> & { wins?: [number, number] }): LolesportsMatch => ({
  id: "m",
  startTime: "2026-10-28T23:00:00Z",
  state: "unstarted",
  block: "Swiss",
  stage: "swiss",
  bestOf: 3,
  teams: [
    { name: "LYON", code: "LYON", gameWins: partial.wins?.[0] ?? 0, outcome: null },
    { name: "Invictus Gaming", code: "IG", gameWins: partial.wins?.[1] ?? 0, outcome: null },
  ],
  ...partial,
});

describe("watched and inPlay", () => {
  it("checks lolesports from 3 h before a slot and refreshes from 15 min before it, up to 12 h after", () => {
    const schedule = [
      entry({ id: "later-today", dateTimeUtc: "2026-10-28T23:00:00Z" }),
      entry({ id: "soon", dateTimeUtc: "2026-10-28T22:15:00Z" }),
      entry({ id: "early-start", dateTimeUtc: "2026-10-28T23:30:00Z", status: "live" }),
      entry({ id: "live", dateTimeUtc: "2026-10-28T20:00:00Z", status: "live" }),
      entry({ id: "final", dateTimeUtc: "2026-10-28T20:00:00Z", status: "finished", gamesPlayed: 2, scoreboards: 2 }),
      entry({ id: "no-scoreboards", dateTimeUtc: "2026-10-28T17:00:00Z", status: "finished", gamesPlayed: 2 }),
      entry({ id: "yesterday", dateTimeUtc: "2026-10-27T20:00:00Z", status: "live" }),
    ];
    expect(watched(schedule, NOW).map((s) => s.id)).toEqual([
      "later-today",
      "soon",
      "early-start",
      "live",
      "no-scoreboards",
    ]);
    expect(inPlay(schedule, NOW).map((s) => s.id)).toEqual(["soon", "early-start", "live", "no-scoreboards"]);
  });
});

describe("lolesportsAhead", () => {
  it("spots a match that started before its scheduled time", () => {
    expect(lolesportsAhead([entry({})], [match({ state: "inProgress" })])).toBe("LYON vs IG started");
  });
  it("spots a finished game and a finished series", () => {
    const live = entry({ status: "live", score: { team1: 0, team2: 0 } });
    expect(lolesportsAhead([live], [match({ state: "inProgress", wins: [0, 1] })])).toBe("LYON vs IG: game 1 finished");
    expect(lolesportsAhead([live], [match({ state: "completed", wins: [0, 2] })])).toBe("LYON vs IG finished");
  });
  it("stays quiet when the site is up to date or already final", () => {
    const live = entry({ status: "live", score: { team1: 0, team2: 1 } });
    expect(lolesportsAhead([live], [match({ state: "inProgress", wins: [1, 0] })])).toBeNull();
    expect(lolesportsAhead([entry({ status: "finished" })], [match({ state: "inProgress" })])).toBeNull();
    expect(lolesportsAhead([entry({})], [match({})])).toBeNull();
  });
  it("flags only live matches the site cannot place", () => {
    expect(lolesportsAhead([], [match({ id: "x", state: "inProgress" })])).toBe(
      "LYON vs IG is live but not on the site",
    );
    expect(lolesportsAhead([], [match({ id: "x", state: "completed" })])).toBeNull();
  });
});

describe("decide", () => {
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  it("never stacks runs", () => {
    expect(
      decide({ inPlay: true, ahead: "x started", lastRun: { createdAt: ago(PERIODIC_MS * 2), active: true }, now: NOW })
        .dispatch,
    ).toBe(false);
  });
  it("reacts to lolesports after the cooldown", () => {
    expect(
      decide({ inPlay: true, ahead: "x started", lastRun: { createdAt: ago(COOLDOWN_MS), active: false }, now: NOW }),
    ).toEqual({
      dispatch: true,
      reason: "x started",
    });
    expect(
      decide({ inPlay: true, ahead: "x started", lastRun: { createdAt: ago(60_000), active: false }, now: NOW })
        .dispatch,
    ).toBe(false);
  });
  it("refreshes periodically while a series is watched", () => {
    expect(
      decide({ inPlay: true, ahead: null, lastRun: { createdAt: ago(PERIODIC_MS), active: false }, now: NOW }).dispatch,
    ).toBe(true);
    expect(
      decide({ inPlay: true, ahead: null, lastRun: { createdAt: ago(PERIODIC_MS - 1), active: false }, now: NOW })
        .dispatch,
    ).toBe(false);
    expect(decide({ inPlay: true, ahead: null, lastRun: null, now: NOW }).dispatch).toBe(true);
  });
  it("leaves upcoming series alone until lolesports says they started", () => {
    expect(decide({ inPlay: false, ahead: null, lastRun: null, now: NOW }).dispatch).toBe(false);
    expect(decide({ inPlay: false, ahead: "x started", lastRun: null, now: NOW }).dispatch).toBe(true);
  });
});
