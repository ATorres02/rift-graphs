import {
  ChartColumnIcon,
  CrownIcon,
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
  // Until the site moves on from Worlds 2026 the homepage is the final's page, so its tab is the home tab.
  { href: "/", label: "Final", icon: CrownIcon },
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

/** The final's tab, in the poster's colours, until the site moves on from Worlds 2026: it is the homepage. */
export const FINAL_HREF = "/";
