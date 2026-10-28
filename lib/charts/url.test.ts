import { describe, expect, it } from "vitest";
import { parseConfig, parseFilters, serializeConfig, serializeFilters } from "./url";
import { DEFAULT_CONFIG, type QueryConfig } from "@/lib/query";
import { TEMPLATES } from "./templates";

describe("chart URL codec", () => {
  it("parses the SPEC example", () => {
    const c = parseConfig(new URLSearchParams("d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10"));
    expect(c).toMatchObject({
      source: "players",
      measures: ["dpm"],
      groupBy: "player",
      chart: "bar",
      topN: 10,
      filters: { stages: ["swiss"] },
    });
  });
  it("falls back to defaults for unknown values", () => {
    const c = parseConfig(new URLSearchParams("d=nope&t=pie&a=weird&n=-3"));
    expect(c.source).toBe(DEFAULT_CONFIG.source);
    expect(c.chart).toBe(DEFAULT_CONFIG.chart);
    expect(c.aggregation).toBe(DEFAULT_CONFIG.aggregation);
    expect(c.topN).toBe(DEFAULT_CONFIG.topN);
    expect(c.filters).toEqual(DEFAULT_CONFIG.filters);
  });
  it("round-trips every template", () => {
    for (const t of TEMPLATES) {
      const parsed = parseConfig(new URLSearchParams(serializeConfig(t.config)));
      expect(parsed).toEqual(t.config);
    }
  });
  it("round-trips filters", () => {
    const f = parseFilters(
      "stage:swiss|playin;team:t1|gen-g;region:Korea;role:mid|top;side:blue;res:win;champ:Ahri|Jarvan IV;min:3;dur:1500-2400",
    );
    expect(f).toEqual({
      stages: ["swiss", "playin"],
      teams: ["t1", "gen-g"],
      regions: ["Korea"],
      roles: ["mid", "top"],
      side: "blue",
      result: "win",
      champions: ["Ahri", "Jarvan IV"],
      minGames: 3,
      durationMin: 1500,
      durationMax: 2400,
    });
    expect(parseFilters(serializeFilters(f))).toEqual(f);
    expect(parseFilters("dur:-2400")).toEqual({ durationMax: 2400 });
    expect(parseFilters("role:tank")).toEqual({});
  });
  it("omits defaults and keeps an explicit empty filter set", () => {
    const c: QueryConfig = { ...DEFAULT_CONFIG, filters: {}, title: "My chart" };
    const qs = serializeConfig(c);
    expect(qs).toContain("f=");
    expect(qs).not.toContain("o=");
    expect(qs).toContain("ttl=My+chart");
    expect(parseConfig(new URLSearchParams(qs))).toEqual(c);
    expect(serializeConfig({ ...c, topN: null })).toContain("n=all");
  });
});
