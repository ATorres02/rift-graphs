import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { manualGameSchema, parseDuration, validateManualFile } from "./manual";

const base = {
  series: "main-event-round-4-1",
  game: 1,
  blue: "movistar-koi",
  red: "t1",
  winner: "t1",
  duration: "31:42",
  picks: {
    blue: ["Rumble", "Lee Sin", "Syndra", "Miss Fortune", "Nautilus"],
    red: ["Gnar", "Xin Zhao", "Azir", "Ezreal", "Karma"],
  },
};

describe("validateManualFile", () => {
  it("accepts a minimal file whose name matches its content", () => {
    const r = validateManualFile("main-event-round-4-1-g1.json", { ...base, _help: "ignored" });
    expect(r.ok).toBe(true);
  });

  it("rejects a file name that disagrees with the content", () => {
    const r = validateManualFile("main-event-round-4-1-g2.json", base);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("file name says") });
  });

  it("rejects unknown fields so typos do not vanish silently", () => {
    const r = validateManualFile("main-event-round-4-1-g1.json", { ...base, objetives: {} });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("objetives") });
  });

  it("rejects a winner that is neither side and a bad duration", () => {
    expect(validateManualFile("main-event-round-4-1-g1.json", { ...base, winner: "g2-esports" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("winner"),
    });
    expect(validateManualFile("main-event-round-4-1-g1.json", { ...base, duration: "31m" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("duration"),
    });
    expect(
      validateManualFile("main-event-round-4-1-g1.json", { ...base, picks: { blue: ["Rumble"], red: base.picks.red } }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("picks.blue") });
  });

  it("parses durations", () => {
    expect(parseDuration("31:42")).toBe(1902);
    expect(parseDuration(1902)).toBe(1902);
  });

  it("keeps the committed template valid", async () => {
    const raw = JSON.parse(await readFile("data/manual/_template.json", "utf8"));
    const unknown = Object.keys(raw).filter((k) => !k.startsWith("_") && !(k in manualGameSchema.shape));
    expect(unknown).toEqual([]);
    const r = validateManualFile(`${raw.series}-g${raw.game}.json`, raw);
    expect(r.ok).toBe(true);
  });
});
