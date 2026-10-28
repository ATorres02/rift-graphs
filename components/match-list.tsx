"use client";

import { useEffect, useMemo, useState } from "react";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import type { TeamRef } from "@/lib/data/load";
import type { StageId } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SeriesView } from "@/lib/views";

interface MatchListProps {
  views: SeriesView[];
  teams: TeamRef[];
  stages: StageId[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming and live" },
  { value: "finished", label: "Finished" },
] as const;

type FilterKey = "stage" | "team" | "status" | "day";

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const selectClass =
  "h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";
const chipClass =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

/**
 * Filterable schedule in the visitor's time zone (UTC until hydration): what is
 * still to play first, in order, then the results with the latest day on top.
 * Each drop-down only offers values that fit the other filters.
 */
export function MatchList({ views, teams, stages }: MatchListProps) {
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  useEffect(() => {
    // Filters live in the query string (?stage=swiss&team=t1) so a filtered view can be shared.
    const q = new URLSearchParams(window.location.search);
    const next: Partial<Record<FilterKey, string>> = {};
    for (const key of ["stage", "team", "status", "day"] as const) {
      const value = q.get(key);
      if (value) next[key] = value;
    }
    setFilters(next);
    setMounted(true);
  }, []);

  const stage = filters.stage ?? "all";
  const team = filters.team ?? "all";
  const status = filters.status ?? "all";
  const day = filters.day ?? "all";
  const active = Object.keys(filters).length > 0;

  const update = (changes: Partial<Record<FilterKey, string | null>>) => {
    const next = { ...filters };
    for (const [key, value] of Object.entries(changes) as [FilterKey, string | null][]) {
      if (value === null || value === "all") delete next[key];
      else next[key] = value;
    }
    setFilters(next);
    const qs = new URLSearchParams(next as Record<string, string>).toString();
    window.history.replaceState(null, "", `/matches${qs ? `?${qs}` : ""}`);
  };

  const dayKey = (iso: string) => (mounted ? localDayKey(iso) : iso.slice(0, 10));
  const todayKey = mounted ? localDayKey(new Date().toISOString()) : null;

  const sorted = useMemo(
    () => [...views].sort((a, b) => a.series.dateTimeUtc.localeCompare(b.series.dateTimeUtc)),
    [views],
  );

  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of sorted) {
      const k = dayKey(v.series.dateTimeUtc);
      if (!seen.has(k)) seen.set(k, v.series.dateTimeUtc);
    }
    return Array.from(seen, ([key, iso]) => ({ key, iso }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, mounted]);

  /** Does the series pass every filter except `except`? */
  const passes = (v: SeriesView, except: FilterKey | null) => {
    const s = v.series;
    if (except !== "stage" && stage !== "all" && s.stage !== stage) return false;
    if (except !== "team" && team !== "all" && s.team1Id !== team && s.team2Id !== team) return false;
    if (except !== "status" && status === "upcoming" && s.status === "finished") return false;
    if (except !== "status" && status === "finished" && s.status !== "finished") return false;
    if (except !== "day" && day !== "all" && dayKey(s.dateTimeUtc) !== day) return false;
    return true;
  };

  const filtered = sorted.filter((v) => passes(v, null));
  const stageOptions = stages.filter(
    (id) => id === stage || sorted.some((v) => v.series.stage === id && passes(v, "stage")),
  );
  const dayOptions = days.filter(
    (d) => d.key === day || sorted.some((v) => dayKey(v.series.dateTimeUtc) === d.key && passes(v, "day")),
  );
  const teamOptions = teams.filter(
    (t) =>
      t.id === team ||
      sorted.some((v) => (v.series.team1Id === t.id || v.series.team2Id === t.id) && passes(v, "team")),
  );
  const hasToday = todayKey !== null && sorted.some((v) => dayKey(v.series.dateTimeUtc) === todayKey);

  const upcoming = filtered.filter((v) => v.series.status !== "finished");
  const results = filtered.filter((v) => v.series.status === "finished").reverse();

  const groupByDay = (list: SeriesView[]) => {
    const groups = new Map<string, SeriesView[]>();
    for (const v of list) {
      const k = dayKey(v.series.dateTimeUtc);
      const bucket = groups.get(k);
      if (bucket) bucket.push(v);
      else groups.set(k, [v]);
    }
    return Array.from(groups.values());
  };

  const chips = [
    {
      label: "Today",
      pressed: todayKey !== null && day === todayKey,
      disabled: !hasToday,
      title: hasToday ? undefined : "No series today",
      onClick: () => update({ day: day === todayKey ? null : todayKey, status: null }),
    },
    {
      label: "Upcoming",
      pressed: status === "upcoming",
      onClick: () => update({ status: status === "upcoming" ? null : "upcoming" }),
    },
    {
      label: "Results",
      pressed: status === "finished",
      onClick: () => update({ status: status === "finished" ? null : "finished" }),
    },
  ];

  const block = (title: string, list: SeriesView[]) => (
    <Section
      collapsible
      title={
        <>
          {title} <span className="text-muted-foreground">{list.length}</span>
        </>
      }
    >
      <div className="space-y-6">
        {groupByDay(list).map((group) => (
          <section key={group[0].series.id} className="space-y-3">
            <h3 className="kicker text-xs text-brand">
              <LocalTime iso={group[0].series.dateTimeUtc} mode="weekday" />
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((v) => (
                <SeriesCard
                  key={v.series.id}
                  series={v.series}
                  team1={v.team1}
                  team2={v.team2}
                  pending={v.pending}
                  compact
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Section>
  );

  return (
    <div className="space-y-8">
      <form className="space-y-3" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.onClick}
                aria-pressed={c.pressed}
                disabled={c.disabled}
                title={c.title}
                className={cn(
                  chipClass,
                  c.pressed ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => update({ stage: null, team: null, status: null, day: null })}
            disabled={!active}
            className={cn(chipClass, "ml-auto bg-card text-muted-foreground")}
          >
            Clear filters
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stage</span>
            <select className={selectClass} value={stage} onChange={(e) => update({ stage: e.target.value })}>
              <option value="all">All stages</option>
              {stageOptions.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Day</span>
            <select className={selectClass} value={day} onChange={(e) => update({ day: e.target.value })}>
              <option value="all">All days</option>
              {dayOptions.map((d) => (
                <option key={d.key} value={d.key}>
                  {mounted
                    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
                        new Date(d.iso),
                      )
                    : d.key}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Team</span>
            <select className={selectClass} value={team} onChange={(e) => update({ team: e.target.value })}>
              <option value="all">All teams</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select className={selectClass} value={status} onChange={(e) => update({ status: e.target.value })}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="flex items-center text-sm text-muted-foreground" aria-live="polite">
            {filtered.length} of {views.length} series
          </p>
        </div>
      </form>

      {status !== "finished" && upcoming.length ? block("Up next", upcoming) : null}
      {status !== "upcoming" && results.length ? block("Results", results) : null}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No series match these filters.
        </p>
      ) : null}
    </div>
  );
}
