import {
  ChartColumnIcon,
  CrownIcon,
  HomeIcon,
  MedalIcon,
  ScaleIcon,
  ShieldIcon,
  SparklesIcon,
  SwordsIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";

/** Site navigation (plain module so server components can read it too). */
export const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/matches/main-event-finals-1", label: "Final", icon: CrownIcon },
  { href: "/tournament", label: "Tournament", icon: TrophyIcon },
  { href: "/matches", label: "Matches", icon: SwordsIcon },
  { href: "/teams", label: "Teams", icon: ShieldIcon },
  { href: "/players", label: "Players", icon: UsersIcon },
  { href: "/champions", label: "Champions", icon: SparklesIcon },
  { href: "/records", label: "Records", icon: MedalIcon },
  { href: "/charts", label: "Charts", icon: ChartColumnIcon },
  { href: "/compare", label: "Compare", icon: ScaleIcon },
] as const;

/** The section the menus highlight: the chart builder is what sets the site apart. */
export const FEATURED_HREF = "/charts";

/** The final's own tab, in the poster's colours, until the site moves on from Worlds 2026. */
export const FINAL_HREF = "/matches/main-event-finals-1";
