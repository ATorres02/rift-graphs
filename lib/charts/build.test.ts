import { describe, expect, it } from "vitest";
import { autoTitle, buildChart, tableToCsv } from "./build";
import { boxStats } from "./spec";
import type { MeasureDef, QueryResult } from "@/lib/query";
import { DEFAULT_CONFIG, dimensionByKey, measureByKey } from "@/lib/query";

const m = (k: string) => measureByKey.get(k) as MeasureDef;

function result(partial: Partial<QueryResult>): QueryResult {
  return {
    config: { ...DEFAULT_CONFIG, filters: {}, topN: null },
    measures: [m("dpm")],
    dimension: dimensionByKey.get("player")!,
    seriesDimension: null,
    rows: [
      {
        key: "a",
        label: "A",
        seriesKey: null,
        seriesLabel: null,
        games: 5,
        values: { dpm: 700 },
        distribution: { dpm: [600, 700, 800] },
        color: "var(--region-lck)",
        entity: { type: "player", id: "a" },
      },
      {
        key: "b",
        label: "B",
        seriesKey: null,
        seriesLabel: null,
        games: 4,
        values: { dpm: 500 },
        distribution: { dpm: [400, 500, 600] },
        color: null,
        entity: { type: "player", id: "b" },
      },
    ],
    seriesLabels: [],
    overall: { dpm: 600 },
    maxima: {},
    universeGames: 10,
    emptyReason: null,
    problems: [],
    ...partial,
  };
}

describe("buildChart", () => {
  it("builds bars with per-point colours, a reference line and a table", () => {
    const built = buildChart(result({}));
    expect(built.spec.type).toBe("bar");
    if (built.spec.type !== "bar") return;
    expect(built.spec.categories).toEqual(["A", "B"]);
    expect(built.spec.series[0].values).toEqual([700, 500]);
    expect(built.spec.series[0].colors).toEqual(["var(--region-lck)", null]);
    expect(built.spec.reference).toEqual({ value: 600, label: "Tournament average" });
    expect(built.table.columns).toEqual(["Player", "Damage per minute", "Games"]);
    expect(built.table.rows[0]).toEqual(["A", 700, 5]);
    expect(built.description).toContain("highest A (700)");
  });
  it("builds scatter points from two measures", () => {
    const r = result({
      config: { ...DEFAULT_CONFIG, filters: {}, topN: null, chart: "scatter", measures: ["gpm", "dpm"] },
      measures: [m("gpm"), m("dpm")],
      overall: { gpm: 400, dpm: 600 },
    });
    r.rows.forEach((row, i) => (row.values.gpm = 400 + i * 50));
    const built = buildChart(r);
    expect(built.spec.type).toBe("scatter");
    if (built.spec.type !== "scatter") return;
    expect(built.spec.points).toHaveLength(2);
    expect(built.spec.points[0]).toMatchObject({ label: "A", x: 400, y: 700 });
    expect(built.spec.xReference).toBe(400);
  });
  it("builds radar indicators scaled to the maximum", () => {
    const r = result({
      config: { ...DEFAULT_CONFIG, filters: {}, topN: 4, chart: "radar", measures: ["dpm", "kda", "cspm"] },
      measures: [m("dpm"), m("kda"), m("cspm")],
      overall: { dpm: 600, kda: 4, cspm: 9 },
    });
    r.rows.forEach((row) => Object.assign(row.values, { kda: 5, cspm: 10 }));
    const built = buildChart(r);
    if (built.spec.type !== "radar") throw new Error("expected radar");
    expect(built.spec.indicators.map((i) => i.max)).toEqual([700, 5, 10]);
    expect(built.spec.indicators.map((i) => i.unit)).toEqual(["number", "decimal1", "decimal1"]);
    expect(built.spec.series.map((s) => s.name)).toEqual(["A", "B", "Tournament average"]);
  });
  it("pivots a series dimension into heat map cells", () => {
    const side = dimensionByKey.get("side")!;
    const r = result({
      config: {
        ...DEFAULT_CONFIG,
        filters: {},
        topN: null,
        chart: "heatmap",
        source: "teams",
        groupBy: "team",
        series: "side",
        measures: ["winRate"],
      },
      measures: [m("winRate")],
      dimension: dimensionByKey.get("team")!,
      seriesDimension: side,
      rows: [
        {
          key: "t1",
          label: "T1",
          seriesKey: "blue",
          seriesLabel: "Blue side",
          games: 2,
          values: { winRate: 1 },
          distribution: {},
          color: null,
          entity: { type: "team", id: "t1" },
        },
        {
          key: "t1",
          label: "T1",
          seriesKey: "red",
          seriesLabel: "Red side",
          games: 1,
          values: { winRate: 0 },
          distribution: {},
          color: null,
          entity: { type: "team", id: "t1" },
        },
        {
          key: "t2",
          label: "T2",
          seriesKey: "blue",
          seriesLabel: "Blue side",
          games: 1,
          values: { winRate: 0.5 },
          distribution: {},
          color: null,
          entity: { type: "team", id: "t2" },
        },
      ],
      seriesLabels: ["Blue side", "Red side"],
    });
    const built = buildChart(r);
    if (built.spec.type !== "heatmap") throw new Error("expected heatmap");
    expect(built.spec.xLabels).toEqual(["Blue side", "Red side"]);
    expect(built.spec.yLabels).toEqual(["T1", "T2"]);
    expect(built.spec.values).toEqual([
      [1, 0],
      [0.5, null],
    ]);
  });
  it("builds box plots from distributions", () => {
    const built = buildChart(result({ config: { ...DEFAULT_CONFIG, filters: {}, topN: null, chart: "boxplot" } }));
    if (built.spec.type !== "boxplot") throw new Error("expected boxplot");
    expect(built.spec.stats[0]).toEqual([600, 650, 700, 750, 800]);
    expect(built.table.columns).toContain("Median");
  });
  it("returns an empty bar spec without rows", () => {
    const built = buildChart(result({ rows: [] }));
    expect(built.spec).toEqual({ type: "bar", categories: [], series: [] });
    expect(built.description).toBe("No data.");
  });
});

describe("autoTitle and CSV", () => {
  it("writes a readable title", () => {
    const r = result({ config: { ...DEFAULT_CONFIG, filters: { stages: ["swiss"] }, topN: 10 } });
    expect(autoTitle(r)).toBe("Top 10 Damage per minute by player, Swiss Stage");
  });
  it("escapes CSV cells", () => {
    expect(
      tableToCsv({
        columns: ["Name", "Value"],
        rows: [
          ['A "quoted", one', 1.5],
          ["B", null],
        ],
      }),
    ).toBe('Name,Value\n"A ""quoted"", one",1.5\nB,');
  });
  it("rounds CSV numbers to four decimals", () => {
    expect(tableToCsv({ columns: ["Name", "Value"], rows: [["A", 2 / 3]] })).toBe("Name,Value\nA,0.6667");
  });
  it("computes five-number summaries", () => {
    expect(boxStats([5, 1, 3, 2, 4])).toEqual([1, 2, 3, 4, 5]);
    expect(boxStats([])).toBeNull();
  });
});
