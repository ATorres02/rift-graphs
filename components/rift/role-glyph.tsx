import type { MarkerKind } from "./layout";
import { cn } from "@/lib/utils";

/** Our own role and objective glyphs (no Riot icons), 24×24 viewBox, stroke-based. */
export function RoleGlyph({ kind, className }: { kind: MarkerKind; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden {...common}>
      {kind === "top" ? (
        <>
          <path d="M5 19 19 5" />
          <path d="M14 4h6v6" />
          <path d="M4 15l5 5" />
        </>
      ) : kind === "jungle" ? (
        <>
          <path d="M7 20c-1.5-5 .5-11 4-15" />
          <path d="M12 21c-1-5 1-11 4-15" />
          <path d="M17 20c-.5-5 1-9 3-12" />
        </>
      ) : kind === "mid" ? (
        <path d="M13 2 5 13h6l-1 9 9-12h-6z" fill="currentColor" stroke="none" />
      ) : kind === "bot" ? (
        <>
          <path d="M4 20 20 4" />
          <path d="M12 4h8v8" />
        </>
      ) : kind === "support" ? (
        <>
          <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />
          <path d="M12 8v8M8 12h8" />
        </>
      ) : kind === "dragon" ? (
        <>
          <path d="M12 21c-4 0-7-3-7-7 0-3 2-5 3-7 0 2 1 3 2 3 0-3 1-6 4-8 0 3 2 5 3 7 1 1 2 3 2 5 0 4-3 7-7 7z" />
        </>
      ) : (
        <>
          <path d="M4 18c2-6 6-10 8-10s6 4 8 10" />
          <path d="M8 18l4-5 4 5" />
          <path d="M9 7l3-4 3 4" />
        </>
      )}
    </svg>
  );
}
