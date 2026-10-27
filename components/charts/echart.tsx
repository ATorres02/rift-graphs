"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, RadarChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { formatUnit, type ChartSpec, type Unit } from "@/lib/charts/spec";

echarts.use([BarChart, LineChart, RadarChart, ScatterChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

interface Palette {
  text: string;
  muted: string;
  grid: string;
  card: string;
  series: string[];
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    text: v("--foreground", "#e5e5e5"),
    muted: v("--muted-foreground", "#999"),
    grid: v("--viz-grid", "#333"),
    card: v("--card", "#111"),
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--viz-${i}`, "#888")),
  };
}

function axisValueFormatter(unit: Unit | undefined) {
  return (value: number) => formatUnit(value, unit);
}

export function buildOption(spec: ChartSpec, p: Palette): EChartsOption {
  const base: EChartsOption = {
    animationDuration: 200,
    textStyle: { color: p.text, fontFamily: "inherit" },
    color: p.series,
    tooltip: {
      backgroundColor: p.card,
      borderColor: p.grid,
      textStyle: { color: p.text },
      confine: true,
    },
  };

  if (spec.type === "bar" || spec.type === "line") {
    const unit = spec.unit;
    const categoryAxis = { type: "category" as const, data: spec.categories, axisLabel: { color: p.muted, hideOverlap: true }, axisLine: { lineStyle: { color: p.grid } }, axisTick: { show: false } };
    const valueAxis = {
      type: "value" as const,
      axisLabel: { color: p.muted, formatter: axisValueFormatter(unit) },
      splitLine: { lineStyle: { color: p.grid } },
      max: unit === "percent" ? 1 : undefined,
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
      grid: { left: horizontal ? 110 : 48, right: 16, top: spec.series.length > 1 ? 36 : 16, bottom: horizontal ? 28 : 56, containLabel: false },
      legend: spec.series.length > 1 ? { top: 0, textStyle: { color: p.muted }, icon: "roundRect" } : undefined,
      tooltip: {
        ...base.tooltip,
        trigger: "axis",
        valueFormatter: (v) => formatUnit(typeof v === "number" ? v : null, unit),
      },
      xAxis: horizontal ? valueAxis : { ...categoryAxis, axisLabel: { ...categoryAxis.axisLabel, rotate: spec.categories.length > 8 ? 35 : 0 } },
      yAxis: horizontal ? { ...categoryAxis, inverse: true } : valueAxis,
      series: spec.series.map((s, i) => ({
        type: spec.type,
        name: s.name,
        data: s.values,
        stack: spec.type === "bar" && spec.stacked ? "total" : undefined,
        itemStyle: { color: s.color ?? p.series[i % p.series.length], borderRadius: spec.type === "bar" ? 3 : undefined },
        lineStyle: spec.type === "line" ? { width: 2, color: s.color ?? p.series[i % p.series.length] } : undefined,
        symbolSize: 7,
        smooth: false,
        markLine: i === 0 ? markLine : undefined,
        barMaxWidth: 28,
      })),
    };
  }

  if (spec.type === "scatter") {
    return {
      ...base,
      grid: { left: 56, right: 24, top: 24, bottom: 48 },
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
          data: spec.points.map((pt) => ({ value: [pt.x, pt.y], name: pt.label, itemStyle: { color: pt.color ?? p.series[0] } })),
          symbolSize: 14,
          label: {
            show: true,
            position: "top",
            color: p.text,
            fontSize: 11,
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

  // radar
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
      radius: "65%",
    },
    series: [
      {
        type: "radar",
        data: spec.series.map((s, i) => ({
          name: s.name,
          value: s.values.map((v) => v ?? 0),
          itemStyle: { color: s.color ?? p.series[i % p.series.length] },
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.15 },
        })),
      },
    ],
  };
}

export function EChart({ spec, themeKey }: { spec: ChartSpec; themeKey: string }) {
  // themeKey changes with light/dark mode so the palette is re-read from CSS variables.
  const palette = useMemo(() => {
    void themeKey;
    return readPalette();
  }, [themeKey]);
  const option = useMemo(() => buildOption(spec, palette), [spec, palette]);
  return <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} />;
}
