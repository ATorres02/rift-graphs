import { describe, expect, it } from "vitest";
import { indexDataset } from "./data/index";
import { getTimelines, readDataset } from "./data/load";
import { computeRecords, pentakills, RECORD_DEPTH, type TournamentRecord } from "./records";
import type { GameTimeline } from "./sources/livestats";

const data = indexDataset(readDataset());
const groups = computeRecords(data, getTimelines());
const records = new Map(groups.flatMap((g) => g.records.map((r) => [r.key, r] as const)));
const ASCENDING = new Set(["shortest-game", "fewest-kills-game"]);

function record(key: string): TournamentRecord {
  const r = records.get(key);
  if (!r) throw new Error(`no record ${key}`);
  return r;
}

describe("computeRecords", () => {
  it("lists at most the record and two runners-up, in order, with shared ranks for ties", () => {
    for (const r of records.values()) {
      expect(r.entries.length).toBeGreaterThan(0);
      expect(r.entries.length).toBeLessThanOrEqual(RECORD_DEPTH);
      r.entries.forEach((e, i) => {
        if (i === 0) return expect(e.rank).toBe(1);
        const prev = r.entries[i - 1];
        if (ASCENDING.has(r.key)) expect(e.value, r.key).toBeGreaterThanOrEqual(prev.value);
        else expect(e.value, r.key).toBeLessThanOrEqual(prev.value);
        expect(e.rank, r.key).toBe(e.value === prev.value ? prev.rank : i + 1);
      });
    }
  });

  it("only uses confirmed games", () => {
    const confirmed = new Set(data.confirmedGames.map((g) => g.id));
    for (const r of records.values())
      for (const e of r.entries) if (e.gameId) expect(confirmed.has(e.gameId), e.gameId).toBe(true);
  });

  it("finds the longest and the shortest game", () => {
    const lengths = data.confirmedGames.map((g) => g.durationSeconds);
    expect(record("longest-game").entries[0].value).toBe(Math.max(...lengths));
    expect(record("shortest-game").entries[0].value).toBe(Math.min(...lengths));
  });

  it("counts only deathless games for the best game without dying", () => {
    for (const e of record("deathless").entries) {
      const row = data.playerGamesByGame.get(e.gameId!)!.find((r) => r.playerId === e.playerId)!;
      expect(row.deaths).toBe(0);
      expect(e.value).toBe(row.kills + row.assists);
    }
  });

  it("hides the records that give away a result", () => {
    expect(record("biggest-comeback").spoiler).toBe(true);
    expect(record("best-win-rate").spoiler).toBe(true);
    expect(record("longest-game").spoiler).toBe(false);
  });

  it("measures a comeback as the largest deficit the winner overcame, winner first", () => {
    const g = data.confirmedGames[0];
    const loser = g.winnerSide === "blue" ? "red" : "blue";
    const team = (gold: number[]) => ({
      gold,
      kills: [0, 0, 0],
      towers: [0, 0, 0],
      inhibitors: [0, 0, 0],
      barons: [0, 0, 0],
      dragons: [0, 0, 0],
      dragonTypes: [],
    });
    const tl: GameTimeline = {
      esportsGameId: "x",
      step: 30,
      t: [0, 30, 60],
      end: 60,
      pausedSeconds: 0,
      [g.winnerSide]: team([2500, 3000, 9000]),
      [loser]: team([2500, 8000, 8500]),
    } as unknown as GameTimeline;
    const only = computeRecords({ ...data, confirmedGames: [g] }, new Map([[g.id, tl]]));
    const comeback = only.flatMap((x) => x.records).find((r) => r.key === "biggest-comeback")!;
    expect(comeback.entries[0]).toMatchObject({ value: 5000, gameId: g.id, teamId: g.winnerTeamId });
  });
});

describe("pentakills", () => {
  it("lists every pentakill of a confirmed game, in order", () => {
    const list = pentakills(data);
    const confirmed = new Map(data.confirmedGames.map((g) => [g.id, g]));
    for (const p of list) {
      expect(p.count).toBeGreaterThan(0);
      expect(confirmed.has(p.gameId)).toBe(true);
    }
    const times = list.map((p) => confirmed.get(p.gameId)!.dateTimeUtc ?? "");
    expect([...times].sort()).toEqual(times);
  });
});
