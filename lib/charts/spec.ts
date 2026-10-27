/**
 * Serialisable chart specifications. Server components build a spec; the
 * client `Chart` component turns it into ECharts options. Phase 2's chart
 * builder will produce the same specs from `runQuery` rows.
 */
export type Unit = "number" | "percent" | "decimal1" | "decimal2" | "minutes" | "seconds" | "gold";

export interface ChartSeries {
  name: string;
  values: (number | null)[];
  /** CSS colour (any value accepted by canvas). Defaults to the palette. */
  color?: string;
}

export interface BarSpec {
  type: "bar";
  categories: string[];
  series: ChartSeries[];
  unit?: Unit;
  horizontal?: boolean;
  stacked?: boolean;
  /** Draw a dashed reference line (e.g. tournament average). */
  reference?: { value: number; label: string };
}

export interface LineSpec {
  type: "line";
  categories: string[];
  series: ChartSeries[];
  unit?: Unit;
  reference?: { value: number; label: string };
}

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  color?: string;
  group?: string;
}

export interface ScatterSpec {
  type: "scatter";
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xUnit?: Unit;
  yUnit?: Unit;
  /** Dashed reference lines (e.g. averages). */
  xReference?: number;
  yReference?: number;
}

export interface RadarSpec {
  type: "radar";
  indicators: { name: string; max: number }[];
  series: ChartSeries[];
}

export type ChartSpec = BarSpec | LineSpec | ScatterSpec | RadarSpec;

export interface ChartTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export function formatUnit(value: number | null, unit: Unit = "number"): string {
  if (value === null || Number.isNaN(value)) return "–";
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(0)}%`;
    case "decimal1":
      return value.toFixed(1);
    case "decimal2":
      return value.toFixed(2);
    case "minutes":
      return `${value.toFixed(1)} min`;
    case "seconds": {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    case "gold":
      return `${(value / 1000).toFixed(1)}k`;
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}

/** Builds the table alternative of a bar/line spec. */
export function tableFromSeries(spec: BarSpec | LineSpec, firstColumn = "Category"): ChartTable {
  return {
    columns: [firstColumn, ...spec.series.map((s) => s.name)],
    rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.values[i] ?? null)]),
  };
}
