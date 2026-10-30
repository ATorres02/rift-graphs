import type { ReactNode } from "react";
import { formatUnit, type Unit } from "@/lib/charts/spec";
import { cn } from "@/lib/utils";

/**
 * Small static charts for the homepage: plain HTML bars and an SVG line, rendered at build time with no chart library
 * and no JavaScript. Labels and values are real text, so the list reads as its own table.
 */

export interface MiniBarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown instead of the formatted value. */
  display?: string;
  color?: string;
  /** Stacked parts of the bar (they should add up to `value`). */
  segments?: { value: number; color: string }[];
}

export function MiniBars({
  rows,
  unit = "number",
  compact = false,
  className,
}: {
  rows: MiniBarRow[];
  unit?: Unit;
  compact?: boolean;
  className?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      {rows.map((r) => (
        <li
          key={r.key}
          className={cn(
            "grid items-center gap-2",
            compact
              ? "grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_auto] text-[11px]"
              : "grid-cols-[minmax(0,6rem)_minmax(0,1fr)_auto] text-xs",
          )}
        >
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span aria-hidden className={cn("flex overflow-hidden rounded-sm bg-muted", compact ? "h-1.5" : "h-2.5")}>
            {(r.segments ?? [{ value: r.value, color: r.color ?? "var(--brand)" }]).map((s, i) => (
              <span
                key={i}
                className="h-full"
                style={{ width: `${(s.value / max) * 100}%`, backgroundColor: s.color }}
              />
            ))}
          </span>
          <span className="text-right font-medium tabular">{r.display ?? formatUnit(r.value, unit)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One line over ordered categories, with a dot per point and the categories under it. */
export function MiniLine({
  points,
  unit = "number",
  className,
}: {
  points: { key: string; label: string; value: number }[];
  unit?: Unit;
  className?: string;
}) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.25 || 1;
  const y = (v: number) => 4 + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * 52;
  const x = (i: number) => (points.length > 1 ? 6 + (i / (points.length - 1)) * 88 : 50);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
  return (
    <figure className={cn("space-y-1", className)}>
      <div className="relative h-28">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <path
            d={`${path} L${x(points.length - 1).toFixed(2)} 60 L${x(0).toFixed(2)} 60 Z`}
            style={{ fill: "var(--brand-soft)" }}
          />
          <path
            d={path}
            style={{ fill: "none", stroke: "var(--brand)" }}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Dots in HTML: SVG circles would stretch with the chart's aspect ratio. */}
        {points.map((p, i) => (
          <span
            key={p.key}
            aria-hidden
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-background"
            style={{ left: `${x(i)}%`, top: `${(y(p.value) / 60) * 100}%` }}
          />
        ))}
      </div>
      <ol className="relative h-8 text-[11px]">
        {points.map((p, i) => (
          <li
            key={p.key}
            className="absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
            style={{ left: `${x(i)}%` }}
          >
            <span className="font-medium tabular">{formatUnit(p.value, unit)}</span>
            <span className="text-muted-foreground">{p.label}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
