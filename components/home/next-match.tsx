import { LocalTime } from "@/components/local-time";
import { StatusLabel } from "@/components/series-card";
import { TeamLogo } from "@/components/team-pill";
import type { TeamRef } from "@/lib/data/load";
import type { Series } from "@/lib/data/types";
import { previewRound } from "@/lib/preview";
import { roundLabel } from "@/lib/format";
import { HeroTile } from "./hero-tile";

function Side({ team }: { team: TeamRef | null }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {team ? <TeamLogo team={team} className="size-8 shrink-0 object-contain" /> : null}
      {team?.short ?? "TBD"}
    </span>
  );
}

/** The series to watch next, as a hero tile: the one in progress, else the next on the schedule. */
export function NextMatch({
  series: s,
  team1,
  team2,
  preview,
  className,
}: {
  series: Series;
  team1: TeamRef | null;
  team2: TeamRef | null;
  /** The series page shows its preview (both teams known, no game played yet). */
  preview: boolean;
  className?: string;
}) {
  const live = s.status === "live";
  const names = `${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}`;
  return (
    <HeroTile
      href={`/matches/${s.id}`}
      label={`${live ? "Live now" : preview ? "Match preview" : "Next up"}: ${names}`}
      className={className}
      kicker={
        live
          ? `Live now / ${roundLabel(s.stage, s.round, s.tab)}`
          : `Next up / ${preview ? `${previewRound(s.stage, s.round)} preview` : roundLabel(s.stage, s.round, s.tab)}`
      }
      title={
        // The teams spread across the tile, "vs" between them.
        <span className="flex w-full items-center justify-between gap-4 pr-2 sm:pr-4">
          <Side team={team1} /> <span className="text-lg text-zinc-500">vs</span> <Side team={team2} />
        </span>
      }
      detail={
        <>
          <LocalTime iso={s.dateTimeUtc} hasTime={s.hasTime} />
          <StatusLabel series={s} />
        </>
      }
    />
  );
}
