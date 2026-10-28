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
import { useMemo, useRef } from "react";
import { formatUnit, type ChartSpec, type Unit } from "@/lib/charts/spec";

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

/** Resolves `var(--x)` colours to concrete values so canvas can paint them. */
function resolveColor(value: string | undefined, css: CSSStyleDeclaration): string | undefined {
  if (!value) return undefined;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(value.trim());
  if (!m) return value;
  return css.getPropertyValue(m[1]).trim() || undefined;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
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

export function buildOption(spec: ChartSpec, p: Palette, css: CSSStyleDeclaration, watermark?: string): EChartsOption {
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
          label: { formatter: spec.reference.label, color: p.muted, position: "insideEndTop" as const },
          data: [horizontal ? { xAxis: spec.reference.value } : { yAxis: spec.reference.value }],
        }
      : undefined;
    return {
      ...base,
      grid: {
        left: horizontal ? 110 : 56,
        right: 16,
        top: spec.series.length > 1 ? 36 : 16,
        bottom: horizontal ? 36 : 64,
        containLabel: false,
      },
      legend: spec.series.length > 1 ? { top: 0, textStyle: { color: p.muted }, icon: "roundRect" } : undefined,
      tooltip: {
        ...base.tooltip,
        trigger: "axis",
        valueFormatter: (v) => formatUnit(typeof v === "number" ? v : null, unit),
      },
      xAxis: horizontal
        ? valueAxis
        : { ...categoryAxis, axisLabel: { ...categoryAxis.axisLabel, rotate: spec.categories.length > 8 ? 35 : 0 } },
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
          label: { show: true, position: "top", color: p.text, fontSize: 11, formatter: (params) => params.name },
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

  if (spec.type === "radar") {
    return {
      ...base,
      legend: { bottom: 0, textStyle: { color: p.muted }, icon: "roundRect" },
      tooltip: { ...base.tooltip, trigger: "item" },
      radar: {
        indicator: spec.indicators,
        axisName: { color: p.muted },
        splitLine: { lineStyle: { color: p.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: p.grid } },
        radius: "62%",
      },
      series: [
        {
          type: "radar",
          data: spec.series.map((s, i) => ({
            name: s.name,
            value: s.values.map((v) => v ?? 0),
            itemStyle: { color: color(s.color, p.series[i % p.series.length]) },
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.15 },
          })),
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
        axisLabel: { color: p.muted },
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
      axisLabel: { color: p.muted, rotate: spec.categories.length > 8 ? 35 : 0, hideOverlap: true },
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
  const option = useMemo(() => buildOption(spec, env.palette, env.css, watermark), [spec, env, watermark]);
  return (
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
  );
}
