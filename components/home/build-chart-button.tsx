import { HeroTile, LOGO_BLUE, LOGO_RED } from "./hero-tile";

/** Bars rise one after another on hover, from their base. */
const BAR = "origin-bottom [transform-box:fill-box] motion-safe:transition-transform motion-safe:duration-300";

/**
 * The hero's call to the chart builder. Its icon is drawn like the logo: three lanes (blue, red, blue) and a white
 * line rising across them.
 */
export function BuildChartButton({ className }: { className?: string }) {
  return (
    <HeroTile
      href="/charts"
      className={className}
      kicker="Chart builder"
      title="Build a chart"
      detail="Find the stat that settles it"
      icon={
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
      }
    />
  );
}
