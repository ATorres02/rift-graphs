"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LocalTime } from "@/components/local-time";
import { SeriesCard } from "@/components/series-card";
import type { TeamRef } from "@/lib/data/load";
import type { StageId } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/format";
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

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";

/** Filterable schedule grouped by day in the visitor's time zone (UTC until hydration). */
export function MatchList({ views, teams, stages }: MatchListProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stage = params.get("stage") ?? "all";
  const team = params.get("team") ?? "all";
  const status = params.get("status") ?? "all";
  const day = params.get("day") ?? "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`/matches${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const dayKey = (iso: string) => (mounted ? localDayKey(iso) : iso.slice(0, 10));

  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of views) {
      const k = dayKey(v.series.dateTimeUtc);
      if (!seen.has(k)) seen.set(k, v.series.dateTimeUtc);
    }
    return Array.from(seen, ([key, iso]) => ({ key, iso }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, mounted]);

  const filtered = views.filter((v) => {
    const s = v.series;
    if (stage !== "all" && s.stage !== stage) return false;
    if (team !== "all" && s.team1Id !== team && s.team2Id !== team) return false;
    if (status === "upcoming" && s.status === "finished") return false;
    if (status === "finished" && s.status !== "finished") return false;
    if (day !== "all" && dayKey(s.dateTimeUtc) !== day) return false;
    return true;
  });

  const groups = new Map<string, SeriesView[]>();
  for (const v of filtered) {
    const k = dayKey(v.series.dateTimeUtc);
    const list = groups.get(k);
    if (list) list.push(v);
    else groups.set(k, [v]);
  }

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Stage</span>
          <select className={selectClass} value={stage} onChange={(e) => setParam("stage", e.target.value)}>
            <option value="all">All stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Day</span>
          <select className={selectClass} value={day} onChange={(e) => setParam("day", e.target.value)}>
            <option value="all">All days</option>
            {days.map((d) => (
              <option key={d.key} value={d.key}>
                {mounted ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(d.iso)) : d.key}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Team</span>
          <select className={selectClass} value={team} onChange={(e) => setParam("team", e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select className={selectClass} value={status} onChange={(e) => setParam("status", e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} of {views.length} series
      </p>

      {Array.from(groups).map(([key, list]) => (
        <section key={key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <LocalTime iso={list[0].series.dateTimeUtc} mode="weekday" />
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => (
              <SeriesCard key={v.series.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} compact />
            ))}
          </div>
        </section>
      ))}
      {filtered.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No series match these filters.</p> : null}
    </div>
  );
}
