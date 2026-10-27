import { describe, expect, it } from "vitest";
import { CargoError, LeaguepediaClient, RateLimitError, asList, asSlots, asString, detectRateLimit, parseCargoBody } from "./leaguepedia";

const RATE_LIMITED = JSON.stringify({ error: { code: "ratelimited", info: "You've exceeded your rate limit. Please wait some time and try again." } });

describe("detectRateLimit", () => {
  it("detects the limit reported inside a 200 body", () => {
    expect(detectRateLimit(200, RATE_LIMITED)).toBe(true);
  });
  it("detects HTTP throttling statuses", () => {
    expect(detectRateLimit(429, "")).toBe(true);
    expect(detectRateLimit(503, "")).toBe(true);
    expect(detectRateLimit(403, "<title>Just a moment...</title>")).toBe(true);
  });
  it("does not flag ordinary responses or query errors", () => {
    expect(detectRateLimit(200, "[]")).toBe(false);
    expect(detectRateLimit(200, 'Error: No field named "N_TabInPage" found for any of the specified database tables.')).toBe(false);
  });
});

describe("parseCargoBody", () => {
  it("parses export arrays", () => {
    expect(parseCargoBody("export", '[{"Name":"Worlds 2026"}]')).toEqual([{ Name: "Worlds 2026" }]);
  });
  it("throws CargoError on export error text", () => {
    expect(() => parseCargoBody("export", "Error: No field named X")).toThrow(CargoError);
  });
  it("unwraps api rows and surfaces api errors", () => {
    expect(parseCargoBody("api", '{"cargoquery":[{"title":{"Name":"A"}},{"title":{"Name":"B"}}]}')).toEqual([{ Name: "A" }, { Name: "B" }]);
    expect(() => parseCargoBody("api", '{"error":{"code":"badvalue","info":"x"}}')).toThrow(CargoError);
  });
});

describe("LeaguepediaClient", () => {
  const immediate = async () => {};

  it("follows limit/offset pagination until a short page", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const offset = Number(new URL(url).searchParams.get("offset"));
      const page = offset === 0 ? [{ Name: "a" }, { Name: "b" }] : [{ Name: "c" }];
      return new Response(JSON.stringify(page), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new LeaguepediaClient({ fetchImpl, sleep: immediate, pageSize: 2 });
    const rows = await client.query({ tables: "Tournaments", fields: "Name" });
    expect(rows.map((r) => r.Name)).toEqual(["a", "b", "c"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("Special:CargoExport");
    expect(calls[0]).toContain("limit=2");
    expect(calls[1]).toContain("offset=2");
  });

  it("waits with exponential backoff when the body reports a usage limit", async () => {
    let n = 0;
    const waits: number[] = [];
    const fetchImpl = (async () => {
      n += 1;
      return new Response(n < 3 ? RATE_LIMITED : "[]", { status: 200 });
    }) as unknown as typeof fetch;
    const client = new LeaguepediaClient({
      fetchImpl,
      sleep: async (ms) => {
        waits.push(ms);
      },
      backoffBaseMs: 1000,
      delayMs: 0,
    });
    await client.query({ tables: "Teams", fields: "Name" });
    expect(n).toBe(3);
    expect(waits).toEqual([1000, 2000]);
  });

  it("gives up after the maximum number of attempts", async () => {
    const fetchImpl = (async () => new Response(RATE_LIMITED, { status: 200 })) as unknown as typeof fetch;
    const client = new LeaguepediaClient({ fetchImpl, sleep: immediate, maxAttempts: 3, delayMs: 0 });
    await expect(client.query({ tables: "Teams", fields: "Name" })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("pauses between consecutive requests", async () => {
    const waits: number[] = [];
    const fetchImpl = (async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      return new Response(JSON.stringify(offset === 0 ? [{ a: 1 }] : []), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new LeaguepediaClient({
      fetchImpl,
      sleep: async (ms) => {
        waits.push(ms);
      },
      pageSize: 1,
      delayMs: 1500,
    });
    await client.query({ tables: "Teams", fields: "Name" });
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(0);
    expect(waits[0]).toBeLessThanOrEqual(1500);
  });

  it("uses api.php when the api transport is selected", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return new Response('{"cargoquery":[]}', { status: 200 });
    }) as unknown as typeof fetch;
    const client = new LeaguepediaClient({ fetchImpl, sleep: immediate, transport: "api" });
    await client.query({ tables: "Teams", fields: "Name" });
    expect(calls[0]).toContain("/api.php?");
    expect(calls[0]).toContain("action=cargoquery");
  });
});

describe("coercion helpers", () => {
  it("normalises lists from arrays and comma strings", () => {
    expect(asList(["Ahri", "", "Jinx"])).toEqual(["Ahri", "Jinx"]);
    expect(asList("Ahri,Jinx, Azir")).toEqual(["Ahri", "Jinx", "Azir"]);
    expect(asList(null)).toEqual([]);
  });
  it("keeps slot positions", () => {
    expect(asSlots(["Ahri", "", "Jinx"], 5)).toEqual(["Ahri", null, "Jinx", null, null]);
    expect(asSlots("a,b,c,d,e,f", 5)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("stringifies numbers the export coerced", () => {
    expect(asString(369)).toBe("369");
    expect(asString("")).toBeNull();
    expect(asString(undefined)).toBeNull();
  });
});
