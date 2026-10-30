import type { ReactNode } from "react";
import { formatUnit, type Unit } from "@/lib/charts/spec";
import type { ChartType } from "@/lib/query";
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

const A = { fill: "var(--viz-1)" };
const B = { fill: "var(--viz-2)" };
const GRID = { fill: "none", stroke: "var(--viz-grid)" };

/** The shape of each chart type, drawn small (48 × 32) in the first two palette colours. */
const THUMBS: Record<ChartType, ReactNode> = {
  bar: (
    <>
      {[40, 33, 27, 22].map((w, i) => (
        <rect key={i} x={4} y={4 + i * 6.5} width={w} height={4} rx={1} style={A} />
      ))}
      <path d="M30 2v28" style={{ ...GRID, stroke: "var(--muted-foreground)" }} strokeDasharray="2 2" />
    </>
  ),
  groupedBar: (
    <>
      {[
        [12, 18],
        [20, 10],
        [16, 22],
      ].map(([a, b], i) => (
        <g key={i}>
          <rect x={5 + i * 14} y={30 - a} width={5} height={a} rx={1} style={A} />
          <rect x={11 + i * 14} y={30 - b} width={5} height={b} rx={1} style={B} />
        </g>
      ))}
    </>
  ),
  stackedBar: (
    <>
      {[
        [14, 26],
        [10, 24],
        [16, 14],
        [8, 18],
      ].map(([a, b], i) => (
        <g key={i}>
          <rect x={4} y={4 + i * 6.5} width={a} height={4} rx={1} style={A} />
          <rect x={4 + a + 1} y={4 + i * 6.5} width={b} height={4} rx={1} style={B} />
        </g>
      ))}
    </>
  ),
  line: (
    <>
      <path d="M4 24L15 12L26 15L37 7L44 10" style={{ fill: "none", stroke: "var(--viz-1)" }} strokeWidth={2} />
      {[
        [4, 24],
        [15, 12],
        [26, 15],
        [37, 7],
        [44, 10],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} style={A} />
      ))}
    </>
  ),
  scatter: (
    <>
      <path d="M4 2v26h42" style={GRID} />
      {[
        [10, 22],
        [14, 18],
        [18, 20],
        [22, 14],
        [26, 16],
        [30, 11],
        [34, 12],
        [38, 7],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} style={A} />
      ))}
      <circle cx={42} cy={4} r={2.4} style={B} />
    </>
  ),
  radar: (
    <>
      <path d="M24 2L37 9.5V24.5L24 30L11 24.5V9.5Z" style={GRID} />
      <path d="M24 9L31 12.5V21L24 26L15 22.5V12Z" style={GRID} />
      <path
        d="M24 4L34 11V23L24 27L14 21V13Z"
        style={{ fill: "var(--viz-1)", fillOpacity: 0.25, stroke: "var(--viz-1)" }}
        strokeWidth={1.5}
      />
      <path
        d="M24 8L36 10V20L24 29L12 24V11Z"
        style={{ fill: "var(--viz-2)", fillOpacity: 0.2, stroke: "var(--viz-2)" }}
        strokeWidth={1.5}
      />
    </>
  ),
  heatmap: (
    <>
      {[0.9, 0.5, 0.2, 0.6, 0.3, 0.8, 0.4, 1, 0.15, 0.7, 0.35, 0.55].map((o, i) => (
        <rect
          key={i}
          x={4 + (i % 4) * 10.5}
          y={3 + Math.floor(i / 4) * 9}
          width={9.5}
          height={8}
          rx={1}
          style={{ ...A, fillOpacity: o }}
        />
      ))}
    </>
  ),
  boxplot: (
    <>
      {[
        [8, 16, 24, 28],
        [4, 10, 18, 24],
        [10, 14, 20, 30],
        [6, 12, 16, 22],
      ].map(([lo, q1, q3, hi], i) => {
        const x = 8 + i * 11;
        return (
          <g key={i} style={{ stroke: "var(--viz-1)" }} strokeWidth={1.5}>
            <path d={`M${x} ${lo}V${q1}M${x} ${q3}V${hi}`} />
            <rect
              x={x - 3.5}
              y={q1}
              width={7}
              height={q3 - q1}
              rx={1}
              style={{ fill: "var(--viz-1)", fillOpacity: 0.25 }}
            />
          </g>
        );
      })}
    </>
  ),
};

/** A small drawing of a chart type (for template lists), not real data. */
export function ChartTypeThumb({ type, className }: { type: ChartType; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      aria-hidden
      className={cn("h-10 w-14 shrink-0 rounded-md border bg-background p-1", className)}
    >
      {THUMBS[type]}
    </svg>
  );
}
