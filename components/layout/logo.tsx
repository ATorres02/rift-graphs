import { cn } from "@/lib/utils";

/**
 * The Rift Graphs mark: three rising bars split by a rift. Bars take
 * `currentColor`; the crack is drawn in the page background so it reads as a cut.
 */
export function LogoMark({ className, crack = "var(--background)" }: { className?: string; crack?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden fill="currentColor">
      <rect x="3" y="19" width="7" height="10" />
      <rect x="12.5" y="12" width="7" height="17" />
      <rect x="22" y="4" width="7" height="25" />
      <path
        d="M2 29 11 21.5 9 19.5 19 12 17 10 30 5.5"
        fill="none"
        stroke={crack}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
