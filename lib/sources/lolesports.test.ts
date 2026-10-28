import { describe, expect, it } from "vitest";
import { LolesportsClient, fetchSchedule, parseScheduleEvents, stageFromBlock } from "./lolesports";

const event = (over: Record<string, unknown>, teams: Array<Record<string, unknown>>) => ({
  startTime: "2026-10-28T20:00:00Z",
  state: "unstarted",
  type: "match",
  blockName: "Swiss",
  league: { name: "Worlds", slug: "worlds" },
  match: { id: "1", flags: [], teams, strategy: { type: "bestOf", count: 3 } },
  ...over,
});
const team = (code: string, name: string, gameWins = 0, outcome: string | null = null) => ({
  name,
  code,
  image: "",
  result: { outcome, gameWins },
  record: { wins: 0, losses: 0 },
});

const payload = (events: unknown[], older: string | null = null) => ({
  data: { schedule: { pages: { older, newer: null }, events } },
});

describe("stageFromBlock", () => {
  it("maps lolesports block names to stages", () => {
    expect(stageFromBlock("Play-Ins")).toBe("playin");
    expect(stageFromBlock("Play In Knockouts")).toBe("playin");
    expect(stageFromBlock("Swiss")).toBe("swiss");
    expect(stageFromBlock("Quarterfinals")).toBe("quarterfinals");
    expect(stageFromBlock("Semifinals")).toBe("semifinals");
    expect(stageFromBlock("Finals")).toBe("final");
    expect(stageFromBlock("Week 3")).toBeNull();
  });
});

describe("parseScheduleEvents", () => {
  it("keeps match events with two teams and a known state", () => {
    const { matches, olderToken } = parseScheduleEvents(
      payload(
        [
          event(
            {
              state: "completed",
              startTime: "2026-10-26T22:00:00Z",
              match: {
                id: "a",
                teams: [team("AL", "Anyone's Legend", 0, "loss"), team("TLAW", "Team Liquid Alienware", 2, "win")],
                strategy: { count: 3 },
              },
            },
            [],
          ),
          event(
            { match: { id: "b", teams: [team("MKOI", "Movistar KOI"), team("T1", "T1")], strategy: { count: 3 } } },
            [],
          ),
          event({ type: "show", match: { id: "c", teams: [team("X", "X"), team("Y", "Y")] } }, []),
          event({ state: "weird", match: { id: "d", teams: [team("X", "X"), team("Y", "Y")] } }, []),
          {
            startTime: "2026-10-28T20:00:00Z",
            state: "unstarted",
            type: "match",
            blockName: "Swiss",
            match: { id: "e", teams: [team("X", "X")] },
          },
        ],
        "older-token",
      ),
    );
    expect(olderToken).toBe("older-token");
    expect(matches.map((m) => m.id)).toEqual(["a", "b"]);
    expect(matches[0]).toMatchObject({
      state: "completed",
      stage: "swiss",
      bestOf: 3,
      teams: [
        { code: "AL", gameWins: 0, outcome: "loss" },
        { code: "TLAW", gameWins: 2, outcome: "win" },
      ],
    });
    expect(matches[1].teams[0].outcome).toBeNull();
  });

  it("tolerates garbage", () => {
    expect(parseScheduleEvents(null)).toEqual({ matches: [], olderToken: null });
    expect(parseScheduleEvents({ data: { schedule: { events: "nope" } } })).toEqual({ matches: [], olderToken: null });
  });
});

describe("fetchSchedule", () => {
  const first = payload(
    [
      event(
        {
          startTime: "2026-10-30T20:00:00Z",
          match: { id: "new", teams: [team("A", "A"), team("B", "B")], strategy: { count: 1 } },
        },
        [],
      ),
      event(
        {
          startTime: "2026-10-16T20:00:00Z",
          match: { id: "mid", teams: [team("A", "A"), team("B", "B")], strategy: { count: 1 } },
        },
        [],
      ),
    ],
    "p2",
  );
  const second = payload(
    [
      event(
        {
          startTime: "2026-10-15T18:00:00Z",
          match: { id: "old", teams: [team("A", "A"), team("B", "B")], strategy: { count: 1 } },
        },
        [],
      ),
      event(
        {
          startTime: "2025-10-20T18:00:00Z",
          match: { id: "last-year", teams: [team("A", "A"), team("B", "B")], strategy: { count: 1 } },
        },
        [],
      ),
    ],
    "p3",
  );
  const third = payload(
    [
      event(
        {
          startTime: "2024-10-20T18:00:00Z",
          match: { id: "ancient", teams: [team("A", "A"), team("B", "B")], strategy: { count: 1 } },
        },
        [],
      ),
    ],
    null,
  );

  it("follows older pages only while they reach back past `since` and filters by range", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url.searchParams.get("pageToken") ?? "first");
      const body =
        url.searchParams.get("pageToken") === "p2"
          ? second
          : url.searchParams.get("pageToken") === "p3"
            ? third
            : first;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
    const client = new LolesportsClient({ apiKey: "k", fetchImpl, sleep: async () => {} });
    const matches = await fetchSchedule(client, "L", { since: "2026-10-14T00:00:00Z", until: "2026-11-16T00:00:00Z" });
    expect(calls).toEqual(["first", "p2"]);
    expect(matches.map((m) => m.id)).toEqual(["old", "mid", "new"]);
    expect(client.requestCount).toBe(2);
  });

  it("retries once on 5xx and then gives up", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n += 1;
      return new Response("boom", { status: 503 });
    };
    const client = new LolesportsClient({ apiKey: "k", fetchImpl, sleep: async () => {} });
    await expect(client.get("getLeagues")).rejects.toThrow(/HTTP 503/);
    expect(n).toBe(2);
  });

  it("does not retry a 403 (bad key)", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n += 1;
      return new Response("nope", { status: 403 });
    };
    const client = new LolesportsClient({ apiKey: "k", fetchImpl, sleep: async () => {} });
    await expect(client.get("getLeagues")).rejects.toThrow(/HTTP 403/);
    expect(n).toBe(1);
  });
});
