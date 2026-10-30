import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { MiniBars, MiniLine } from "@/components/charts/mini";
import { Section } from "@/components/page-header";
import { championPresenceChart, chartHref, gameLengthByRoundChart, killsByRegionChart } from "@/lib/charts/page-charts";
import type { IndexedDataset } from "@/lib/data/load";
import { fmt } from "@/lib/format";
import { MEASURES, runQuery } from "@/lib/query";
import { cn } from "@/lib/utils";

/** Phones swipe through the cards (as through the bracket); wider screens lay them out in a grid. */
const CARD = "w-[82%] shrink-0 snap-start rounded-xl border sm:w-auto";

function ChartCard({
  href,
  insight,
  caption,
  children,
}: {
  href: string;
  insight: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(CARD, "group relative flex flex-col gap-3 bg-card p-4 transition-colors hover:border-brand/60")}
    >
      <div>
        <p className="kicker text-[11px] text-brand">{caption}</p>
        <h3 className="mt-1 text-sm font-semibold text-balance">{insight}</h3>
      </div>
      <div className="flex-1">{children}</div>
      <div className="flex justify-end border-t pt-2 text-xs text-muted-foreground">
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 font-medium no-underline transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-foreground"
          aria-label={`Open in Charts: ${caption}`}
        >
          Open in Charts <ArrowUpRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/**
 * Three small charts on the homepage, drawn at build time from the same queries as the chart builder, and a way into
 * it. Only charts that give nothing away about results (no win rates, no scores).
 */
export function ChartStrip({ data }: { data: IndexedDataset }) {
  const cards: ReactNode[] = [];

  const presenceConfig = championPresenceChart();
  const presence = runQuery({ ...presenceConfig, topN: 6 }, data);
  if (presence.rows.length) {
    const share = (r: (typeof presence.rows)[number]) =>
      ((r.values.picks ?? 0) + (r.values.bans ?? 0)) / Math.max(presence.universeGames, 1);
    const top = presence.rows[0];
    cards.push(
      <ChartCard
        key="presence"
        href={chartHref(presenceConfig)}
        insight={`${top.label} is picked or banned in ${fmt.pct(share(top))} of games`}
        caption="Most present champions"
      >
        <MiniBars
          rows={presence.rows.map((r) => ({
            key: r.key,
            label: r.label,
            value: (r.values.picks ?? 0) + (r.values.bans ?? 0),
            display: fmt.pct(share(r)),
            segments: [
              { value: r.values.picks ?? 0, color: "var(--viz-1)" },
              { value: r.values.bans ?? 0, color: "var(--viz-2)" },
            ],
          }))}
        />
        <p className="mt-2 flex gap-3 text-[11px] text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--viz-1)" }} /> Picks
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--viz-2)" }} /> Bans
          </span>
        </p>
      </ChartCard>,
    );
  }

  const lengthConfig = gameLengthByRoundChart();
  const length = runQuery(lengthConfig, data);
  if (length.rows.length) {
    const points = length.rows.map((r) => ({
      key: r.key,
      label: r.label.replace("Swiss ", ""),
      value: r.values.duration ?? 0,
    }));
    const longest = points.reduce((a, p) => (p.value > a.value ? p : a));
    const insight =
      points.length < 2
        ? `Swiss games last ${fmt.duration(longest.value)} on average`
        : `Round ${longest.label.replace("R", "")} had the longest Swiss games, ${fmt.duration(longest.value)} on average`;
    cards.push(
      <ChartCard key="length" href={chartHref(lengthConfig)} insight={insight} caption="Average game length by round">
        <MiniLine points={points} unit="seconds" />
      </ChartCard>,
    );
  }

  const killsConfig = killsByRegionChart();
  const kills = runQuery(killsConfig, data);
  if (kills.rows.length > 1) {
    const top = kills.rows[0];
    const bottom = kills.rows[kills.rows.length - 1];
    cards.push(
      <ChartCard
        key="kills"
        href={chartHref(killsConfig)}
        insight={`${top.label} teams kill the most, ${fmt.dec(top.values.kills ?? 0, 1)} per game; ${bottom.label} the least, ${fmt.dec(bottom.values.kills ?? 0, 1)}`}
        caption="Kills per game by region"
      >
        <MiniBars
          rows={kills.rows.map((r) => ({
            key: r.key,
            label: r.label,
            value: r.values.kills ?? 0,
            display: fmt.dec(r.values.kills ?? 0, 1),
            color: r.color ?? undefined,
          }))}
        />
      </ChartCard>,
    );
  }

  return (
    <Section
      title="Charts"
      description="The tournament in numbers, drawn. Open any chart in the builder to change it or share it."
      action={
        <Link href="/charts" className="text-sm text-brand underline">
          Chart builder
        </Link>
      }
    >
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {cards}
        <article className={cn(CARD, "flex flex-col justify-between gap-4 border-brand/50 bg-brand-soft p-4")}>
          <div>
            <p className="kicker text-xs text-brand">Build your own</p>
            <p className="display mt-1 text-2xl font-bold">Any stat, any chart</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {MEASURES.length} measures for players, teams, champions and games, eight chart types, filters by stage,
              team, role or champion. Every chart is a link you can share.
            </p>
          </div>
          <Link
            href="/charts"
            className="cut-corner self-start bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground no-underline hover:brightness-110"
          >
            Build a chart
          </Link>
        </article>
      </div>
    </Section>
  );
}
