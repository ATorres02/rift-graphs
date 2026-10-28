import { ChampionIcon, type ChampionIconRef } from "@/components/champion-icon";
import { TeamPill } from "@/components/team-pill";
import type { TeamRef } from "@/lib/data/load";
import type { Draft, Side } from "@/lib/data/types";
import { draftSequence } from "@/lib/draft";
import { championLoadingUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

interface DraftBoardProps {
  draft: Draft;
  blue: TeamRef | null;
  red: TeamRef | null;
  icon: (name: string) => ChampionIconRef;
  /** Champions unavailable in this game because they were picked earlier in the series (Fearless). */
  locked: string[];
}

const SIDE_LABEL: Record<Side, string> = { blue: "Blue side", red: "Red side" };

/** Picks and bans per side plus the 20-step draft order. */
export function DraftBoard({ draft, blue, red, icon, locked }: DraftBoardProps) {
  const steps = draftSequence(draft);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {(["blue", "red"] as const).map((side) => {
          const team = side === "blue" ? blue : red;
          const d = draft[side];
          return (
            <div
              key={side}
              className={cn("rounded-xl border p-3", side === "blue" ? "border-side-blue/40" : "border-side-red/40")}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TeamPill team={team} size="sm" />
                  <span className="text-sm font-medium">{team?.name ?? "TBD"}</span>
                </span>
                <span className={cn("text-xs font-medium", side === "blue" ? "text-side-blue" : "text-side-red")}>
                  {SIDE_LABEL[side]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Picks (in pick order)</p>
              <ol className="mt-1 grid grid-cols-5 gap-1.5 sm:gap-2">
                {d.picks.map((c, i) => {
                  const ref = c ? icon(c) : null;
                  return (
                    <li key={i} className="relative">
                      {ref?.ddragonId ? (
                        <span className="block overflow-hidden rounded-lg border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote art, fixed box */}
                          <img
                            src={championLoadingUrl(ref.ddragonId)}
                            alt=""
                            width={308}
                            height={560}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[308/560] w-full object-cover"
                          />
                          <span className="block truncate px-1 py-0.5 text-center text-[10px] font-medium sm:text-[11px]">
                            {c}
                          </span>
                        </span>
                      ) : c && ref ? (
                        <span className="flex aspect-[308/560] flex-col items-center justify-center gap-1 rounded-lg border bg-muted p-1 text-center text-[10px]">
                          <ChampionIcon champion={ref} size="md" />
                          {c}
                        </span>
                      ) : (
                        <span className="block aspect-[308/560] rounded-lg border border-dashed" />
                      )}
                      <span className="absolute -left-1 -top-1 rounded-full bg-background px-1.5 text-[10px] font-semibold tabular ring-1 ring-border">
                        {i + 1}
                      </span>
                      <span className="sr-only">{c ?? "empty"}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">Bans</p>
              <ol className="mt-1 flex flex-wrap gap-2">
                {d.bans.map((c, i) => (
                  <li key={i}>
                    {c ? (
                      <ChampionIcon champion={icon(c)} size="sm" dimmed />
                    ) : (
                      <span className="inline-block size-7 rounded-md border border-dashed" />
                    )}
                    <span className="sr-only">{c ?? "no ban"}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Draft order (1–20): bans dimmed, picks in colour</p>
        <ol className="scroll-x flex gap-1 pb-1">
          {steps.map((s) => (
            <li
              key={s.seq}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 rounded-md border-t-2 px-0.5 pt-1",
                s.side === "blue" ? "border-side-blue" : "border-side-red",
              )}
              title={`${s.seq}. ${s.side} ${s.type}: ${s.champion ?? "–"}`}
            >
              {s.champion ? (
                <ChampionIcon champion={icon(s.champion)} size="sm" dimmed={s.type === "ban"} />
              ) : (
                <span className="inline-block size-7 rounded-md border border-dashed" />
              )}
              <span className="text-[10px] tabular text-muted-foreground">{s.seq}</span>
            </li>
          ))}
        </ol>
      </div>

      {locked.length ? (
        <div className="rounded-xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Fearless draft, unavailable in this game (picked earlier in the series)
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {locked.map((c) => (
              <li key={c}>
                <ChampionIcon champion={icon(c)} size="xs" dimmed />
                <span className="sr-only">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
