import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The logo's own blue and red (its dark version): the hero is black in both themes. */
export const LOGO_BLUE = "#5B74FF";
export const LOGO_RED = "#FF5A6E";

/**
 * A call to action in the homepage hero, framed like the logo (its blue running into its red). Every tile has the
 * same parts, so the hero's calls read as a set: a kicker, a title in the display face, one line under it and an
 * arrow. The tile takes the dark theme (team logos pick their dark-theme file) since the hero is black in both themes.
 */
export function HeroTile({
  href,
  label,
  kicker,
  title,
  detail,
  icon,
  className,
}: {
  href: string;
  /** Accessible name when the visible text alone would not say where the link goes. */
  label?: string;
  kicker: ReactNode;
  title: ReactNode;
  detail: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("dark cut-corner group block p-[1.5px] no-underline", className)}
      style={{ backgroundImage: `linear-gradient(110deg, ${LOGO_BLUE}, ${LOGO_RED})` }}
    >
      <span className="cut-corner flex h-full items-center gap-4 bg-black/85 py-3 pr-5 pl-4 backdrop-blur transition-colors group-hover:bg-black/70">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="kicker block text-[10px] text-zinc-400 sm:text-[11px]">{kicker}</span>
          <span className="display mt-0.5 flex items-center gap-2 text-2xl font-bold whitespace-nowrap text-white sm:text-3xl">
            {title}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-400">{detail}</span>
        </span>
        <ArrowRightIcon
          aria-hidden
          className="size-5 shrink-0 text-white motion-safe:transition-transform group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}
