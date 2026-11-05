import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { ChampionIcon } from "@/components/champion-icon";
import { Section } from "@/components/page-header";
import { RoleGlyph } from "@/components/rift/role-glyph";
import { getData } from "@/lib/data/load";
import type { Series } from "@/lib/data/types";
import { duelHref, laneDuel } from "@/lib/duels";
import { ROLE_LABEL } from "@/lib/format";
import { ROLES } from "@/lib/metrics";
import { champIcon } from "@/lib/views";

/**
 * The five lane duels of a knockout series once its preview is gone (in progress or played): a compact row of links,
 * each with both players and their most played champion. Spoiler-safe: duels only use games from before the series.
 */
export function DuelStrip({ series }: { series: Series }) {
  const data = getData();
  const duels = ROLES.flatMap((role) => {
    const d = laneDuel(data, series, role);
    return d?.a && d.b ? [{ ...d, a: d.a, b: d.b }] : [];
  });
  if (!duels.length) return null;
  return (
    <Section
      title="Lane duels"
      description="Each lane as it stood before the series: the numbers both players brought into it."
    >
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
        {duels.map((d) => {
          const ca = d.a.player.champions[0];
          const cb = d.b.player.champions[0];
          return (
            <li key={d.role} className="w-[46%] shrink-0 snap-start sm:w-auto">
              <Link
                href={duelHref(series.id, d.role)}
                aria-label={`${ROLE_LABEL[d.role]} duel: ${d.a.player.name} vs ${d.b.player.name}`}
                className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-3 no-underline transition-colors hover:border-brand"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="kicker flex items-center gap-1.5 text-[11px] text-brand">
                    <RoleGlyph kind={d.role} className="size-3.5" />
                    {ROLE_LABEL[d.role]}
                  </span>
                  <ArrowRightIcon
                    aria-hidden
                    className="size-4 text-muted-foreground motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </span>
                <span className="flex items-center gap-2">
                  {ca ? <ChampionIcon champion={champIcon(data, ca.champion)} size="xs" /> : null}
                  <span className="min-w-0 truncate text-sm font-semibold">{d.a.player.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  {cb ? <ChampionIcon champion={champIcon(data, cb.champion)} size="xs" /> : null}
                  <span className="min-w-0 truncate text-sm font-semibold">{d.b.player.name}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
