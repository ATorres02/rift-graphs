import { TrophyIcon } from "lucide-react";
import { Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import type { WorldsResult } from "@/lib/career-data";
import { placeLabel, type CareerEntry, type CareerTier } from "@/lib/career";
import { cn } from "@/lib/utils";

const TIERS: { tier: CareerTier; label: string; plural: string }[] = [
  { tier: "worlds", label: "World title", plural: "World titles" },
  { tier: "msi", label: "MSI title", plural: "MSI titles" },
  { tier: "first-stand", label: "First Stand", plural: "First Stands" },
  { tier: "ewc", label: "Esports World Cup", plural: "Esports World Cups" },
  { tier: "league", label: "League title", plural: "League titles" },
];

const year = (e: CareerEntry) => e.date.slice(0, 4);

/** A player's or team's trophies, then every official tournament before this one. */
export function CareerSection({
  entries,
  showTeam,
  worlds,
}: {
  entries: CareerEntry[];
  showTeam: boolean;
  /** Worlds 2026 for its finalists: behind the spoiler on both, so the reveal itself gives nothing away. */
  worlds: WorldsResult;
}) {
  if (!entries.length && !worlds) return null;
  const titles = entries.filter((e) => e.title);
  const groups = TIERS.map((t) => ({ ...t, list: titles.filter((e) => e.tier === t.tier) })).filter(
    (g) => g.list.length,
  );
  return (
    <Section
      title="Trophies and history"
      description="Competitions before Worlds 2026: international events, leagues and the Esports World Cup, from Leaguepedia."
    >
      {worlds ? (
        <div className="mb-3">
          <Spoiler
            as="div"
            label="Reveal Worlds 2026 result"
            className="flex items-center gap-3 border border-brand bg-brand-soft p-4"
          >
            <TrophyIcon aria-hidden className="size-8 text-brand" />
            <span className="display text-3xl leading-none font-extrabold sm:text-4xl">
              {worlds === "champion" ? "World champion 2026" : "Runner-up at Worlds 2026"}
            </span>
          </Spoiler>
        </div>
      ) : null}
      {groups.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {groups.map((g) => (
            <div key={g.tier} className={cn("border bg-card p-4", g.tier === "worlds" && "border-brand")}>
              <p className="flex items-center gap-3">
                <TrophyIcon aria-hidden className="size-7 text-brand" />
                <span className="display text-5xl leading-none font-extrabold">{g.list.length}</span>
              </p>
              <p className="kicker mt-2 text-xs text-muted-foreground">{g.list.length === 1 ? g.label : g.plural}</p>
              <p className="mt-2 text-sm">
                {g.tier === "league" ? `${year(g.list.at(-1)!)} to ${year(g.list[0])}` : g.list.map(year).join(", ")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No titles yet in official competitions.</p>
      )}
      <details className="mt-4 border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Full history ({entries.length} {entries.length === 1 ? "competition" : "competitions"})
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 sm:px-4 font-medium">Date</th>
                <th className="px-3 py-2 sm:px-4 font-medium">Competition</th>
                {showTeam ? <th className="px-3 py-2 sm:px-4 font-medium max-sm:hidden">Team</th> : null}
                <th className="px-3 py-2 sm:px-4 text-right font-medium">Place</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={`${e.event}-${e.team}`} className="border-t">
                  <td className="px-3 py-2 sm:px-4 whitespace-nowrap text-muted-foreground">{e.date.slice(0, 7)}</td>
                  <td className="px-3 py-2 sm:px-4">
                    {e.event}
                    {showTeam ? <span className="block text-xs text-muted-foreground sm:hidden">{e.team}</span> : null}
                  </td>
                  {showTeam ? <td className="px-3 py-2 sm:px-4 whitespace-nowrap max-sm:hidden">{e.team}</td> : null}
                  <td
                    className={cn(
                      "px-3 py-2 sm:px-4 text-right whitespace-nowrap",
                      e.title && "font-semibold text-brand",
                    )}
                  >
                    {e.title ? <TrophyIcon aria-label="Title" className="mr-1.5 inline size-3.5" /> : null}
                    {placeLabel(e.place)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Section>
  );
}
