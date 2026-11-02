/**
 * Turns a query result into a chart spec, its table alternative, a textual
 * description and an automatic title. Pure and unit-tested.
 */
import {
  formatUnit,
  boxStats,
  type BarSpec,
  type BoxplotSpec,
  type ChartSpec,
  type ChartTable,
  type HeatmapSpec,
  type LineSpec,
  type RadarSpec,
  type ScatterSpec,
} from "./spec";
import {
  AGGREGATION_LABEL,
  CHART_LABEL,
  RADAR_MAX_ENTITIES,
  RADAR_OVERLAY_MAX,
  type QueryConfig,
  type QueryResult,
  type QueryRow,
} from "@/lib/query";
import { STAGE_LABEL } from "@/lib/format";

export interface BuiltChart {
  spec: ChartSpec;
  table: ChartTable;
  description: string;
  title: string;
}

export function autoTitle(result: QueryResult): string {
  const { config, measures, dimension, seriesDimension } = result;
  const measureText = measures.map((m) => m.label).join(config.chart === "scatter" ? " vs. " : ", ");
  const agg =
    config.aggregation !== "mean" && measures.some((m) => m.kind === "sum")
      ? ` (${AGGREGATION_LABEL[config.aggregation].toLowerCase()})`
      : "";
  const stages = config.filters.stages?.length
    ? `, ${config.filters.stages.map((s) => STAGE_LABEL[s]).join(", ")}`
    : "";
  // A pick is a comparison: name who is in it (a few) or how many, instead of "Top N".
  const picked = config.pick?.length && dimension ? Array.from(new Set(result.rows.map((r) => r.label))) : null;
  if (picked?.length) {
    const who =
      picked.length <= 3
        ? picked.length === 1
          ? picked[0]
          : `${picked.slice(0, -1).join(", ")} and ${picked[picked.length - 1]}`
        : `${picked.length} ${dimension!.label.toLowerCase()}s compared`;
    const series = seriesDimension ? ` by ${seriesDimension.label.toLowerCase()}` : "";
    return `${who}: ${measureText}${agg}${series}${stages}`;
  }
  const top = config.topN && dimension?.entity ? `Top ${config.topN} ` : "";
  const by = dimension ? ` by ${dimension.label.toLowerCase()}` : "";
  const series = seriesDimension ? ` and ${seriesDimension.label.toLowerCase()}` : "";
  return `${top}${measureText}${agg}${by}${series}${stages}`;
}

function describe(result: QueryResult, spec: ChartSpec): string {
  const { config, measures, dimension, rows } = result;
  const first = measures[0];
  const kind = CHART_LABEL[config.chart];
  if (!first || !dimension || !rows.length) return `${kind}: no data.`;
  const values = rows
    .map((r) => ({ label: r.label, v: r.values[first.key] }))
    .filter((x): x is { label: string; v: number } => x.v !== null);
  if (!values.length) return `${kind}: no values for ${first.label}.`;
  const max = values.reduce((m, x) => (x.v > m.v ? x : m), values[0]);
  const min = values.reduce((m, x) => (x.v < m.v ? x : m), values[0]);
  const n = new Set(rows.map((r) => r.key)).size;
  const unitF = (v: number) => formatUnit(v, first.unit);
  if (spec.type === "scatter") {
    const second = measures[1];
    return `${kind}: ${n} ${dimension.label.toLowerCase()}s plotted by ${first.label} (X) and ${second?.label ?? ""} (Y). Highest ${first.label}: ${max.label} (${unitF(max.v)}).`;
  }
  const text = `${kind}: ${n} ${dimension.label.toLowerCase()}${n === 1 ? "" : "s"} by ${first.label}; highest ${max.label} (${unitF(max.v)}), lowest ${min.label} (${unitF(min.v)}).`;
  if (spec.type === "radar") {
    const dashed = spec.reference ? `The dashed shape is the ${spec.reference.name.toLowerCase()}.` : "";
    return [text, spec.grid ? "One small radar each, all on the same scale." : "", dashed].filter(Boolean).join(" ");
  }
  return text;
}

function pivot(
  result: QueryResult,
  measureKey: string,
): { categories: string[]; series: { name: string; values: (number | null)[]; key: string }[] } {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const r of result.rows) {
    if (!seen.has(r.key)) {
      seen.add(r.key);
      categories.push(r.label);
    }
  }
  const keys = Array.from(seen);
  const seriesKeys = Array.from(new Set(result.rows.map((r) => r.seriesKey!)));
  const series = seriesKeys.map((sk) => {
    const byKey = new Map(result.rows.filter((r) => r.seriesKey === sk).map((r) => [r.key, r]));
    return {
      key: sk,
      name: byKey.values().next().value?.seriesLabel ?? sk,
      values: keys.map((k) => byKey.get(k)?.values[measureKey] ?? null),
    };
  });
  return { categories, series };
}

/** Colours of the chart palette (--viz-1 to --viz-6). */
const RADAR_COLOURS = 6;

/** Axis names for small radars, where the full labels do not fit. */
const SHORT_LABEL: Record<string, string> = {
  kp: "KP",
  killsPerMinute: "Kills/min",
  totalKills: "Kills (all)",
  gpm: "GPM",
  goldShare: "Gold %",
  cspm: "CS/min",
  totalGold: "Gold (all)",
  damage: "Damage",
  dpm: "DPM",
  damageShare: "Dmg %",
  vision: "Vision",
  vspm: "Vis/min",
  inhibitors: "Inhibs",
  elders: "Elders",
  heralds: "Heralds",
  voidGrubs: "Grubs",
  dragonControl: "Drag ctrl",
  baronControl: "Baron ctrl",
  totalDragons: "Drags (all)",
  totalBarons: "Barons (all)",
  totalTowers: "Towers (all)",
  duration: "Length",
  pickRate: "Pick %",
  banRate: "Ban %",
  winRate: "Win %",
  blueWinRate: "Blue win %",
};

/** The average covers the filtered rows: with any filter on it is the selection's, not the tournament's. */
function averageLabel(config: QueryConfig): string {
  return Object.keys(config.filters).some((k) => k !== "minGames") ? "Average" : "Tournament average";
}

export function buildChart(result: QueryResult): BuiltChart {
  const { config, measures, dimension, seriesDimension, rows } = result;
  const title = config.title?.trim() || autoTitle(result);
  const first = measures[0];
  const dimLabel = dimension?.label ?? "Group";
  const empty: BuiltChart = {
    spec: { type: "bar", categories: [], series: [] },
    table: { columns: [dimLabel], rows: [] },
    description: "No data.",
    title,
  };
  if (!first || !dimension || !rows.length) return empty;
  const unit = first.unit;
  const reference =
    config.showAverage && result.overall[first.key] !== null && result.overall[first.key] !== undefined
      ? { value: result.overall[first.key]!, label: averageLabel(config) }
      : undefined;
  const manyCategories = new Set(rows.map((r) => r.key)).size > 6;
  const horizontal = !!dimension.entity && manyCategories;

  const tableBase = (): ChartTable => ({
    columns: [dimLabel, ...(seriesDimension ? [seriesDimension.label] : []), ...measures.map((m) => m.label), "Games"],
    rows: rows.map((r) => [
      r.label,
      ...(seriesDimension ? [r.seriesLabel] : []),
      ...measures.map((m) => r.values[m.key] ?? null),
      r.games,
    ]),
  });

  let spec: ChartSpec;
  switch (config.chart) {
    case "groupedBar":
    case "stackedBar": {
      if (seriesDimension) {
        const p = pivot(result, first.key);
        spec = {
          type: "bar",
          categories: p.categories,
          series: p.series.map((s) => ({
            name: s.name,
            values: s.values,
            color: sideColor(seriesDimension.key, s.key),
          })),
          unit,
          horizontal,
          stacked: config.chart === "stackedBar",
        } satisfies BarSpec;
      } else {
        spec = {
          type: "bar",
          categories: rows.map((r) => r.label),
          series: measures.map((m) => ({ name: m.label, values: rows.map((r) => r.values[m.key] ?? null) })),
          unit,
          horizontal,
          stacked: config.chart === "stackedBar",
        } satisfies BarSpec;
      }
      break;
    }
    case "line": {
      if (seriesDimension) {
        const p = pivot(result, first.key);
        spec = {
          type: "line",
          categories: p.categories,
          series: p.series.map((s) => ({
            name: s.name,
            values: s.values,
            color: sideColor(seriesDimension.key, s.key),
          })),
          unit,
          reference,
        } satisfies LineSpec;
      } else {
        spec = {
          type: "line",
          categories: rows.map((r) => r.label),
          series: measures.map((m) => ({ name: m.label, values: rows.map((r) => r.values[m.key] ?? null) })),
          unit,
          reference: measures.length === 1 ? reference : undefined,
        } satisfies LineSpec;
      }
      break;
    }
    case "scatter": {
      const second = measures[1] ?? first;
      spec = {
        type: "scatter",
        xLabel: first.label,
        yLabel: second.label,
        xUnit: first.unit,
        yUnit: second.unit,
        xReference: config.showAverage ? (result.overall[first.key] ?? undefined) : undefined,
        yReference: config.showAverage ? (result.overall[second.key] ?? undefined) : undefined,
        points: rows
          .filter((r) => r.values[first.key] !== null && r.values[second.key] !== null)
          .map((r) => ({
            label: r.label,
            x: r.values[first.key]!,
            y: r.values[second.key]!,
            color: r.color ?? undefined,
          })),
      } satisfies ScatterSpec;
      break;
    }
    case "radar": {
      const entities = rows.slice(0, RADAR_MAX_ENTITIES);
      // Each axis is scaled to the best value in the selection, including groups left out by Top N or the pick.
      const maxes = measures.map((m) =>
        Math.max(
          result.maxima[m.key] ?? 0,
          ...rows.map((r) => r.values[m.key] ?? 0),
          result.overall[m.key] ?? 0,
          0.0001,
        ),
      );
      const average = config.showAverage
        ? { name: averageLabel(config), values: measures.map((m) => result.overall[m.key] ?? 0) }
        : null;
      // Colour follows the entry: the order it was picked in, or its rank. Past the palette's six colours the
      // marker changes too, so no two shapes look the same.
      const slot = (key: string, i: number) => (config.pick?.length ? Math.max(0, config.pick.indexOf(key)) : i);
      const shapes = entities.map((r, i) => {
        const n = slot(r.key, i);
        return {
          name: r.label,
          values: measures.map((m) => r.values[m.key] ?? 0),
          color: r.color ?? `var(--viz-${(n % RADAR_COLOURS) + 1})`,
          ...(n >= RADAR_COLOURS ? { symbol: "triangle" as const } : {}),
        };
      });
      const indicators = measures.map((m, i) => ({
        name: m.label,
        max: maxes[i],
        unit: m.unit,
        ...(SHORT_LABEL[m.key] ? { short: SHORT_LABEL[m.key] } : {}),
      }));
      // Unless the reader chose, more than four shapes split into one small radar each.
      const grid =
        config.radarLayout === "separate" || (config.radarLayout !== "together" && entities.length > RADAR_OVERLAY_MAX);
      spec = {
        type: "radar",
        indicators,
        series: shapes,
        ...(grid ? { grid: true } : {}),
        ...(average ? { reference: average } : {}),
      } satisfies RadarSpec;
      break;
    }
    case "heatmap": {
      const p = pivot(result, first.key);
      spec = {
        type: "heatmap",
        xLabels: p.series.map((s) => s.name),
        yLabels: p.categories,
        values: p.categories.map((_, yi) => p.series.map((s) => s.values[yi] ?? null)),
        unit,
      } satisfies HeatmapSpec;
      break;
    }
    case "boxplot": {
      const withStats = rows
        .map((r) => ({ r, stats: boxStats(r.distribution[first.key] ?? []) }))
        .filter((x): x is { r: QueryRow; stats: [number, number, number, number, number] } => x.stats !== null);
      spec = {
        type: "boxplot",
        categories: withStats.map((x) => x.r.label),
        stats: withStats.map((x) => x.stats),
        unit,
        reference,
      } satisfies BoxplotSpec;
      break;
    }
    default: {
      spec = {
        type: "bar",
        categories: rows.map((r) => r.label),
        series: [
          { name: first.label, values: rows.map((r) => r.values[first.key] ?? null), colors: rows.map((r) => r.color) },
        ],
        unit,
        horizontal,
        reference,
      } satisfies BarSpec;
    }
  }

  let table = tableBase();
  if (spec.type === "boxplot") {
    table = {
      columns: [dimLabel, "Min", "Q1", "Median", "Q3", "Max", "Games"],
      rows: spec.categories.map((c, i) => [c, ...spec.stats[i], rows.find((r) => r.label === c)?.games ?? null]),
    };
  }
  return { spec, table, description: describe(result, spec), title };
}

function sideColor(dimensionKey: string, key: string): string | undefined {
  if (dimensionKey !== "side" && dimensionKey !== "winnerSide") return undefined;
  return key === "blue" ? "var(--side-blue)" : "var(--side-red)";
}

/** Rows of the filtered table as CSV text. */
export function tableToCsv(table: ChartTable): string {
  const esc = (v: string | number | null) => {
    if (v === null) return "";
    // Four decimals keep fractions (percentages) exact to 0.01% without float noise.
    const s = typeof v === "number" && !Number.isInteger(v) ? String(Number(v.toFixed(4))) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [table.columns.map(esc).join(","), ...table.rows.map((r) => r.map(esc).join(","))].join("\n");
}
