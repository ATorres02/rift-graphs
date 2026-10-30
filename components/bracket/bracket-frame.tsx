"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronsRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal position of `child` inside the scrolling element `el`. */
const offsetIn = (el: HTMLElement, child: HTMLElement) =>
  child.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;

/**
 * Client shell of a bracket: horizontal scrolling with the current column in view, edge fades, and the round by round
 * reveal used while spoilers are hidden. The columns are server markup; CSS from `bracketCss` hides whatever needs a
 * step not yet listed in `data-revealed`, so nothing flashes before hydration.
 */
export function BracketFrame({
  steps,
  label,
  children,
  className,
}: {
  /** Number of reveal steps (rounds or stages with results). */
  steps: number;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: true });
  const scroller = useRef<HTMLDivElement>(null);
  const focusAfterReveal = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // With spoilers hidden the bracket stays at its start, where the first reveal button is.
    const current = el.querySelector<HTMLElement>("[data-current]");
    const hidden = document.documentElement.dataset.spoilers === "hidden";
    if (current && !hidden && el.scrollWidth > el.clientWidth) {
      // Phones fit about two columns: the current one goes first. Wider screens centre it.
      const narrow = el.clientWidth < current.offsetWidth * 2.5;
      el.scrollLeft = narrow
        ? offsetIn(el, current)
        : offsetIn(el, current) - (el.clientWidth - current.offsetWidth) / 2;
    }
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!focusAfterReveal.current || !el) return;
    focusAfterReveal.current = false;
    // Bring the column just revealed to the front (on phones) and move focus to its title.
    const column = el.querySelector<HTMLElement>(`[data-gate="${revealed}"]`);
    if (!column) return;
    const left = offsetIn(el, column);
    if (left < el.scrollLeft || left + column.offsetWidth > el.scrollLeft + el.clientWidth) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    }
    column.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  }, [revealed]);

  return (
    <div
      role="region"
      aria-label={label}
      data-bracket=""
      data-revealed={Array.from({ length: revealed }, (_, i) => i + 1).join(" ")}
      data-next={revealed < steps ? revealed + 1 : undefined}
      className={cn("relative", className)}
      onClick={(e) => {
        if (!(e.target as Element).closest("[data-reveal]")) return;
        focusAfterReveal.current = true;
        setRevealed((r) => Math.min(r + 1, steps));
      }}
    >
      <div ref={scroller} className="scroll-x snap-x snap-mandatory pb-2">
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background transition-opacity",
          edges.start && "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background transition-opacity",
          edges.end && "opacity-0",
        )}
      />
      {edges.end ? null : (
        <span
          aria-hidden
          className="kicker pointer-events-none absolute right-0 top-0.5 inline-flex items-center gap-0.5 rounded-sm bg-brand px-1.5 py-1 text-[10px] text-brand-foreground sm:hidden"
        >
          Swipe <ChevronsRightIcon className="size-3" />
        </span>
      )}
    </div>
  );
}
