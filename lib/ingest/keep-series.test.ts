import { describe, expect, it } from "vitest";
import type { Series } from "../data/types";
import { keepMissingSeries } from "./keep-series";

const series = (over: Partial<Series> = {}): Series => ({
  id: "semifinals-2",
  matchId: "SF2",
  stage: "semifinals",
  tab: "Semifinals",
  round: null,
  bestOf: 5,
  team1Id: "blg",
  team2Id: "t1",
  dateTimeUtc: "2026-11-08T19:00:00Z",
  hasTime: true,
  score: { team1: 2, team2: 1 },
  winnerId: null,
  status: "live",
  matchDay: null,
  patch: null,
  streamUrl: null,
  mvp: null,
  gameIds: ["g1", "g2", "g3"],
  gamesPlayed: 3,
  source: "leaguepedia",
  provisional: false,
  lolesportsMatchId: "123",
  ...over,
});
const other = series({
  id: "semifinals-1",
  matchId: "SF1",
  dateTimeUtc: "2026-11-07T19:00:00Z",
  team1Id: "ig",
  team2Id: "gen",
});

describe("keepMissingSeries", () => {
  it("keeps a series whose schedule row is gone, and warns", () => {
    const r = keepMissingSeries({ current: [other], previous: [other, series()], scheduleMatchIds: new Set(["SF1"]) });
    expect(r.series.map((s) => s.id)).toEqual(["semifinals-1", "semifinals-2"]);
    expect(r.kept).toEqual(["semifinals-2"]);
    expect(r.warnings).toHaveLength(1);
  });

  it("keeps a Leaguepedia score but clears the game ids, which this run fills again", () => {
    const [kept] = keepMissingSeries({ current: [], previous: [series()], scheduleMatchIds: new Set() }).series;
    expect(kept.score).toEqual({ team1: 2, team2: 1 });
    expect(kept.gamesPlayed).toBe(3);
    expect(kept.gameIds).toEqual([]);
  });

  it("drops a provisional result so the merge cannot take it as final", () => {
    const previous = [series({ provisional: true, source: "lolesports", winnerId: "blg", status: "finished" })];
    const [kept] = keepMissingSeries({ current: [], previous, scheduleMatchIds: new Set() }).series;
    expect(kept).toMatchObject({ score: null, winnerId: null, status: "live", provisional: false, gamesPlayed: 0 });
  });

  it("does not keep a series whose row exists but was skipped (nullified)", () => {
    const r = keepMissingSeries({ current: [], previous: [series()], scheduleMatchIds: new Set(["SF2"]) });
    expect(r.series).toEqual([]);
  });

  it("does not keep a series created by a manual file", () => {
    const previous = [series({ matchId: "manual:semifinals-2", source: "manual", provisional: true })];
    expect(keepMissingSeries({ current: [], previous, scheduleMatchIds: new Set() }).series).toEqual([]);
  });

  it("does not duplicate a series whose row was renamed", () => {
    const renamed = series({ id: "semifinals-b", matchId: "SFB", team1Id: "t1", team2Id: "blg" });
    const r = keepMissingSeries({ current: [renamed], previous: [series()], scheduleMatchIds: new Set(["SFB"]) });
    expect(r.series.map((s) => s.id)).toEqual(["semifinals-b"]);
    expect(r.kept).toEqual([]);
    expect(r.warnings[0]).toContain("replaced by semifinals-b");
  });

  it("changes nothing on a first run or when no row is missing", () => {
    expect(keepMissingSeries({ current: [other], previous: null, scheduleMatchIds: new Set(["SF1"]) }).kept).toEqual(
      [],
    );
    const r = keepMissingSeries({ current: [other], previous: [other], scheduleMatchIds: new Set(["SF1"]) });
    expect(r.series).toEqual([other]);
    expect(r.warnings).toEqual([]);
  });
});
