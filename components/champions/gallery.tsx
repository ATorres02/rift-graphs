"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSpoilers } from "@/components/spoilers";
import type { Role } from "@/lib/data/types";
import { fmt, ROLE_LABEL } from "@/lib/format";
import { championLoadingUrl, championPageArt, championSlug } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface GalleryChampion {
  name: string;
  ddragonId: string | null;
  title: string | null;
  presence: number;
  picks: number;
  bans: number;
  wins: number;
  winRate: number | null;
  byRole: Partial<Record<Role, { games: number; wins: number }>>;
}

const ROLES: Role[] = ["top", "jungle", "mid", "bot", "support"];
/** Cards shown before the "Show all" button (four rows of six on wide screens). */
const PAGE_SIZE = 24;

/** Portrait cards of every drafted champion, sorted by presence, with role filter and search. */
export function ChampionGallery({ champions, games }: { champions: GalleryChampion[]; games: number }) {
  const [role, setRole] = useState<Role | "all">("all");
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r === "top" || r === "jungle" || r === "mid" || r === "bot" || r === "support") setRole(r);
  }, []);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const { mode } = useSpoilers();
  const hideResults = mode === "hidden";

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = champions.filter(
      (c) => (role === "all" || c.byRole[role]) && (!q || c.name.toLowerCase().includes(q)),
    );
    if (role !== "all")
      list.sort((a, b) => (b.byRole[role]?.games ?? 0) - (a.byRole[role]?.games ?? 0) || b.presence - a.presence);
    return list;
  }, [champions, role, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-1.5">
          {(["all", ...ROLES] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand",
                role === r ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
              )}
            >
              {r === "all" ? "All roles" : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only">Search champion</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 w-36 rounded-md border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {shown.length} champions{role !== "all" ? ` played ${ROLE_LABEL[role].toLowerCase()}` : ""}, presence = picked
        or banned share of {games} games
        {hideResults ? ", win rates hidden by spoiler mode" : ""}
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {(expanded ? shown : shown.slice(0, PAGE_SIZE)).map((c, i) => {
          const roleGames = role !== "all" ? c.byRole[role] : null;
          const wr = hideResults ? null : roleGames ? roleGames.wins / Math.max(roleGames.games, 1) : c.winRate;
          const href = c.ddragonId ? `/champions/${championSlug(c.ddragonId)}` : null;
          const art = c.ddragonId ? championPageArt(c.ddragonId) : null;
          const card = (
            <article className="group relative aspect-[308/560] overflow-hidden rounded-2xl border bg-card shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-brand/70">
              {c.ddragonId ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote art, fixed box, no optimiser in a static export
                <img
                  src={championLoadingUrl(c.ddragonId, art?.skin)}
                  alt=""
                  width={308}
                  height={560}
                  loading={i < 4 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i < 2 ? "high" : "auto"}
                  className={cn(
                    "absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]",
                    art?.tribute && "grayscale",
                  )}
                />
              ) : (
                <div className="absolute inset-0 bg-muted" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-2.5 pt-14 text-white sm:p-3">
                <p className="truncate text-sm font-semibold leading-tight sm:text-base">{c.name}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular leading-none sm:text-xl">{fmt.pct(c.presence)}</span>
                  <span className="text-[10px] uppercase tracking-wide text-white/70">presence</span>
                </p>
                <p className="mt-1 text-[11px] text-white/80 tabular">
                  {c.picks}P / {c.bans}B{wr !== null ? ` / ${fmt.pct(wr)} WR` : ""}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {ROLES.filter((r) => c.byRole[r]).map((r) => (
                    <span
                      key={r}
                      className="rounded bg-white/15 px-1 text-[9px] font-medium uppercase tracking-wide text-white/90"
                    >
                      {ROLE_LABEL[r]}
                    </span>
                  ))}
                </p>
              </div>
            </article>
          );
          return (
            <li key={c.name}>
              {href ? (
                <Link href={href} className="block no-underline focus-visible:outline-2 focus-visible:outline-brand">
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p className="text-sm text-muted-foreground">No champion matches.</p> : null}
      {shown.length > PAGE_SIZE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
        >
          {expanded ? `Show the first ${PAGE_SIZE}` : `Show all ${shown.length} champions`}
        </button>
      ) : null}
    </div>
  );
}
