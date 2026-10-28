"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { inputClass, selectClass } from "./builder-steps";
import type { TeamRef } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import type { Role, StageId } from "@/lib/data/types";
import { ROLE_LABEL, STAGE_LABEL } from "@/lib/format";
import { ROLES } from "@/lib/metrics";
import type { QueryConfig, QueryFilters } from "@/lib/query";
import { cn } from "@/lib/utils";

export interface FilterCatalog {
  teams: TeamRef[];
  regions: string[];
  champions: string[];
  stages: StageId[];
}

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-md border px-2 py-1 text-xs transition-colors hover:border-brand",
        on && "border-brand bg-brand-soft font-medium",
      )}
    >
      {children}
    </button>
  );
}

function toggleIn<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list ? [...list] : [];
  const i = next.indexOf(value);
  if (i >= 0) next.splice(i, 1);
  else next.push(value);
  return next.length ? next : undefined;
}

export function FiltersStep({
  config,
  catalog,
  onChange,
}: {
  config: QueryConfig;
  catalog: FilterCatalog;
  onChange: (filters: QueryFilters) => void;
}) {
  const f = config.filters;
  const set = (patch: Partial<QueryFilters>) => {
    const next = { ...f, ...patch };
    for (const k of Object.keys(next) as (keyof QueryFilters)[]) if (next[k] === undefined) delete next[k];
    onChange(next);
  };
  const playerLike = config.source === "players" || config.source === "champions";
  const entityDim = ["player", "team", "champion"].includes(config.groupBy);
  const [champQuery, setChampQuery] = useState("");
  const champMatches =
    champQuery.length >= 2
      ? catalog.champions
          .filter((c) => c.toLowerCase().includes(champQuery.toLowerCase()) && !f.champions?.includes(c))
          .slice(0, 8)
      : [];

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</p>
        <div className="flex flex-wrap gap-1.5">
          {catalog.stages.map((s) => (
            <Chip key={s} on={!!f.stages?.includes(s)} onClick={() => set({ stages: toggleIn(f.stages, s) })}>
              {STAGE_LABEL[s]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Region</p>
        <div className="flex flex-wrap gap-1.5">
          {catalog.regions.map((r) => (
            <Chip
              key={r}
              on={!!f.regions?.includes(r)}
              onClick={() => set({ regions: toggleIn(f.regions, r) })}
              title={r}
            >
              {regionInfo(r).code}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teams</p>
        <div className="flex flex-wrap gap-1.5">
          {catalog.teams.map((t) => (
            <Chip
              key={t.id}
              on={!!f.teams?.includes(t.id)}
              onClick={() => set({ teams: toggleIn(f.teams, t.id) })}
              title={t.name}
            >
              {t.short}
            </Chip>
          ))}
        </div>
      </div>
      {playerLike ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r: Role) => (
              <Chip key={r} on={!!f.roles?.includes(r)} onClick={() => set({ roles: toggleIn(f.roles, r) })}>
                {ROLE_LABEL[r]}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {config.source !== "games" ? (
          <label className="text-xs text-muted-foreground">
            Side
            <select
              className={selectClass}
              value={f.side ?? ""}
              onChange={(e) => set({ side: (e.target.value || undefined) as QueryFilters["side"] })}
            >
              <option value="">Both</option>
              <option value="blue">Blue</option>
              <option value="red">Red</option>
            </select>
          </label>
        ) : null}
        {config.source !== "games" ? (
          <label className="text-xs text-muted-foreground">
            Result
            <select
              className={selectClass}
              value={f.result ?? ""}
              onChange={(e) => set({ result: (e.target.value || undefined) as QueryFilters["result"] })}
            >
              <option value="">Wins and losses</option>
              <option value="win">Wins only</option>
              <option value="loss">Losses only</option>
            </select>
          </label>
        ) : null}
        {entityDim ? (
          <label className="text-xs text-muted-foreground">
            Minimum games
            <input
              type="number"
              min={0}
              max={50}
              className={inputClass}
              value={f.minGames ?? 0}
              onChange={(e) => set({ minGames: Number(e.target.value) || undefined })}
            />
          </label>
        ) : null}
        <label className="text-xs text-muted-foreground">
          Game length (min)
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder="from"
              value={f.durationMin !== undefined ? Math.round(f.durationMin / 60) : ""}
              onChange={(e) => set({ durationMin: e.target.value === "" ? undefined : Number(e.target.value) * 60 })}
              aria-label="Minimum game length in minutes"
            />
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder="to"
              value={f.durationMax !== undefined ? Math.round(f.durationMax / 60) : ""}
              onChange={(e) => set({ durationMax: e.target.value === "" ? undefined : Number(e.target.value) * 60 })}
              aria-label="Maximum game length in minutes"
            />
          </span>
        </label>
      </div>
      {playerLike ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Champion</p>
          <div className="flex flex-wrap gap-1.5">
            {(f.champions ?? []).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-md border border-brand bg-brand-soft px-2 py-1 text-xs font-medium"
              >
                {c}
                <button
                  type="button"
                  onClick={() => set({ champions: toggleIn(f.champions, c) })}
                  aria-label={`Remove ${c}`}
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          <input
            className={cn(inputClass, "mt-1.5")}
            placeholder="Type a champion name…"
            value={champQuery}
            onChange={(e) => setChampQuery(e.target.value)}
            aria-label="Add a champion filter"
          />
          {champMatches.length ? (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {champMatches.map((c) => (
                <li key={c}>
                  <Chip
                    on={false}
                    onClick={() => {
                      set({ champions: [...(f.champions ?? []), c] });
                      setChampQuery("");
                    }}
                  >
                    + {c}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {Object.keys(f).length ? (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}
