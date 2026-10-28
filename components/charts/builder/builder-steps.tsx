"use client";

import { CheckIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AGGREGATION_LABEL,
  CHART_LABEL,
  MEASURE_GROUP_LABEL,
  allowedAggregations,
  chartProblems,
  dimensionsFor,
  measureByKey,
  measuresFor,
  type Aggregation,
  type ChartType,
  type ColorBy,
  type DataSource,
  type MeasureGroup,
  type QueryConfig,
  type SortMode,
} from "@/lib/query";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50";
export const inputClass =
  "h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";

export function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2 rounded-xl border bg-card p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand">
        {n}. {title}
      </legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

const SOURCES: { key: DataSource; label: string; hint: string }[] = [
  { key: "players", label: "Players", hint: "One row per player and game" },
  { key: "teams", label: "Teams", hint: "One row per team and game" },
  { key: "champions", label: "Champions", hint: "Picks and bans per game" },
  { key: "games", label: "Games", hint: "One row per game" },
];

export function SourceStep({ value, onChange }: { value: DataSource; onChange: (s: DataSource) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Data">
      {SOURCES.map((s) => (
        <button
          key={s.key}
          type="button"
          role="radio"
          aria-checked={value === s.key}
          onClick={() => onChange(s.key)}
          className={cn(
            "rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:border-brand",
            value === s.key && "border-brand bg-brand-soft",
          )}
          title={s.hint}
        >
          <span className="font-medium">{s.label}</span>
          <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
        </button>
      ))}
    </div>
  );
}

const GROUP_ORDER: MeasureGroup[] = [
  "combat",
  "economy",
  "damage",
  "vision",
  "objectives",
  "duration",
  "draft",
  "results",
];

export function MeasureStep({
  config,
  onToggle,
  onSwap,
}: {
  config: QueryConfig;
  onToggle: (key: string) => void;
  onSwap: () => void;
}) {
  const measures = measuresFor(config.source);
  const max =
    config.chart === "scatter"
      ? 2
      : config.chart === "radar"
        ? 8
        : config.chart === "bar" || config.chart === "boxplot" || config.chart === "heatmap"
          ? 1
          : 6;
  const selected = config.measures;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {selected.length} selected,{" "}
        {config.chart === "scatter"
          ? "first = X axis, second = Y axis"
          : config.chart === "radar"
            ? "3 to 8 for a radar"
            : `up to ${max}`}
        {config.chart === "scatter" && selected.length === 2 ? (
          <button type="button" onClick={onSwap} className="ml-2 underline hover:text-foreground">
            swap axes
          </button>
        ) : null}
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {GROUP_ORDER.map((g) => {
          const list = measures.filter((m) => m.group === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {MEASURE_GROUP_LABEL[g]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((m) => {
                  const on = selected.includes(m.key);
                  const idx = selected.indexOf(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggle(m.key)}
                      title={m.description}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:border-brand",
                        on && "border-brand bg-brand-soft font-medium",
                      )}
                    >
                      {on ? <CheckIcon className="size-3" aria-hidden /> : null}
                      {m.label}
                      {on && selected.length > 1 ? (
                        <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GroupStep({
  config,
  onChange,
}: {
  config: QueryConfig;
  onChange: (patch: Partial<QueryConfig>) => void;
}) {
  const dims = dimensionsFor(config.source);
  const selectedMeasures = config.measures.map((k) => measureByKey.get(k)).filter((m) => !!m);
  const aggs: Aggregation[] = ["mean", "median", "sum", "max", "min", "perGame", "perMinute"];
  const allowed = new Set<Aggregation>(
    aggs.filter((a) => selectedMeasures.every((m) => allowedAggregations(m).includes(a))),
  );
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-xs text-muted-foreground">
        Group by (X axis)
        <select className={selectClass} value={config.groupBy} onChange={(e) => onChange({ groupBy: e.target.value })}>
          {dims.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Series (optional)
        <select
          className={selectClass}
          value={config.series ?? ""}
          onChange={(e) => onChange({ series: e.target.value || null })}
        >
          <option value="">None</option>
          {dims
            .filter((d) => d.key !== config.groupBy)
            .map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Aggregation
        <select
          className={selectClass}
          value={config.aggregation}
          onChange={(e) => onChange({ aggregation: e.target.value as Aggregation })}
        >
          {aggs.map((a) => (
            <option key={a} value={a} disabled={!allowed.has(a)}>
              {AGGREGATION_LABEL[a]}
              {!allowed.has(a) ? " (not for ratios)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const CHARTS: ChartType[] = ["bar", "groupedBar", "stackedBar", "line", "scatter", "radar", "heatmap", "boxplot"];

export function ChartTypeStep({ config, onChange }: { config: QueryConfig; onChange: (chart: ChartType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Chart type">
      {CHARTS.map((t) => {
        const problems = chartProblems(config, t);
        const disabled = problems.length > 0 && t !== config.chart;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={config.chart === t}
            aria-disabled={disabled}
            onClick={() => onChange(t)}
            title={problems.join(" ") || CHART_LABEL[t]}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs transition-colors hover:border-brand",
              config.chart === t && "border-brand bg-brand-soft font-medium",
              disabled && "opacity-45 hover:border-border",
            )}
          >
            {CHART_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

export function OptionsStep({
  config,
  onChange,
  orderedDimension,
}: {
  config: QueryConfig;
  onChange: (patch: Partial<QueryConfig>) => void;
  orderedDimension: boolean;
}) {
  const playerLike = config.source === "players" || config.source === "champions";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-muted-foreground">
        Sort
        <select
          className={selectClass}
          value={config.sort}
          disabled={orderedDimension}
          onChange={(e) => onChange({ sort: e.target.value as SortMode })}
          title={orderedDimension ? "Ordered dimensions keep their natural order" : undefined}
        >
          <option value="desc">Highest first</option>
          <option value="asc">Lowest first</option>
          <option value="label">By name</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Top N
        <select
          className={selectClass}
          value={config.topN === null ? "all" : String(config.topN)}
          onChange={(e) => onChange({ topN: e.target.value === "all" ? null : Number(e.target.value) })}
        >
          {config.chart === "radar" ? null : <option value="all">All</option>}
          {[4, 5, 10, 20].map((n) => (
            <option key={n} value={n} disabled={config.chart === "radar" && n > 4}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Colour by
        <select
          className={selectClass}
          value={config.colorBy}
          onChange={(e) => onChange({ colorBy: e.target.value as ColorBy })}
          disabled={config.source === "games"}
        >
          <option value="none">Default</option>
          <option value="region">Region</option>
          <option value="team">Team (region colour)</option>
          {playerLike ? <option value="role">Role</option> : null}
        </select>
      </label>
      <label className="flex items-center gap-2 pt-4 text-xs text-muted-foreground">
        <Switch
          checked={config.showAverage}
          onCheckedChange={(checked) => onChange({ showAverage: Boolean(checked) })}
          aria-label="Show tournament average"
        />
        Tournament average line
      </label>
      <label className="text-xs text-muted-foreground sm:col-span-2">
        Title (optional)
        <input
          className={inputClass}
          value={config.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value || null })}
          placeholder="Automatic title"
          maxLength={120}
        />
      </label>
    </div>
  );
}
