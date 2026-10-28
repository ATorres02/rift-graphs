"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import type { TeamRef } from "@/lib/data/load";
import type { Role, TeamSeed } from "@/lib/data/types";
import { fmt, ROLE_LABEL } from "@/lib/format";
import leagueCountries from "@/lib/map/league-countries.json";
import { cn } from "@/lib/utils";

export interface TeamCardView {
  team: TeamRef;
  status: "champion" | "alive" | "eliminated";
  statusLabel: string;
  swiss: { wins: number; losses: number; status: "qualified" | "eliminated" | "active" } | null;
  series: { wins: number; losses: number };
  games: { wins: number; losses: number };
  roster: { playerId: string; name: string; role: Role }[];
  coaches: string[];
  seed: TeamSeed | null;
  location: string | null;
}

export interface RegionPanel {
  /** League code: LCK, LPL, LEC, LCS, LCP, CBLOL. */
  code: string;
  name: string;
  cssVar: string;
  teams: TeamCardView[];
}

const MAP = leagueCountries as {
  width: number;
  height: number;
  countries: { code: string; name: string; d: string }[];
};
const ROLE_ORDER: Role[] = ["top", "jungle", "mid", "bot", "support"];

/**
 * Flat world map (Natural Earth) with the countries of each league softly
 * coloured. Hovering a league darkens it and pops its name; tapping a league
 * (or its chip, which is also the keyboard path) shows its teams.
 */
export function TeamsExplorer({ regions }: { regions: RegionPanel[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const byCode = useMemo(() => new Map(regions.map((r) => [r.code, r])), [regions]);
  const paths = useMemo(() => {
    const map = new Map<string, { name: string; d: string }[]>();
    for (const c of MAP.countries) (map.get(c.code) ?? map.set(c.code, []).get(c.code)!).push(c);
    return map;
  }, []);
  const toggle = (code: string) => setSelected((s) => (s === code ? null : code));
  const shown = selected ? regions.filter((r) => r.code === selected) : regions;
  const move = (code: string) => (e: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ code, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const hovered = hover ? byCode.get(hover.code) : null;

  return (
    <div className="space-y-5">
      <div ref={box} className="relative overflow-hidden rounded-3xl border bg-card/60">
        <svg
          viewBox={`0 0 ${MAP.width} ${MAP.height}`}
          className="block w-full"
          role="img"
          aria-label="World map with the countries of each league highlighted"
        >
          <image href="/world-base.svg" width={MAP.width} height={MAP.height} />
          {regions.map((r) => {
            const list = paths.get(r.code);
            if (!list) return null;
            const dim = selected !== null && selected !== r.code;
            const hot = hover?.code === r.code || selected === r.code;
            return (
              <g
                key={r.code}
                onClick={() => toggle(r.code)}
                onPointerMove={move(r.code)}
                onPointerLeave={() => setHover((h) => (h?.code === r.code ? null : h))}
                className="cursor-pointer transition-opacity duration-200"
                style={{
                  opacity: dim ? 0.3 : 1,
                  fill: `var(${r.cssVar})`,
                  stroke: `var(${r.cssVar})`,
                  filter: hot ? "brightness(0.72) saturate(1.3)" : undefined,
                }}
                aria-hidden
              >
                {list.map((c) => (
                  <path
                    key={c.name}
                    d={c.d}
                    fillOpacity={hot ? 0.9 : 0.55}
                    strokeWidth={0.8}
                    strokeOpacity={0.9}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
        {hover && hovered ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
            style={{ left: hover.x, top: hover.y - 10 }}
          >
            <span
              className="mr-1.5 inline-block size-2 rounded-full align-middle"
              style={{ backgroundColor: `var(${hovered.cssVar})` }}
              aria-hidden
            />
            {hovered.code} · {hovered.name} · {hovered.teams.length} {hovered.teams.length === 1 ? "team" : "teams"}
          </div>
        ) : null}
      </div>

      <div role="group" aria-label="Choose a league" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-pressed={selected === null}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand",
            selected === null ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
          )}
        >
          All regions
        </button>
        {regions.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => toggle(r.code)}
            onPointerEnter={() => setHover(null)}
            aria-pressed={selected === r.code}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand",
              selected === r.code ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: `var(${r.cssVar})` }}
              aria-hidden
            />
            {r.code} · {r.name} · {r.teams.length}
          </button>
        ))}
      </div>

      {shown.map((r) => (
        <section key={r.code} className="space-y-3" aria-labelledby={`region-${r.code}`}>
          <h3 id={`region-${r.code}`} className="font-heading flex items-center gap-2 text-lg font-semibold">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: `var(${r.cssVar})` }}
              aria-hidden
            />
            {r.code} <span className="text-sm font-normal text-muted-foreground">{r.name}</span>
          </h3>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {r.teams.map((t) => (
              <TeamCard key={t.team.id} view={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TeamCard({ view: v }: { view: TeamCardView }) {
  const roster = [...v.roster].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return (
    <li className="rounded-2xl border bg-card p-4 transition-colors hover:border-brand/60">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/teams/${v.team.id}`} className="no-underline">
          <TeamPill team={v.team} size="lg" withName link={false} />
        </Link>
        <Spoiler label="Status">
          <span
            className={cn("text-xs font-medium", v.status === "eliminated" ? "text-muted-foreground" : "text-brand")}
          >
            {v.statusLabel}
          </span>
        </Spoiler>
      </div>
      {v.seed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {v.seed.league} #{v.seed.seed}
          </span>
          {v.seed.pool ? ` · Pool ${v.seed.pool}` : " · Play-In"} · {v.seed.path}
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Series</dt>
          <dd className="tabular font-medium">
            <Spoiler>{fmt.record(v.series.wins, v.series.losses)}</Spoiler>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Games</dt>
          <dd className="tabular font-medium">
            <Spoiler>{fmt.record(v.games.wins, v.games.losses)}</Spoiler>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Swiss</dt>
          <dd className="tabular font-medium">
            {v.swiss ? (
              <Spoiler>{`${fmt.record(v.swiss.wins, v.swiss.losses)}${v.swiss.status === "qualified" ? " ✓" : v.swiss.status === "eliminated" ? " ✗" : ""}`}</Spoiler>
            ) : (
              "–"
            )}
          </dd>
        </div>
      </dl>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {roster.map((p) => (
          <li key={p.playerId}>
            <Link
              href={`/players/${p.playerId}`}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs no-underline hover:border-brand"
            >
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">{ROLE_LABEL[p.role]}</span>
              <span className="font-medium">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      {v.coaches.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{v.coaches.length === 1 ? "Coach" : "Coaches"}:</span>{" "}
          {v.coaches.join(", ")}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {v.location ?? ""}
        {v.location ? " · " : ""}
        <Link href={`/teams/${v.team.id}`} className="underline hover:text-foreground">
          Team page
        </Link>
      </p>
    </li>
  );
}
