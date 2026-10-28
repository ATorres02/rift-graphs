import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { LocalTime } from "@/components/local-time";
import { PendingData } from "@/components/pending-data";
import { ProvisionalBadge } from "@/components/provisional";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import type { TeamRef } from "@/lib/data/load";
import type { Series } from "@/lib/data/types";
import { bestOfLabel, roundLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SeriesCardProps {
  series: Series;
  team1: TeamRef | null;
  team2: TeamRef | null;
  pending?: boolean;
  compact?: boolean;
  className?: string;
}

/** A series (Bo1/Bo3/Bo5) as a card: teams, local time, status and spoiler-safe score. */
export function SeriesCard({ series: s, team1, team2, pending = false, compact = false, className }: SeriesCardProps) {
  const winner1 = s.winnerId !== null && s.winnerId === s.team1Id;
  const winner2 = s.winnerId !== null && s.winnerId === s.team2Id;
  return (
    <article className={cn("rounded-xl border bg-card p-3 transition-colors hover:border-brand/60 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {roundLabel(s.stage, s.round, s.tab)} · {bestOfLabel(s.bestOf)}
        </span>
        <LocalTime iso={s.dateTimeUtc} mode={compact ? "time" : "datetime"} hasTime={s.hasTime} />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamSide team={team1} winner={winner1} align="left" />
        <ScoreBlock series={s} />
        <TeamSide team={team2} winner={winner2} align="right" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2">
          <StatusLabel series={s} />
          {s.provisional ? <ProvisionalBadge source={s.source} /> : null}
          {pending ? <PendingData /> : null}
        </span>
        <Link
          href={`/matches/${s.id}`}
          className="font-medium text-muted-foreground underline hover:text-foreground"
          aria-label={`Details: ${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}`}
        >
          Details
        </Link>
      </div>
    </article>
  );
}

function TeamSide({ team, winner, align }: { team: TeamRef | null; winner: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <TeamPill team={team} link={false} size="md" />
      <span className="truncate text-sm font-medium">{team?.name ?? "TBD"}</span>
      {winner ? (
        <Spoiler label="W?">
          <span className="rounded bg-win/15 px-1 text-[10px] font-semibold text-win">WIN</span>
        </Spoiler>
      ) : null}
    </div>
  );
}

function ScoreBlock({ series: s }: { series: Series }) {
  if (s.status === "scheduled" || !s.score) {
    return <span className="px-2 text-sm text-muted-foreground">vs</span>;
  }
  return (
    <Spoiler label="Score">
      <span className="px-2 text-lg font-semibold tabular">
        {s.score.team1}
        <span className="mx-1 text-muted-foreground">–</span>
        {s.score.team2}
      </span>
    </Spoiler>
  );
}

export function StatusLabel({ series: s }: { series: Series }) {
  if (s.status === "finished") return <span className="font-medium text-muted-foreground">Final</span>;
  if (s.status === "live") return <span className="font-medium text-brand">In progress</span>;
  return <Countdown iso={s.dateTimeUtc} className="font-medium text-brand" />;
}
