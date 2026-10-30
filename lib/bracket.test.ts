import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, StageId } from "./data/types";
import {
  broadcastDays,
  homeBracket,
  knockoutBracket,
  swissBracket,
  type BracketGroup,
  type BracketOutcome,
} from "./bracket";

const s = (o: Partial<Series>): Series =>
  ({
    id: "s",
    matchId: "m",
    stage: "swiss",
    tab: "Round 1",
    round: 1,
    bestOf: 1,
    team1Id: null,
    team2Id: null,
    dateTimeUtc: "2026-10-23T18:00:00Z",
    hasTime: true,
    score: null,
    winnerId: null,
    status: "scheduled",
    matchDay: null,
    patch: null,
    streamUrl: null,
    mvp: null,
    gameIds: [],
    gamesPlayed: 0,
    source: "leaguepedia",
    provisional: false,
    lolesportsMatchId: null,
    ...o,
  }) as Series;

const TEAMS = Array.from({ length: 16 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);

/** A full simulated Swiss stage: teams with the same record meet, the lower team number always wins. */
function simulateSwiss(playedRounds: number): Series[] {
  const rec = new Map(TEAMS.map((t) => [t, { w: 0, l: 0 }]));
  const out: Series[] = [];
  for (let r = 1; r <= 5; r++) {
    const groups = new Map<string, string[]>();
    for (const t of TEAMS) {
      const { w, l } = rec.get(t)!;
      if (w === 3 || l === 3) continue;
      groups.set(`${w}-${l}`, [...(groups.get(`${w}-${l}`) ?? []), t]);
    }
    let n = 0;
    for (const [key, teams] of groups) {
      for (let i = 0; i < teams.length; i += 2) {
        n += 1;
        const played = r <= playedRounds;
        const [a, b] = [teams[i], teams[i + 1]];
        const decisive = key.includes("2");
        out.push(
          s({
            id: `r${r}-${n}`,
            round: r,
            tab: `Round ${r}`,
            bestOf: r <= 2 || key === "1-1" ? 1 : 3,
            dateTimeUtc: `2026-10-${String(22 + r).padStart(2, "0")}T${String(16 + n).padStart(2, "0")}:00:00Z`,
            team1Id: r <= playedRounds + 1 ? a : null,
            team2Id: r <= playedRounds + 1 ? b : null,
            status: played ? "finished" : "scheduled",
            winnerId: played ? a : null,
            score: played ? { team1: decisive ? 2 : 1, team2: 0 } : null,
          }),
        );
        // Records move on even for unplayed rounds so later rounds get the right number of series.
        rec.get(a)!.w += 1;
        rec.get(b)!.l += 1;
      }
    }
  }
  return out;
}

const groupsOf = (b: ReturnType<typeof swissBracket>, c: number) =>
  b.columns[c].blocks.filter((x): x is BracketGroup => x.kind === "group");
const outcomesOf = (b: ReturnType<typeof swissBracket>) =>
  b.columns.flatMap((c) => c.blocks).filter((x): x is BracketOutcome => x.kind === "outcome");

describe("swissBracket", () => {
  it("lays out five rounds plus a last column of records, with the official slot counts", () => {
    const b = swissBracket(simulateSwiss(0), TEAMS);
    expect(b.columns).toHaveLength(6);
    const shape = b.columns.map((c) =>
      c.blocks.map((x) => `${x.wins}-${x.losses}:${x.kind === "group" ? x.slots.length : x.slots}`),
    );
    expect(shape).toEqual([
      ["0-0:8"],
      ["1-0:4", "0-1:4"],
      ["2-0:2", "1-1:4", "0-2:2"],
      ["3-0:2", "2-1:3", "1-2:3", "0-3:2"],
      ["3-1:3", "2-2:3", "1-3:3"],
      ["3-2:3", "2-3:3"],
    ]);
    expect(b.columns[5].outcomesOnly).toBe(true);
    expect(b.currentRound).toBe(1);
  });

  it("gives every qualified and eliminated record its final places", () => {
    const places = Object.fromEntries(
      outcomesOf(swissBracket([], TEAMS)).map((o) => [`${o.wins}-${o.losses}`, o.places]),
    );
    expect(places).toEqual({
      "3-0": "1st–2nd",
      "3-1": "3rd–5th",
      "3-2": "6th–8th",
      "2-3": "9th–11th",
      "1-3": "12th–14th",
      "0-3": "15th–16th",
    });
  });

  it("places every series in the group of its teams' record and fills the outcome boxes", () => {
    const series = simulateSwiss(5);
    const b = swissBracket(series, TEAMS);
    const placed = b.columns.flatMap((c) => c.blocks).flatMap((x) => (x.kind === "group" ? x.slots : []));
    expect(placed.filter(Boolean)).toHaveLength(series.length);
    expect(placed.every(Boolean)).toBe(true);
    for (const o of outcomesOf(b)) expect(o.teamIds).toHaveLength(o.slots);
    expect(outcomesOf(b).find((o) => o.wins === 3 && o.losses === 0)?.teamIds).toEqual(["t01", "t09"]);
    expect(b.currentRound).toBeNull();
  });

  it("keeps series without teams out of ambiguous groups and in the only open one", () => {
    // Rounds 1-3 played, round 4 known, round 5 still without teams.
    const series = simulateSwiss(3);
    const r5 = series.filter((x) => x.round === 5);
    expect(r5.every((x) => x.team1Id === null)).toBe(true);
    const b = swissBracket(series, TEAMS);
    expect(groupsOf(b, 4)[0].slots.map((x) => x?.id)).toEqual(r5.map((x) => x.id));
    expect(b.currentRound).toBe(4);

    // Round 2 without teams: two groups with room, so the slots stay empty placeholders.
    const early = swissBracket(simulateSwiss(0), TEAMS);
    expect(groupsOf(early, 1).every((g) => g.slots.every((x) => x === null))).toBe(true);
    expect(groupsOf(early, 1)[0].bestOf).toBe(1);
  });

  it("reads the real 2026 Swiss stage", () => {
    const file = path.join(process.cwd(), "data/worlds-2026/series.json");
    const real = JSON.parse(readFileSync(file, "utf8")) as Series[];
    const teams = (
      JSON.parse(readFileSync(path.join(process.cwd(), "data/worlds-2026/teams.json"), "utf8")) as {
        id: string;
        stages: string[];
      }[]
    )
      .filter((t) => t.stages.includes("main"))
      .map((t) => t.id);
    const b = swissBracket(real, teams);
    const ids = (c: number, label: string) =>
      groupsOf(b, c)
        .find((g) => `${g.wins}-${g.losses}` === label)!
        .slots.map((x) => x?.id);
    expect(ids(3, "2-1")).toEqual(["main-event-round-4-1", "main-event-round-4-2", "main-event-round-4-4"]);
    expect(ids(3, "1-2")).toEqual(["main-event-round-4-3", "main-event-round-4-5", "main-event-round-4-6"]);
    expect(ids(2, "2-0")).toEqual(["main-event-round-3-3", "main-event-round-3-4"]);
    const r3 = groupsOf(b, 2).map((g) => [`${g.wins}-${g.losses}`, g.bestOf, g.days.length]);
    expect(r3).toEqual([
      ["2-0", 3, 1],
      ["1-1", 1, 2],
      ["0-2", 3, 1],
    ]);
    // A series at midnight UTC stays on the broadcast day it closes.
    expect(groupsOf(b, 0)[0].days).toEqual(["2026-10-23T17:00:00Z"]);
    // A group's lone late series (29 Oct, 23:00 UTC) counts on that evening's broadcast, not on its own day.
    expect(groupsOf(b, 3)[0].days).toEqual(["2026-10-28T20:00:00Z", "2026-10-29T20:00:00Z"]);
    const threeOh = outcomesOf(b).find((o) => o.wins === 3 && o.losses === 0)!;
    expect([...threeOh.teamIds].sort()).toEqual(["dplus-kia", "gen-g"]);
  });
});

describe("broadcastDays", () => {
  it("starts a new day after a long gap only", () => {
    const days = broadcastDays([
      "2026-10-26T17:00:00Z",
      "2026-10-25T17:00:00Z",
      "2026-10-25T23:00:00Z",
      "2026-10-26T00:00:00Z",
    ]);
    expect(Object.fromEntries(days)).toEqual({
      "2026-10-25T17:00:00Z": "2026-10-25T17:00:00Z",
      "2026-10-25T23:00:00Z": "2026-10-25T17:00:00Z",
      "2026-10-26T00:00:00Z": "2026-10-25T17:00:00Z",
      "2026-10-26T17:00:00Z": "2026-10-26T17:00:00Z",
    });
    expect(broadcastDays([]).size).toBe(0);
  });
});

const ko = (stage: StageId, n: number, o: Partial<Series> = {}) =>
  s({
    id: `${stage}-${n}`,
    stage,
    round: null,
    tab: stage,
    bestOf: 5,
    dateTimeUtc: `2026-11-${String((stage === "quarterfinals" ? 2 : stage === "semifinals" ? 6 : 13) + n).padStart(2, "0")}T22:00:00Z`,
    ...o,
  });

describe("knockoutBracket", () => {
  const empty = [1, 2, 3, 4].map((n) => ko("quarterfinals", n));
  const semis = [1, 2].map((n) => ko("semifinals", n));
  const final = [ko("final", 1)];

  it("returns null without knockout series", () => {
    expect(knockoutBracket(simulateSwiss(5))).toBeNull();
  });

  it("uses the standard order while the semifinal teams are unknown", () => {
    const b = knockoutBracket([...final, ...semis, ...empty])!;
    expect(b.columns.map((c) => c.slots.map((x) => x?.id))).toEqual([
      ["quarterfinals-1", "quarterfinals-2", "quarterfinals-3", "quarterfinals-4"],
      ["semifinals-1", "semifinals-2"],
      ["final-1"],
    ]);
    expect(b.currentStage).toBe("quarterfinals");
    expect(b.championId).toBeNull();
  });

  it("follows each semifinal team back to the quarterfinal it won", () => {
    const won = (n: number, a: string, b: string) =>
      ko("quarterfinals", n, { team1Id: a, team2Id: b, winnerId: a, status: "finished" });
    const qfs = [won(1, "a", "b"), won(2, "c", "d"), won(3, "e", "f"), won(4, "g", "h")];
    const sfs = [
      ko("semifinals", 1, { team1Id: "a", team2Id: "e" }),
      ko("semifinals", 2, { team1Id: "c", team2Id: "g" }),
    ];
    const b = knockoutBracket([...qfs, ...sfs, ...final])!;
    expect(b.columns[0].slots.map((x) => x?.id)).toEqual([
      "quarterfinals-1",
      "quarterfinals-3",
      "quarterfinals-2",
      "quarterfinals-4",
    ]);
    expect(b.currentStage).toBe("semifinals");
  });

  it("names the champion once the final is over", () => {
    const done = { status: "finished" as const };
    const b = knockoutBracket([
      ...empty.map((x) => ({ ...x, ...done })),
      ...semis.map((x) => ({ ...x, ...done })),
      ko("final", 1, { team1Id: "a", team2Id: "c", winnerId: "c", ...done }),
    ])!;
    expect(b.championId).toBe("c");
    expect(b.currentStage).toBeNull();
  });
});

describe("homeBracket", () => {
  const knockout = [ko("quarterfinals", 1)];
  it("keeps the Swiss bracket while a Swiss series is left", () => {
    expect(homeBracket([...simulateSwiss(4), ...knockout])).toBe("swiss");
  });
  it("switches to the knockout bracket when the Swiss stage is over", () => {
    expect(homeBracket([...simulateSwiss(5), ...knockout])).toBe("knockout");
    expect(homeBracket(simulateSwiss(5))).toBe("swiss");
  });
});
