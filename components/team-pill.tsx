import Link from "next/link";
import { regionInfo } from "@/lib/data/regions";
import type { TeamRef } from "@/lib/data/load";
import type { TeamLogo } from "@/lib/data/team-logos";
import { cn } from "@/lib/utils";

interface TeamPillProps {
  team: TeamRef | null;
  size?: "xs" | "sm" | "md" | "lg";
  /** Show the full team name next to the tag. */
  withName?: boolean;
  link?: boolean;
  className?: string;
}

const SIZES = {
  xs: "h-5 min-w-9 px-1 text-[10px]",
  sm: "h-6 min-w-10 px-1.5 text-[11px]",
  md: "h-7 min-w-12 px-2 text-xs",
  lg: "h-9 min-w-16 px-3 text-sm",
};

/** Logo and tag share the pill's height so swapping one for the other never moves the layout. */
const MARK = {
  xs: "h-5 gap-1 text-[10px]",
  sm: "h-6 gap-1.5 text-[11px]",
  md: "h-7 gap-1.5 text-xs",
  lg: "h-9 gap-2 text-sm",
};

const LOGO = { xs: "size-4", sm: "size-[18px]", md: "size-5", lg: "size-7" };

function LogoImage({ logo, className }: { logo: TeamLogo; className: string }) {
  const props = { width: 96, height: 96, loading: "lazy", decoding: "async" } as const;
  if (logo.dark === logo.light) {
    const plate =
      logo.plate === "light-theme"
        ? "rounded-[3px] bg-zinc-900 p-px dark:bg-transparent dark:p-0"
        : logo.plate === "dark-theme"
          ? "rounded-[3px] dark:bg-zinc-100 dark:p-px"
          : "";
    // eslint-disable-next-line @next/next/no-img-element -- static 96 px file, fixed box
    return <img src={logo.dark} alt="" {...props} className={cn("shrink-0 object-contain", plate, className)} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static 96 px file, fixed box */}
      <img src={logo.dark} alt="" {...props} className={cn("hidden shrink-0 object-contain dark:block", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static 96 px file, fixed box */}
      <img src={logo.light} alt="" {...props} className={cn("shrink-0 object-contain dark:hidden", className)} />
    </>
  );
}

/** The logo alone, sized by the caller (team page header); nothing when the team has no logo file. */
export function TeamLogo({ team, className }: { team: TeamRef; className: string }) {
  return team.logo ? <LogoImage logo={team.logo} className={className} /> : null;
}

/**
 * Team identity: the team's logo and tag, with no colour of its own (region colours belong to regions). Teams without a
 * logo file show the tag on a neutral pill.
 */
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
  const title = `${team.name}, ${regionInfo(team.region).code}`;
  const pill = team.logo ? (
    <span className={cn("inline-flex items-center font-bold tracking-wide text-foreground", MARK[size])} title={title}>
      <LogoImage logo={team.logo} className={LOGO[size]} />
      {team.short}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border bg-muted font-bold tracking-wide text-foreground",
        SIZES[size],
      )}
      title={title}
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
