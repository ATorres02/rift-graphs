import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { EyeOffIcon } from "lucide-react";
import { TeamPill } from "@/components/team-pill";
import { teamRef, type IndexedDataset, type TeamRef } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import type { Series } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { G } from "./geometry";

export interface CellTeam {
  team: TeamRef;
  /** Regional seed, e.g. "LCK #1". */
  seed: string;
}

export function cellTeam(data: IndexedDataset, id: string | null): CellTeam | null {
  const t = id ? data.teamsById.get(id) : undefined;
  if (!t) return null;
  return {
    team: teamRef(t)!,
    seed: t.seed ? `${t.seed.league} #${t.seed.seed}` : regionInfo(t.region).code,
  };
}

/**
 * Spoiler steps and path highlighting. Column N carries data-gate=N-1 (its pairings give away the results before it)
 * and its series carry data-rgate=N (their own results). While spoilers are hidden, anything whose step is missing
 * from the frame's data-revealed is hidden, and the next step shows its reveal button. Hovering or focusing a team
 * outlines all its boxes and dims the rest; hidden boxes cannot be hovered and their frames never dim, so nothing leaks.
 */
export function bracketCss(steps: number, teamIds: string[]): string {
  const hidden = 'html[data-spoilers="hidden"] [data-bracket]';
  const rules: string[] = [];
  for (let s = 1; s <= steps; s++) {
    const locked = `${hidden}:not([data-revealed~="${s}"])`;
    rules.push(
      `${locked} [data-gate="${s}"] .b-gated{visibility:hidden}`,
      `${locked} [data-gate="${s}"] .b-slot{background-image:var(--b-locked)}`,
      `${hidden}[data-next="${s}"] [data-gate="${s}"]>.b-reveal{display:inline-flex}`,
      `${locked} [data-rgate="${s}"] :is(.b-score,.b-won){display:none}`,
      `${locked} [data-rgate="${s}"] .b-vs{display:inline}`,
      // Losers fade once their result shows: grey logo, muted tag (opacity on the text would drop it below AA).
      `:is(html:not([data-spoilers="hidden"]) [data-bracket],[data-bracket][data-revealed~="${s}"]) [data-rgate="${s}"] [data-outcome="loss"] .b-pill img{filter:grayscale(1);opacity:.45}`,
      `:is(html:not([data-spoilers="hidden"]) [data-bracket],[data-bracket][data-revealed~="${s}"]) [data-rgate="${s}"] [data-outcome="loss"] .b-pill>span{color:var(--muted-foreground)}`,
    );
  }
  for (const id of teamIds) {
    const on = `[data-bracket]:has([data-team="${id}"]:hover,[data-cell]:focus-visible [data-team="${id}"])`;
    rules.push(
      `${on} [data-team="${id}"]{background:var(--brand-soft);box-shadow:inset 0 0 0 1px var(--brand)}`,
      `${on} .b-gated:not([data-team="${id}"]):not(:has([data-team="${id}"])){opacity:.35}`,
    );
  }
  return rules.join("\n");
}

function Side({ entry, align, outcome }: { entry: CellTeam | null; align: "start" | "end"; outcome?: "win" | "loss" }) {
  const alignment = align === "end" ? "items-end" : "items-start";
  if (!entry) {
    return (
      <span className={cn("flex min-w-0 flex-col justify-center px-1", alignment)}>
        <span className="text-[11px] font-semibold text-muted-foreground">TBD</span>
      </span>
    );
  }
  return (
    <span
      data-team={entry.team.id}
      data-outcome={outcome}
      className={cn("flex min-w-0 flex-col gap-0.5 rounded px-1 py-0.5 transition-colors", alignment)}
    >
      <span
        aria-hidden
        className="truncate text-[9px] font-medium uppercase leading-none tracking-wide text-muted-foreground"
      >
        {entry.seed}
      </span>
      <TeamPill team={entry.team} link={false} size="xs" className="b-pill" />
    </span>
  );
}

function Center({ series }: { series: Series | null }) {
  const score = series && series.status !== "scheduled" ? series.score : null;
  const vs = (cls?: string) => <span className={cn("kicker text-[11px] text-muted-foreground", cls)}>VS</span>;
  return (
    <span className="flex w-9 flex-col items-center justify-center leading-none">
      {series?.status === "live" ? (
        <span className="mb-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-brand">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
          Live
        </span>
      ) : null}
      {score ? (
        <>
          <span className="b-score text-sm font-bold tabular">
            {score.team1}
            <span className="text-muted-foreground">–</span>
            {score.team2}
          </span>
          {vs("b-vs")}
        </>
      ) : (
        vs()
      )}
    </span>
  );
}

/** One series slot: teams side by side, the score (or VS) between them, the whole box a link to the series. */
export function MatchSlot({
  series,
  team1,
  team2,
  context,
  step,
}: {
  series: Series | null;
  team1: CellTeam | null;
  team2: CellTeam | null;
  /** Read by screen readers before the teams, e.g. "Round 4, 2-1 group, Bo3". */
  context: string;
  /** Reveal step of this series' result. */
  step: number;
}) {
  const winnerId = series?.status === "finished" ? series.winnerId : null;
  const outcome = (id: string | null | undefined) => (winnerId && id ? (id === winnerId ? "win" : "loss") : undefined);
  const winner = winnerId ? [team1, team2].find((t) => t?.team.id === winnerId) : null;
  const body = (
    <>
      <span className="sr-only">{context}: </span>
      <Side entry={team1} align="start" outcome={outcome(series?.team1Id)} />
      <Center series={series} />
      <Side entry={team2} align="end" outcome={outcome(series?.team2Id)} />
      {winner ? <span className="b-won sr-only">, {winner.team.short} won</span> : null}
    </>
  );
  const grid = "b-gated grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0.5 rounded-md px-1";
  return (
    <li data-rgate={step} className="b-slot rounded-md border bg-card" style={{ height: G.cell }}>
      {series ? (
        <Link
          href={`/matches/${series.id}`}
          data-cell=""
          className={cn(
            grid,
            "no-underline transition-colors hover:bg-accent/40",
            series.status === "live" && "ring-1 ring-brand/60",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={grid}>{body}</div>
      )}
    </li>
  );
}

/** Line above a group or box: details on the left, the record (or label) on the right; screen readers hear the record first. */
export function BlockHead({ record, children, accent }: { record?: ReactNode; children: ReactNode; accent?: boolean }) {
  return (
    <h4
      className="kicker flex items-end justify-between gap-2 pb-1 text-[10px] text-muted-foreground"
      style={{ height: G.head }}
    >
      {record ? <span className="order-2 shrink-0 text-xs text-foreground tabular">{record}</span> : null}
      <span className={cn("order-1 truncate", accent && "text-brand")}>{children}</span>
    </h4>
  );
}

/** Qualified, eliminated or champion box: a fixed number of team slots. */
export function TeamsBox({
  teams,
  slots,
  tone,
  withName = false,
}: {
  teams: TeamRef[];
  slots: number;
  tone: "brand" | "muted";
  /** Full team name next to the tag (the champion box). */
  withName?: boolean;
}) {
  return (
    <ul
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-1.5",
        tone === "brand" ? "border-brand/50 bg-brand-soft" : "bg-card",
      )}
      style={{ height: G.outcome }}
    >
      {Array.from({ length: slots }, (_, i) => {
        const t = teams[i];
        return (
          <li
            key={i}
            className="b-slot flex h-7 min-w-0 flex-1 items-center justify-center rounded border border-dashed border-border"
          >
            {t ? (
              <span
                data-team={t.id}
                className="b-gated flex size-full items-center justify-center rounded transition-colors"
              >
                <TeamPill team={t} size={withName ? "sm" : "xs"} withName={withName} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Absolutely placed box inside a column body. */
export const at = (top: number, height: number): CSSProperties => ({ top, height });

export function BracketColumn({
  id,
  index,
  title,
  current,
  height,
  revealLabel,
  maxWidth,
  children,
}: {
  id: string;
  /** 1-based column index: its reveal step is index - 1. */
  index: number;
  title: string;
  current: boolean;
  height: number;
  revealLabel: string;
  /** Cap for brackets with few columns, so their boxes do not stretch across the page. */
  maxWidth?: number;
  children: ReactNode;
}) {
  return (
    <section
      data-gate={index - 1}
      data-current={current ? "" : undefined}
      aria-labelledby={id}
      className="relative flex-1 snap-start"
      style={{ minWidth: G.colMin, maxWidth }}
    >
      <h3
        id={id}
        tabIndex={-1}
        className={cn(
          "kicker flex items-center gap-1.5 text-xs outline-none",
          current ? "text-brand" : "text-muted-foreground",
        )}
        style={{ height: G.title }}
      >
        {current ? <span className="size-1.5 rounded-full bg-brand" aria-hidden /> : null}
        {title}
        {current ? <span className="sr-only">, now</span> : null}
      </h3>
      <div className="relative" style={{ height }}>
        {children}
      </div>
      {index > 1 ? (
        <button
          type="button"
          data-reveal=""
          className="b-reveal absolute left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-brand bg-background px-2.5 py-1.5 text-xs font-medium shadow-lg transition-colors hover:bg-brand-soft"
          style={{ top: G.title + height / 2 - 16 }}
        >
          <EyeOffIcon className="size-3.5" aria-hidden />
          {revealLabel}
        </button>
      ) : null}
    </section>
  );
}

/** Elbow lines between two columns, from anchors on the left to anchors on the right. */
export function Connectors({ height, links }: { height: number; links: [number, number][] }) {
  const mid = G.gap / 2;
  return (
    <div aria-hidden className="flex-none" style={{ width: G.gap, paddingTop: G.title }}>
      <svg width={G.gap} height={height} className="overflow-visible text-muted-foreground/40">
        {links.map(([a, b], i) => (
          <path
            key={i}
            d={`M0 ${a}H${mid}V${b}H${G.gap}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
