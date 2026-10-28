import {
  ChartColumnIcon,
  HomeIcon,
  InfoIcon,
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
  { href: "/tournament", label: "Tournament", icon: TrophyIcon },
  { href: "/matches", label: "Matches", icon: SwordsIcon },
  { href: "/teams", label: "Teams", icon: ShieldIcon },
  { href: "/players", label: "Players", icon: UsersIcon },
  { href: "/champions", label: "Champions", icon: SparklesIcon },
  { href: "/charts", label: "Charts", icon: ChartColumnIcon },
  { href: "/compare", label: "Compare", icon: ScaleIcon },
  { href: "/about", label: "About", icon: InfoIcon },
] as const;
