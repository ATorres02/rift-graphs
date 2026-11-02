"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, HeatmapChart, LineChart, RadarChart, ScatterChart } from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnit, type ChartSpec, type RadarSpec, type Unit } from "@/lib/charts/spec";

echarts.use([
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  RadarChart,
  ScatterChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type EChartsInstance = ReturnType<typeof echarts.init>;

interface Palette {
  text: string;
  muted: string;
  grid: string;
  card: string;
  brand: string;
  series: string[];
}

let probe: CanvasRenderingContext2D | null | undefined;
const rgbCache = new Map<string, string>();

/**
 * Any CSS colour → `rgb()`/`rgba()`. The theme is written in oklch(), which canvas paints but
 * ECharts cannot parse: its hover colour (a lightened copy) came out empty and the bar vanished.
 */
function toRgb(value: string): string {
  const cached = rgbCache.get(value);
  if (cached) return cached;
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return value;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  const rgb = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
  rgbCache.set(value, rgb);
  return rgb;
}

/** Resolves `var(--x)` colours to concrete `rgb()` values that ECharts can paint and lighten. */
function resolveColor(value: string | undefined, css: CSSStyleDeclaration): string | undefined {
  if (!value) return undefined;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(value.trim());
  const resolved = m ? css.getPropertyValue(m[1]).trim() : value;
  return resolved ? toRgb(resolved) : undefined;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => toRgb(css.getPropertyValue(name).trim() || fallback);
  return {
    text: v("--foreground", "#e5e5e5"),
    muted: v("--muted-foreground", "#999"),
    grid: v("--viz-grid", "#333"),
    card: v("--card", "#111"),
    brand: v("--brand", "#4cc"),
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--viz-${i}`, "#888")),
  };
}

const axisValueFormatter = (unit: Unit | undefined) => (value: number) => formatUnit(value, unit);

/** Escapes text interpolated into a tooltip: ECharts renders custom tooltips with innerHTML. */
const esc = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Splits a label into lines of about `max` characters, at spaces. */
function wrapWords(text: string, max: number): string {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + word.length + 1 <= max) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines.join("\n");
}

/** Below this width (px) the chart uses its phone layout: smaller radar, wrapped names, earlier rotation. */
const NARROW_WIDTH = 480;

/** Legend icon for a dashed reference shape, as drawn in the radars. */
const DASH_ICON = "path://M0,0h5v2H0zM8,0h5v2H8zM16,0h5v2h-5z";

/** Grid of small radars: two columns on phones, three or four wider; every cell has the same height. */
export function radarGridLayout(count: number, width: number) {
  const w = width || 360;
  const narrow = w < NARROW_WIDTH;
  const cols = Math.max(1, Math.min(count, narrow ? 2 : w < 820 ? 3 : 4));
  const rows = Math.ceil(count / cols);
  const cellW = w / cols;
  const cellH = narrow ? 184 : 232;
  const top = 30;
  const nameH = 22;
  return {
    narrow,
    cols,
    cellW,
    cellH,
    top,
    nameH,
    // Phones keep the axis names of neighbouring radars apart.
    radius: Math.round(Math.min(cellW * (narrow ? 0.22 : 0.28), (cellH - nameH) * 0.32)),
    height: top + rows * cellH + 8,
  };
}

/** Small multiples: one radar per series on the same scale, the reference dashed in each, the name above. */
function radarGridOption(
  spec: RadarSpec,
  p: Palette,
  base: EChartsOption,
  color: (value: string | undefined, fallback: string) => string,
  width: number,
): EChartsOption {
  const L = radarGridLayout(spec.series.length, width);
  const ref = spec.reference;
  const cell = (i: number) => ({ x: ((i % L.cols) + 0.5) * L.cellW, y: L.top + Math.floor(i / L.cols) * L.cellH });
  const indicator = spec.indicators.map(({ name, short, max }) => ({ name: short ?? name, max }));
  const baseGraphic = Array.isArray(base.graphic) ? base.graphic : base.graphic ? [base.graphic] : [];
  return {
    ...base,
    legend: ref
      ? {
          data: [ref.name],
          top: 0,
          left: "center",
          icon: DASH_ICON,
          itemWidth: 21,
          itemHeight: 2,
          textStyle: { color: p.muted },
        }
      : undefined,
    tooltip: {
      ...base.tooltip,
      trigger: "item",
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const values = item.value as number[];
        const lines = spec.indicators.map((ind, i) => `${esc(ind.name)}: ${formatUnit(values[i] ?? null, ind.unit)}`);
        return `<b>${esc(item.name)}</b><br/>${lines.join("<br/>")}`;
      },
    },
    graphic: [
      ...baseGraphic,
      ...spec.series.map((s, i) => ({
        type: "text" as const,
        x: cell(i).x,
        y: cell(i).y + 4,
        silent: true,
        style: {
          text: s.name,
          fill: p.text,
          fontSize: L.narrow ? 12 : 13,
          fontWeight: 600,
          align: "center" as const,
          verticalAlign: "top" as const,
        },
      })),
    ],
    radar: spec.series.map((_, i) => ({
      indicator,
      center: [cell(i).x, cell(i).y + L.nameH + (L.cellH - L.nameH) / 2],
      radius: L.radius,
      splitNumber: 4,
      axisName: { color: p.muted, fontSize: L.narrow ? 9 : 10 },
      axisNameGap: 4,
      splitLine: { lineStyle: { color: p.grid } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: p.grid } },
    })),
    series: spec.series.map((s, i) => {
      const c = color(s.color, p.series[0]);
      return {
        type: "radar" as const,
        radarIndex: i,
        symbolSize: 4,
        data: [
          ...(ref
            ? [
                {
                  name: ref.name,
                  value: ref.values.map((v) => v ?? 0),
                  symbol: "none",
                  itemStyle: { color: p.muted },
                  lineStyle: { type: "dashed" as const, width: 1.5, color: p.muted },
                },
              ]
            : []),
          {
            name: s.name,
            value: s.values.map((v) => v ?? 0),
            itemStyle: { color: c },
            lineStyle: { width: 2, color: c },
            areaStyle: { opacity: 0.18, color: c },
          },
        ],
      };
    }),
  };
}

export function buildOption(
  spec: ChartSpec,
  p: Palette,
  css: CSSStyleDeclaration,
  watermark?: string,
  narrow = false,
  width = 0,
): EChartsOption {
  const color = (value: string | undefined, fallback: string) => resolveColor(value, css) ?? fallback;
  const base: EChartsOption = {
    animationDuration: 200,
    textStyle: { color: p.text, fontFamily: "inherit" },
    color: p.series,
    tooltip: { backgroundColor: p.card, borderColor: p.grid, textStyle: { color: p.text }, confine: true },
    graphic: watermark
      ? [
          {
            type: "text",
            right: 8,
            bottom: 4,
            silent: true,
            style: { text: watermark, fill: p.muted, fontSize: 10, opacity: 0.8 },
          },
        ]
      : undefined,
  };

  if (spec.type === "bar" || spec.type === "line") {
    const unit = spec.unit;
    const categoryAxis = {
      type: "category" as const,
      data: spec.categories,
      axisLabel: { color: p.muted, hideOverlap: true },
      axisLine: { lineStyle: { color: p.grid } },
      axisTick: { show: false },
    };
    const valueAxis = {
      type: "value" as const,
      axisLabel: { color: p.muted, formatter: axisValueFormatter(unit) },
      splitLine: { lineStyle: { color: p.grid } },
      max: unit === "percent" ? 1 : undefined,
      // Counts (games, kills, gold) never get fractional ticks.
      minInterval: unit === undefined || unit === "number" || unit === "gold" ? 1 : undefined,
    };
    const horizontal = spec.type === "bar" && spec.horizontal;
    const markLine = spec.reference
      ? {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed" as const, color: p.muted },
          label: {
            formatter: spec.reference.label,
            color: p.muted,
            position: horizontal ? ("start" as const) : ("insideEndTop" as const),
          },
          data: [horizontal ? { xAxis: spec.reference.value } : { yAxis: spec.reference.value }],
        }
      : undefined;
    return {
      ...base,
      grid: {
        left: horizontal ? 110 : 56,
        right: 16,
        top: spec.series.length > 1 ? 36 : horizontal && markLine ? 28 : 16,
        bottom: horizontal ? 36 : 64,
        containLabel: false,
      },
      legend:
        spec.series.length > 1
          ? {
              type: "scroll",
              top: 0,
              textStyle: { color: p.muted },
              icon: "roundRect",
              pageTextStyle: { color: p.muted },
            }
          : undefined,
      tooltip: {
        ...base.tooltip,
        trigger: "axis",
        valueFormatter: (v) => formatUnit(typeof v === "number" ? v : null, unit),
      },
      xAxis: horizontal
        ? valueAxis
        : {
            ...categoryAxis,
            axisLabel: { ...categoryAxis.axisLabel, rotate: spec.categories.length > (narrow ? 5 : 8) ? 35 : 0 },
          },
      yAxis: horizontal ? { ...categoryAxis, inverse: true } : valueAxis,
      series: spec.series.map((s, i) => {
        const fallback = p.series[i % p.series.length];
        const seriesColor = color(s.color, fallback);
        return {
          type: spec.type,
          name: s.name,
          data: s.colors
            ? s.values.map((v, j) => ({
                value: v,
                itemStyle: { color: color(s.colors![j] ?? undefined, seriesColor) },
              }))
            : s.values,
          stack: spec.type === "bar" && spec.stacked ? "total" : undefined,
          itemStyle: { color: seriesColor, borderRadius: spec.type === "bar" ? 3 : undefined },
          // Hover keeps the bar and lifts it: lighter fill (ECharts default) plus a thin outline.
          emphasis: spec.type === "bar" ? { itemStyle: { borderColor: p.text, borderWidth: 1 } } : undefined,
          lineStyle: spec.type === "line" ? { width: 2, color: seriesColor } : undefined,
          symbolSize: 7,
          markLine: i === 0 ? markLine : undefined,
          barMaxWidth: 28,
        };
      }),
    };
  }

  if (spec.type === "scatter") {
    return {
      ...base,
      grid: { left: 60, right: 24, top: 28, bottom: 52 },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const v = item.value as number[];
          return `<b>${item.name}</b><br/>${spec.xLabel}: ${formatUnit(v[0], spec.xUnit)}<br/>${spec.yLabel}: ${formatUnit(v[1], spec.yUnit)}`;
        },
      },
      xAxis: {
        type: "value",
        name: spec.xLabel,
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted, formatter: axisValueFormatter(spec.xUnit) },
        splitLine: { lineStyle: { color: p.grid } },
        scale: true,
      },
      yAxis: {
        type: "value",
        name: spec.yLabel,
        nameTextStyle: { color: p.muted, align: "left" },
        axisLabel: { color: p.muted, formatter: axisValueFormatter(spec.yUnit) },
        splitLine: { lineStyle: { color: p.grid } },
        scale: true,
      },
      series: [
        {
          type: "scatter",
          data: spec.points.map((pt) => ({
            value: [pt.x, pt.y],
            name: pt.label,
            itemStyle: { color: color(pt.color, p.series[0]) },
          })),
          symbolSize: 14,
          label: {
            show: true,
            position: "top",
            color: p.text,
            fontSize: narrow ? 9 : 11,
            formatter: (params) => params.name,
          },
          markLine:
            spec.xReference !== undefined || spec.yReference !== undefined
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", color: p.muted },
                  label: { show: false },
                  data: [
                    ...(spec.xReference !== undefined ? [{ xAxis: spec.xReference }] : []),
                    ...(spec.yReference !== undefined ? [{ yAxis: spec.yReference }] : []),
                  ],
                }
              : undefined,
        },
      ],
    };
  }

  if (spec.type === "radar" && spec.grid) return radarGridOption(spec, p, base, color, width);

  if (spec.type === "radar") {
    const ref = spec.reference;
    const many = spec.series.length > 4;
    return {
      ...base,
      legend: {
        type: "plain",
        bottom: 0,
        textStyle: { color: p.muted },
        itemGap: 12,
        itemWidth: 16,
        itemHeight: 10,
        data: [
          ...spec.series.map((s) => ({ name: s.name, icon: s.symbol === "triangle" ? "triangle" : "roundRect" })),
          ...(ref ? [{ name: ref.name, icon: DASH_ICON, itemStyle: { color: p.muted } }] : []),
        ],
      },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const values = item.value as number[];
          const lines = spec.indicators.map((ind, i) => `${esc(ind.name)}: ${formatUnit(values[i] ?? null, ind.unit)}`);
          return `<b>${esc(item.name)}</b><br/>${lines.join("<br/>")}`;
        },
      },
      radar: {
        indicator: spec.indicators.map(({ name, max }) => ({ name, max })),
        // Long names wrap instead of running off the canvas on phones; many entries leave room for the legend.
        center: ["50%", many ? (narrow ? "43%" : "44%") : "50%"],
        axisName: {
          color: p.muted,
          fontSize: narrow ? 10 : 12,
          formatter: narrow ? (name?: string) => wrapWords(name ?? "", 12) : undefined,
        },
        splitLine: { lineStyle: { color: p.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: p.grid } },
        radius: narrow ? (many ? "56%" : "52%") : many ? "58%" : "62%",
      },
      series: [
        {
          type: "radar",
          // Hovering a shape (or its legend entry) fades the others.
          emphasis: { focus: "self", lineStyle: { width: 3 } },
          blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 }, areaStyle: { opacity: 0.02 } },
          data: [
            ...(ref
              ? [
                  {
                    name: ref.name,
                    value: ref.values.map((v) => v ?? 0),
                    symbol: "none",
                    itemStyle: { color: p.muted },
                    lineStyle: { type: "dashed" as const, width: 1.5, color: p.muted },
                  },
                ]
              : []),
            ...spec.series.map((s, i) => {
              const c = color(s.color, p.series[i % p.series.length]);
              return {
                name: s.name,
                value: s.values.map((v) => v ?? 0),
                symbol: s.symbol ?? "circle",
                symbolSize: s.symbol === "triangle" ? 8 : 5,
                itemStyle: { color: c },
                lineStyle: { width: 2, color: c },
                // Fills add up: with many shapes they stay faint so the outlines carry the reading.
                areaStyle: { opacity: many ? 0.05 : 0.15, color: c },
              };
            }),
          ],
        },
      ],
    };
  }

  if (spec.type === "heatmap") {
    const flat = spec.values.flat().filter((v): v is number => v !== null);
    const min = flat.length ? Math.min(...flat) : 0;
    const max = flat.length ? Math.max(...flat) : 1;
    const data: [number, number, number][] = [];
    spec.values.forEach((row, y) => row.forEach((v, x) => v !== null && data.push([x, y, v])));
    return {
      ...base,
      grid: { left: 110, right: 16, top: 16, bottom: 60 },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const v = item.value as [number, number, number];
          return `<b>${spec.yLabels[v[1]]}</b>, ${spec.xLabels[v[0]]}<br/>${formatUnit(v[2], spec.unit)}`;
        },
      },
      xAxis: {
        type: "category",
        data: spec.xLabels,
        axisLabel: { color: p.muted, hideOverlap: true, rotate: narrow && spec.xLabels.length > 4 ? 35 : 0 },
        axisLine: { lineStyle: { color: p.grid } },
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: spec.yLabels,
        inverse: true,
        axisLabel: { color: p.muted },
        axisLine: { lineStyle: { color: p.grid } },
        splitArea: { show: true },
      },
      visualMap: {
        min,
        max: max === min ? min + 1 : max,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: { color: p.muted },
        inRange: { color: [p.card, p.brand] },
        formatter: (v) => formatUnit(typeof v === "number" ? v : null, spec.unit),
      },
      series: [
        {
          type: "heatmap",
          data,
          label: {
            show: true,
            color: p.text,
            formatter: (params) => formatUnit((params.value as [number, number, number])[2], spec.unit),
          },
          itemStyle: { borderColor: p.card, borderWidth: 2 },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.4)" } },
        },
      ],
    };
  }

  // boxplot
  return {
    ...base,
    grid: { left: 56, right: 16, top: 16, bottom: 64 },
    tooltip: {
      ...base.tooltip,
      trigger: "item",
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const v = item.value as number[];
        const f = (n: number) => formatUnit(n, spec.unit);
        return `<b>${item.name}</b><br/>Min ${f(v[1])}, Q1 ${f(v[2])}, Median ${f(v[3])}, Q3 ${f(v[4])}, Max ${f(v[5])}`;
      },
    },
    xAxis: {
      type: "category",
      data: spec.categories,
      axisLabel: { color: p.muted, rotate: spec.categories.length > (narrow ? 5 : 8) ? 35 : 0, hideOverlap: true },
      axisLine: { lineStyle: { color: p.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: p.muted, formatter: axisValueFormatter(spec.unit) },
      splitLine: { lineStyle: { color: p.grid } },
      scale: true,
    },
    series: [
      {
        type: "boxplot",
        data: spec.stats,
        itemStyle: { color: color("var(--brand-soft)", "rgba(80,200,170,0.2)"), borderColor: p.brand },
        markLine: spec.reference
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed", color: p.muted },
              label: { formatter: spec.reference.label, color: p.muted, position: "insideEndTop" },
              data: [{ yAxis: spec.reference.value }],
            }
          : undefined,
      },
    ],
  };
}

export interface EChartProps {
  spec: ChartSpec;
  themeKey: string;
  /** Small attribution drawn inside the canvas (included in PNG exports). */
  watermark?: string;
  onReady?: (instance: EChartsInstance) => void;
}

export function EChart({ spec, themeKey, watermark, onReady }: EChartProps) {
  const ref = useRef<ReactEChartsCore>(null);
  // themeKey changes with light/dark mode so the palette is re-read from CSS variables.
  const env = useMemo(() => {
    void themeKey;
    return { palette: readPalette(), css: getComputedStyle(document.documentElement) };
  }, [themeKey]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Rounded so sub-pixel changes do not rebuild the chart.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width / 8) * 8));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const narrow = width > 0 && width < NARROW_WIDTH;
  const grid = spec.type === "radar" && spec.grid ? radarGridLayout(spec.series.length, width) : null;
  const option = useMemo(
    () => buildOption(spec, env.palette, env.css, watermark, narrow, grid ? width : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `grid` is derived from spec and width
    [spec, env, watermark, narrow, grid ? width : 0],
  );
  return (
    // A grid of small radars sets its own height; every other chart fills its box.
    <div ref={wrapRef} className={grid ? "w-full" : "h-full w-full"} style={grid ? { height: grid.height } : undefined}>
      <ReactEChartsCore
        ref={ref}
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        onChartReady={(instance: EChartsInstance) => onReady?.(instance)}
      />
    </div>
  );
}
