"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChartColumnIcon, DownloadIcon, FileSpreadsheetIcon, LinkIcon, TableIcon } from "lucide-react";
import { SpecTable } from "@/components/charts/chart-table";
import { useThemeKey } from "@/components/charts/chart";
import type { EChartsInstance } from "@/components/charts/echart";
import { Button } from "@/components/ui/button";
import { FiltersStep, type FilterCatalog } from "./builder-filters";
import { ChartTypeStep, GroupStep, MeasureStep, OptionsStep, SourceStep, Step } from "./builder-steps";
import { buildChart, tableToCsv } from "@/lib/charts/build";
import { composeChartPng, downloadDataUrl } from "@/lib/charts/export-png";
import { TEMPLATES } from "@/lib/charts/templates";
import { parseConfig, serializeConfig } from "@/lib/charts/url";
import { useDataset } from "@/lib/data/use-dataset";
import {
  DEFAULT_CONFIG,
  chartProblems,
  dimensionByKey,
  dimensionsFor,
  measuresFor,
  runQuery,
  type ChartType,
  type DataSource,
  type QueryConfig,
} from "@/lib/query";
import { slugify } from "@/lib/data/ids";

const EChart = dynamic(() => import("@/components/charts/echart").then((m) => m.EChart), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/50" aria-hidden />,
});

const SOURCE_DEFAULTS: Record<DataSource, Partial<QueryConfig>> = {
  players: { measures: ["dpm"], groupBy: "player", chart: "bar", topN: 10 },
  teams: { measures: ["winRate"], groupBy: "team", chart: "bar", topN: null },
  champions: { measures: ["presence"], groupBy: "champion", chart: "bar", topN: 20 },
  games: { measures: ["duration"], groupBy: "day", chart: "line", topN: null },
};

export function ChartBuilder({ version, catalog }: { version: string; catalog: FilterCatalog }) {
  const [config, setConfig] = useState<QueryConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [copied, setCopied] = useState(false);
  const chartRef = useRef<EChartsInstance | null>(null);
  const themeKey = useThemeKey();
  const { data, error } = useDataset(version);

  // Config lives in the URL so any chart can be shared with a link.
  useEffect(() => {
    const read = () => setConfig(parseConfig(new URLSearchParams(window.location.search)));
    read();
    setReady(true);
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const qs = `?${serializeConfig(config)}`;
    if (window.location.search !== qs) window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
  }, [config, ready]);

  const queryKey = serializeConfig({ ...config, title: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => (data ? runQuery(config, data) : null), [queryKey, data]);
  const built = useMemo(
    () => (result ? buildChart({ ...result, config: { ...result.config, title: config.title } }) : null),
    [result, config.title],
  );

  const update = useCallback((patch: Partial<QueryConfig>) => setConfig((c) => ({ ...c, ...patch })), []);

  const switchSource = (source: DataSource) => {
    const keep = {
      stages: config.filters.stages,
      teams: config.filters.teams,
      regions: config.filters.regions,
      minGames: config.filters.minGames,
    };
    const playerLike = source === "players" || source === "champions";
    const filters = {
      ...keep,
      ...(playerLike ? { roles: config.filters.roles, champions: config.filters.champions } : {}),
    };
    for (const k of Object.keys(filters) as (keyof typeof filters)[]) if (filters[k] === undefined) delete filters[k];
    update({ source, series: null, ...SOURCE_DEFAULTS[source], filters });
  };

  const toggleMeasure = (key: string) => {
    const list = [...config.measures];
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else if (config.chart === "scatter" && list.length >= 2) list.splice(1, 1, key);
    else if ((config.chart === "bar" || config.chart === "boxplot" || config.chart === "heatmap") && list.length >= 1)
      list.splice(0, 1, key);
    else list.push(key);
    update({ measures: list.length ? list : [key] });
  };

  const switchChart = (chart: ChartType) => {
    const patch: Partial<QueryConfig> = { chart };
    if (chart === "radar" && (config.topN === null || config.topN > 4)) patch.topN = 4;
    if (chart === "line" && !dimensionByKey.get(config.groupBy)?.ordered)
      patch.groupBy = dimensionsFor(config.source).find((d) => d.ordered)?.key ?? config.groupBy;
    if (chart === "heatmap" && !config.series)
      patch.series =
        dimensionsFor(config.source).find((d) => d.key !== config.groupBy && (d.key === "side" || d.key === "stage"))
          ?.key ?? null;
    if ((chart === "bar" || chart === "boxplot" || chart === "heatmap") && config.measures.length > 1)
      patch.measures = [config.measures[0]];
    if ((chart === "bar" || chart === "boxplot" || chart === "scatter" || chart === "radar") && config.series)
      patch.series = null;
    if (chart === "scatter" && config.measures.length < 2) {
      const extra = measuresFor(config.source).find((m) => !config.measures.includes(m.key) && m.kind !== "count");
      if (extra) patch.measures = [...config.measures, extra.key].slice(0, 2);
    }
    update(patch);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

  const fileName = () => slugify(built?.title ?? "chart") || "chart";

  /** PNG with the title, the description and a source footer around the chart, at 2x. */
  const exportPng = async () => {
    const instance = chartRef.current;
    if (!instance || !built) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#ffffff";
    const url = await composeChartPng({
      title: built.title,
      summary: `${built.description} ${result?.universeGames ?? 0} games in the selection.`,
      chartDataUrl: instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg }),
    });
    downloadDataUrl(url, `${fileName()}.png`);
  };

  const exportCsv = () => {
    if (!built) return;
    const blob = new Blob([tableToCsv(built.table)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const orderedDimension = !!dimensionByKey.get(config.groupBy)?.ordered;
  const problems = result?.problems ?? chartProblems(config, config.chart);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* On phones the chart comes first so a shared link shows its chart without scrolling; the controls follow. */}
      <div className="order-2 space-y-3 lg:order-1">
        <Step n={1} title="Data">
          <SourceStep value={config.source} onChange={switchSource} />
        </Step>
        <Step n={2} title="Measures" hint="Ratios (KDA, per-minute, shares) are computed over totals.">
          <MeasureStep
            config={config}
            onToggle={toggleMeasure}
            onSwap={() => update({ measures: [config.measures[1], config.measures[0]] })}
          />
        </Step>
        <Step n={3} title="Group and filter">
          <GroupStep config={config} onChange={update} />
          <details className="mt-2" open={Object.keys(config.filters).length > 1}>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Filters {Object.keys(config.filters).length ? `(${Object.keys(config.filters).length} active)` : ""}
            </summary>
            <div className="mt-2">
              <FiltersStep config={config} catalog={catalog} onChange={(filters) => update({ filters })} />
            </div>
          </details>
        </Step>
        <Step n={4} title="Chart type">
          <ChartTypeStep config={config} onChange={switchChart} />
        </Step>
        <Step n={5} title="Options">
          <OptionsStep config={config} onChange={update} orderedDimension={orderedDimension} />
        </Step>
      </div>

      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <div className="order-2 lg:order-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Templates</p>
          <div className="scroll-x flex gap-2 pb-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setConfig(t.config)}
                className="shrink-0 rounded-md border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-brand"
                title={t.description}
              >
                <span className="block font-medium">{t.name}</span>
                <span className="block text-[11px] text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        <figure className="order-1 rounded-xl border bg-card p-3 sm:p-4 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <figcaption className="text-base font-semibold">{built?.title ?? "Chart"}</figcaption>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView(view === "chart" ? "table" : "chart")}
                aria-pressed={view === "table"}
              >
                {view === "chart" ? (
                  <TableIcon className="size-4" aria-hidden />
                ) : (
                  <ChartColumnIcon className="size-4" aria-hidden />
                )}
                {view === "chart" ? "Table" : "Chart"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <CheckIcon className="size-4" aria-hidden /> : <LinkIcon className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportPng}
                disabled={view !== "chart" || !built || !result?.rows.length}
              >
                <DownloadIcon className="size-4" aria-hidden />
                PNG
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!built || !result?.rows.length}>
                <FileSpreadsheetIcon className="size-4" aria-hidden />
                CSV
              </Button>
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-loss">Could not load the dataset: {error}</p>
          ) : null}
          {!data && !error ? (
            <div className="h-[420px] animate-pulse rounded-lg bg-muted/50" aria-label="Loading data" />
          ) : null}

          {data && problems.length ? (
            <ul className="mb-3 space-y-1 rounded-md border border-dashed p-3 text-sm">
              {problems.map((p) => (
                <li key={p} className="text-muted-foreground">
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {data && result && !problems.length && result.emptyReason ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{result.emptyReason}</p>
          ) : null}

          {data && built && result && result.rows.length ? (
            view === "chart" ? (
              <div style={{ height: 460 }} role="img" aria-label={built.description}>
                <EChart spec={built.spec} themeKey={themeKey} onReady={(instance) => (chartRef.current = instance)} />
              </div>
            ) : (
              <SpecTable spec={built.spec} table={built.table} />
            )
          ) : null}
          {built && result?.rows.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {built.description} {result.universeGames} games in the selection.
            </p>
          ) : null}
        </figure>

        <p className="order-3 text-xs text-muted-foreground">
          Every chart has a table view and a text description. The URL updates as you edit: share it and the chart opens
          exactly like this. Looking for a quick head-to-head? Try the{" "}
          <Link href="/compare" className="underline hover:text-foreground">
            comparison page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
