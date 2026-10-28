import Link from "next/link";
import { regionInfo } from "@/lib/data/regions";
import type { TeamRef } from "@/lib/data/load";
import { cn } from "@/lib/utils";

interface TeamPillProps {
  team: TeamRef | null;
  size?: "sm" | "md" | "lg";
  /** Show the full team name next to the tag. */
  withName?: boolean;
  link?: boolean;
  className?: string;
}

const SIZES = {
  sm: "h-6 min-w-10 px-1.5 text-[11px]",
  md: "h-7 min-w-12 px-2 text-xs",
  lg: "h-9 min-w-16 px-3 text-sm",
};

/** Team identity without logos: the team tag on a pill coloured by region. */
export function TeamPill({ team, size = "md", withName = false, link = true, className }: TeamPillProps) {
  if (!team) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-dashed font-semibold text-muted-foreground",
          SIZES[size],
          className,
        )}
      >
        TBD
      </span>
    );
  }
  const region = regionInfo(team.region);
  const pill = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-bold tracking-wide text-region-foreground",
        SIZES[size],
      )}
      style={{ backgroundColor: `var(${region.cssVar})`, color: `var(${region.cssVar}-fg, var(--region-foreground))` }}
      title={`${team.name}, ${region.code}`}
    >
      {team.short}
    </span>
  );
  const content = withName ? (
    <span className="inline-flex items-center gap-2">
      {pill}
      <span className="font-medium">{team.name}</span>
    </span>
  ) : (
    pill
  );
  if (!link) return <span className={className}>{content}</span>;
  return (
    <Link href={`/teams/${team.id}`} className={cn("inline-flex items-center rounded-md hover:opacity-90", className)}>
      {content}
      {withName ? null : <span className="sr-only"> {team.name}</span>}
    </Link>
  );
}

export function RegionTag({ region, className }: { region: string; className?: string }) {
  const info = regionInfo(region);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: `var(${info.cssVar})` }}
        aria-hidden
      />
      {info.code}
    </span>
  );
}
