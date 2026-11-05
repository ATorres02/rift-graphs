import { RoleGlyph } from "@/components/rift/role-glyph";
import type { TeamRef } from "@/lib/data/load";
import type { Side } from "@/lib/data/types";
import { clock, goldGraph, goldLabel, type GoldEvent } from "@/lib/gold-graph";
import type { GameTimeline } from "@/lib/sources/livestats";
import { cn } from "@/lib/utils";

const W = 1000;
const H = 200;
const MID = H / 2;

/** Ticks every five minutes, every ten past 45; none too close to the final time, which is labelled itself. */
function minuteTicks(end: number): number[] {
  const every = end > 45 * 60 ? 600 : 300;
  const ticks: number[] = [];
  for (let t = every; t < end - 150; t += every) ticks.push(t);
  return ticks;
}

/** Each side's markers along its own edge; markers close in time stack away from the edge. */
function stacked(events: GoldEvent[], end: number): (GoldEvent & { level: number })[] {
  const last: Record<Side, number[]> = { blue: [], red: [] };
  return events.map((e) => {
    const x = e.t / end;
    const levels = last[e.side];
    // About an icon's width on a phone: closer markers stack.
    let level = levels.findIndex((prev) => x - prev > 0.06);
    if (level === -1) level = levels.length;
    levels[level] = x;
    return { ...e, level };
  });
}

/**
 * Gold difference over a game: blue side's lead above the line, red side's below, from the lolesports live stats
 * feed every 30 seconds of game time, with the dragons and barons each side took along its edge. Static SVG, no
 * script: hovering a stretch shows its time and lead.
 */
export function GoldGraph({
  id,
  timeline,
  blue,
  red,
  duration,
}: {
  id: string;
  timeline: GameTimeline;
  blue: TeamRef | null;
  red: TeamRef | null;
  /** The scoreboard's game length in seconds: the feed's last frame can come a few seconds before the end. */
  duration?: number;
}) {
  const g = goldGraph(timeline);
  const names: Record<Side, string> = { blue: blue?.short ?? "Blue", red: red?.short ?? "Red" };
  const x = (t: number) => (t / g.end) * W;
  const y = (diff: number) => MID - (diff / g.scale) * MID;
  const line = g.points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.diff).toFixed(1)}`).join("");
  const area = `${line}L${W},${MID}L0,${MID}Z`;
  const clip = `gold-${id.replace(/[^a-z0-9-]/gi, "")}`;
  const leads = (["blue", "red"] as const)
    .flatMap((s) => (g.lead[s] ? [{ side: s, ...g.lead[s]! }] : []))
    .sort((a, b) => b.value - a.value);
  const final = g.points[g.points.length - 1].diff;
  const leadText = (s: Side, v: number) => `${names[s]} ${goldLabel(v)}`;
  const summary = leads.length
    ? `Largest lead: ${leads.map((l) => `${leadText(l.side, l.value)} at ${clock(l.t)}`).join(", ")}`
    : "Level all game";
  // Stretches with no frames from the feed (it went quiet while the game went on): drawn straight, shaded.
  const gaps = g.points.slice(1).flatMap((p, i) => {
    const prev = g.points[i];
    return p.t - prev.t > timeline.step * 1.5 && i + 1 < g.points.length - 1 ? [{ from: prev.t, to: p.t }] : [];
  });

  return (
    <figure className="rounded-xl border bg-card p-3 sm:p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="kicker text-xs text-foreground">Gold difference</span>
          {(["blue", "red"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn("inline-block h-2.5 w-3 rounded-sm", s === "blue" ? "bg-side-blue/70" : "bg-side-red/70")}
              />
              {names[s]} ahead
            </span>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">{summary}</span>
        <span className="sr-only">
          {`At the end, ${final === 0 ? "level" : `${names[final > 0 ? "blue" : "red"]} ahead by ${goldLabel(Math.abs(final), false)}`}.`}
        </span>
      </figcaption>
      <div className="flex gap-1.5" aria-hidden>
        <div className="relative h-44 flex-1 sm:h-52">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <defs>
              <clipPath id={`${clip}-up`}>
                <rect x={0} y={0} width={W} height={MID} />
              </clipPath>
              <clipPath id={`${clip}-down`}>
                <rect x={0} y={MID} width={W} height={MID} />
              </clipPath>
            </defs>
            {[H * 0.25, H * 0.75].map((gy) => (
              <line
                key={gy}
                x1={0}
                x2={W}
                y1={gy}
                y2={gy}
                className="stroke-border"
                strokeDasharray="4 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {minuteTicks(g.end).map((t) => (
              <line
                key={t}
                x1={x(t)}
                x2={x(t)}
                y1={0}
                y2={H}
                className="stroke-border/60"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {gaps.map((gap) => (
              <rect
                key={gap.from}
                x={x(gap.from)}
                y={0}
                width={x(gap.to) - x(gap.from)}
                height={H}
                className="fill-muted/70"
              >
                <title>{`No live stats from ${clock(gap.from)} to ${clock(gap.to)}`}</title>
              </rect>
            ))}
            <path d={area} clipPath={`url(#${clip}-up)`} className="fill-side-blue/25" />
            <path d={area} clipPath={`url(#${clip}-down)`} className="fill-side-red/25" />
            <line
              x1={0}
              x2={W}
              y1={MID}
              y2={MID}
              className="stroke-muted-foreground/60"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={line}
              clipPath={`url(#${clip}-up)`}
              className="fill-none stroke-side-blue"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <path
              d={line}
              clipPath={`url(#${clip}-down)`}
              className="fill-none stroke-side-red"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {/* One hover stretch per minute (and the end): enough to read the graph, without hundreds of labels
                in the page's text. */}
            {g.points
              .filter((p, i) => i > 0 && (p.t % 60 === 0 || i === g.points.length - 1))
              .map((p, i, kept) => {
                const from = i ? kept[i - 1].t : 0;
                const lead =
                  p.diff === 0 ? "level" : `${names[p.diff > 0 ? "blue" : "red"]} ${goldLabel(Math.abs(p.diff))}`;
                return (
                  <rect key={p.t} x={x(from)} y={0} width={x(p.t) - x(from)} height={H} className="fill-transparent">
                    <title>{`${clock(p.t)}: ${lead}`}</title>
                  </rect>
                );
              })}
          </svg>

          {stacked(g.events, g.end).map((e, i) => (
            <span
              key={i}
              title={`${e.label}, ${names[e.side]}, ${clock(e.t)}`}
              className={cn(
                "absolute flex -translate-x-1/2 items-center justify-center rounded-full border bg-card p-0.5",
                e.side === "blue" ? "border-side-blue/60" : "border-side-red/60",
                e.kind === "baron" ? "size-5 sm:size-6" : "size-4 sm:size-5",
              )}
              style={{
                left: `${(e.t / g.end) * 100}%`,
                ...(e.side === "blue" ? { top: `${4 + e.level * 22}px` } : { bottom: `${4 + e.level * 22}px` }),
              }}
            >
              <RoleGlyph kind={e.kind} className={e.label === "Elder dragon" ? "size-full" : "size-full opacity-90"} />
            </span>
          ))}
        </div>
        <div className="relative w-7 shrink-0">
          {[
            { top: "0%", label: goldLabel(g.scale) },
            { top: "25%", label: goldLabel(g.scale / 2) },
            { top: "75%", label: goldLabel(g.scale / 2) },
            { top: "100%", label: goldLabel(g.scale) },
          ].map((t, i) => (
            <span
              key={i}
              className={cn(
                "pointer-events-none absolute right-0 text-[10px] tabular text-muted-foreground",
                i === 0 ? "translate-y-0.5" : i === 3 ? "-translate-y-full" : "-translate-y-1/2",
              )}
              style={{ top: t.top }}
            >
              {t.label.replace("+", "")}
            </span>
          ))}
        </div>
      </div>
      <div className="relative mt-1 mr-8.5 h-4 text-[10px] tabular text-muted-foreground" aria-hidden>
        {minuteTicks(g.end).map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / g.end) * 100}%` }}>
            {t / 60}
          </span>
        ))}
        <span className="absolute right-0 translate-x-1/2">{clock(duration ?? g.end)}</span>
      </div>
    </figure>
  );
}
