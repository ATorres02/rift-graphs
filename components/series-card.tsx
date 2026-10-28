import { ChevronRightIcon } from "lucide-react";
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
  /** How the winner's name is marked: bold everywhere, bold and coloured on one-off stages like the Play-In. */
  emphasis?: "bold" | "strong";
}

/**
 * A series (Bo1/Bo3/Bo5) as a card: one row per team so names never truncate
 * on phones, the score in a spoiler-safe column, status and links below.
 * Nothing outside the spoiler hints at the result (no dimmed loser).
 */
export function SeriesCard({
  series: s,
  team1,
  team2,
  pending = false,
  compact = false,
  className,
  emphasis = "bold",
}: SeriesCardProps) {
  const winner1 = s.winnerId !== null && s.winnerId === s.team1Id;
  const winner2 = s.winnerId !== null && s.winnerId === s.team2Id;
  const showScore = s.status !== "scheduled" && s.score !== null;
  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card p-3 transition-colors hover:border-brand/60 sm:p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {roundLabel(s.stage, s.round, s.tab)} / {bestOfLabel(s.bestOf)}
        </span>
        <span className="shrink-0">
          <LocalTime iso={s.dateTimeUtc} mode={compact ? "time" : "datetime"} hasTime={s.hasTime} />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
        <div className="min-w-0 space-y-1.5">
          <TeamRow team={team1} winner={winner1} emphasis={emphasis} />
          <TeamRow team={team2} winner={winner2} emphasis={emphasis} />
        </div>
        {showScore ? (
          <Spoiler label="Score">
            <div className="flex flex-col items-end space-y-1.5 text-lg font-semibold tabular">
              <ScoreCell value={s.score!.team1} winner={winner1} />
              <ScoreCell value={s.score!.team2} winner={winner2} />
            </div>
          </Spoiler>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2 text-xs">
        <span className="flex flex-wrap items-center gap-2">
          <StatusLabel series={s} />
          {s.provisional ? <ProvisionalBadge source={s.source} /> : null}
          {pending ? <PendingData /> : null}
        </span>
        <Link
          href={`/matches/${s.id}`}
          className="inline-flex shrink-0 items-center gap-0.5 font-medium text-muted-foreground no-underline transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-foreground hover:text-foreground"
          aria-label={`Details: ${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}`}
        >
          Details <ChevronRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function TeamRow({ team, winner, emphasis }: { team: TeamRef | null; winner: boolean; emphasis: "bold" | "strong" }) {
  return (
    <div className="flex h-7 min-w-0 items-center gap-2">
      <TeamPill team={team} link={false} size="sm" />
      <span
        className={cn(
          "truncate text-sm font-medium",
          winner && "spoiler-winner font-bold",
          winner && emphasis === "strong" && "text-win",
        )}
      >
        {team?.name ?? "TBD"}
      </span>
    </div>
  );
}

function ScoreCell({ value, winner }: { value: number; winner: boolean }) {
  return (
    <span className={cn("flex h-7 items-center gap-1.5", winner ? "text-foreground" : "text-muted-foreground")}>
      {winner ? <span className="rounded bg-win/15 px-1 text-[10px] font-semibold text-win">WIN</span> : null}
      {value}
    </span>
  );
}

export function StatusLabel({ series: s }: { series: Series }) {
  if (s.status === "finished") return <span className="font-medium text-muted-foreground">Final</span>;
  if (s.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-brand">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-brand" />
        </span>
        In progress
      </span>
    );
  }
  return <Countdown iso={s.dateTimeUtc} className="font-medium text-brand" />;
}
