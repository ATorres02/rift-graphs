/**
 * Serialisable chart specifications. Server components (and the chart builder)
 * produce a spec; the client `Chart`/`EChart` components turn it into ECharts options.
 */
export type Unit = "number" | "percent" | "decimal1" | "decimal2" | "minutes" | "seconds" | "gold";

export interface ChartSeries {
  name: string;
  values: (number | null)[];
  /** CSS colour (any value accepted by canvas). Defaults to the palette. */
  color?: string;
  /** Per-point colours (bars/scatter), overriding `color`. */
  colors?: (string | null)[];
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

export interface HeatmapSpec {
  type: "heatmap";
  /** Column labels (X). */
  xLabels: string[];
  /** Row labels (Y). */
  yLabels: string[];
  /** values[y][x] */
  values: (number | null)[][];
  unit?: Unit;
}

export interface BoxplotSpec {
  type: "boxplot";
  categories: string[];
  /** [min, q1, median, q3, max] per category. */
  stats: [number, number, number, number, number][];
  unit?: Unit;
  reference?: { value: number; label: string };
}

export type ChartSpec = BarSpec | LineSpec | ScatterSpec | RadarSpec | HeatmapSpec | BoxplotSpec;

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

/** Short unit label for axes. */
export function unitLabel(unit: Unit | undefined): string {
  switch (unit) {
    case "percent":
      return "%";
    case "seconds":
      return "min:sec";
    case "minutes":
      return "min";
    case "gold":
      return "gold";
    default:
      return "";
  }
}

/** Builds the table alternative of a bar/line spec. */
export function tableFromSeries(spec: BarSpec | LineSpec, firstColumn = "Category"): ChartTable {
  return {
    columns: [firstColumn, ...spec.series.map((s) => s.name)],
    rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.values[i] ?? null)]),
  };
}

/** Five-number summary for box plots. */
export function boxStats(values: number[]): [number, number, number, number, number] | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const pos = (s.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  return [s[0], q(0.25), q(0.5), q(0.75), s[s.length - 1]];
}
