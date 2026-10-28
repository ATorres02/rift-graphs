"use client";

import { InfoIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function relative(iso: string, now: number): string {
  const diffMin = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const UPDATE_EXPLANATION =
  "Results are published within minutes of each game (from lolesports.com or typed by hand) and carry a Provisional tag. Detailed stats arrive when Leaguepedia volunteers publish the scoreboard, usually the same day; rankings and the chart builder only use confirmed games.";

/** "Updated 12 min ago", recomputed every minute from meta.json's timestamp, with a short explanation on demand. */
export function UpdatedAgo({ updatedAt, className }: { updatedAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const label =
    now === null
      ? "Updated " + updatedAt.slice(0, 16).replace("T", " ") + " UTC"
      : `Updated ${relative(updatedAt, now)}`;
  return (
    <span
      ref={ref}
      className={cn(
        "relative inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />
      <span title={`Data last updated ${updatedAt.replace("T", " ").replace("Z", " UTC")}`}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="How updates work"
        title={UPDATE_EXPLANATION}
        className="rounded-full p-0.5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          role="note"
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover p-3 text-left text-xs leading-relaxed text-popover-foreground shadow-md"
        >
          {UPDATE_EXPLANATION}
        </span>
      ) : null}
    </span>
  );
}
