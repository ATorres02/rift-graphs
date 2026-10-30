import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The logo's own blue and red (its dark version): the hero is black in both themes. */
const LOGO_BLUE = "#5B74FF";
const LOGO_RED = "#FF5A6E";

/** Bars rise one after another on hover, from their base. */
const BAR = "origin-bottom [transform-box:fill-box] motion-safe:transition-transform motion-safe:duration-300";

/**
 * The hero's call to the chart builder, drawn like the logo: three lanes (blue, red, blue) and a white line rising
 * across them, inside a frame that runs from the logo's blue to its red.
 */
export function BuildChartButton({ className }: { className?: string }) {
  return (
    <Link
      href="/charts"
      className={cn("cut-corner group block p-[1.5px] no-underline", className)}
      style={{ backgroundImage: `linear-gradient(110deg, ${LOGO_BLUE}, ${LOGO_RED})` }}
    >
      <span className="cut-corner flex items-center gap-4 bg-black/85 py-3 pr-6 pl-4 backdrop-blur transition-colors group-hover:bg-black/70">
        <svg viewBox="0 0 44 32" aria-hidden className="h-9 w-12 shrink-0">
          <rect
            x={2}
            y={16}
            width={10}
            height={16}
            rx={1.5}
            fill={LOGO_BLUE}
            className={BAR + " group-hover:scale-y-110"}
          />
          <rect
            x={17}
            y={10}
            width={10}
            height={22}
            rx={1.5}
            fill={LOGO_RED}
            className={BAR + " delay-75 group-hover:scale-y-110"}
          />
          <rect
            x={32}
            y={4}
            width={10}
            height={28}
            rx={1.5}
            fill={LOGO_BLUE}
            className={BAR + " delay-150 group-hover:scale-y-110"}
          />
          <path
            d="M3 24L22 14L41 2"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="min-w-0">
          <span className="display block text-2xl font-bold text-white sm:text-3xl">Build a chart</span>
          <span className="block text-xs text-zinc-400">Find the stat that settles it</span>
        </span>
        <ArrowRightIcon
          aria-hidden
          className="ml-auto size-5 shrink-0 text-white motion-safe:transition-transform group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}
