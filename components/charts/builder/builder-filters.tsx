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
  players: { id: string; name: string }[];
}

/** A removable chip for a value set from a link or a search box. */
function Removable({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-brand bg-brand-soft px-2 py-1 text-xs font-medium">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
        <XIcon className="size-3" aria-hidden />
      </button>
    </span>
  );
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
  onPick,
}: {
  config: QueryConfig;
  catalog: FilterCatalog;
  onChange: (filters: QueryFilters) => void;
  /** Changes the "only these" selection of the group-by dimension (charts opened from other pages). */
  onPick: (pick: string[] | undefined) => void;
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
  const [playerQuery, setPlayerQuery] = useState("");
  const playerName = (id: string) => catalog.players.find((p) => p.id === id)?.name ?? id;
  const playerMatches =
    playerQuery.length >= 2
      ? catalog.players
          .filter((p) => p.name.toLowerCase().includes(playerQuery.toLowerCase()) && !f.players?.includes(p.id))
          .slice(0, 8)
      : [];
  const pickLabel = (key: string) =>
    config.groupBy === "team"
      ? (catalog.teams.find((t) => t.id === key)?.short ?? key)
      : config.groupBy === "player"
        ? playerName(key)
        : key;
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
      {playerLike ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Player</p>
          <div className="flex flex-wrap gap-1.5">
            {(f.players ?? []).map((id) => (
              <Removable key={id} label={playerName(id)} onRemove={() => set({ players: toggleIn(f.players, id) })} />
            ))}
          </div>
          <input
            className={cn(inputClass, "mt-1.5")}
            placeholder="Type a player name…"
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            aria-label="Add a player filter"
          />
          {playerMatches.length ? (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {playerMatches.map((p) => (
                <li key={p.id}>
                  <Chip
                    on={false}
                    onClick={() => {
                      set({ players: [...(f.players ?? []), p.id] });
                      setPlayerQuery("");
                    }}
                  >
                    + {p.name}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {config.pick?.length ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Showing only</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {config.pick.map((key) => (
              <Removable
                key={key}
                label={pickLabel(key)}
                onRemove={() => {
                  const next = config.pick!.filter((k) => k !== key);
                  onPick(next.length ? next : undefined);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => onPick(undefined)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Show all
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The others still count for the tournament average and the scale.
          </p>
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
