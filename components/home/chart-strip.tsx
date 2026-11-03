import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { ChartTypeThumb, MiniBars, MiniLine } from "@/components/charts/mini";
import { Section } from "@/components/page-header";
import { championPresenceChart, chartHref, gameLengthByRoundChart, killsByRegionChart } from "@/lib/charts/page-charts";
import type { IndexedDataset } from "@/lib/data/load";
import { fmt } from "@/lib/format";
import { TEMPLATES } from "@/lib/charts/templates";
import { serializeConfig } from "@/lib/charts/url";
import { runQuery } from "@/lib/query";
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
 * Three small charts on the homepage, drawn at build time from the same queries as the chart builder, and the
 * builder's templates as a row of shortcuts. Only charts that give nothing away about results (no win rates, no
 * scores).
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
      description="The tournament in numbers. Open any chart in the builder to change it or share it."
      action={
        <Link href="/charts" className="text-sm text-brand underline">
          Chart builder
        </Link>
      }
    >
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {cards}
      </div>
      <div>
        <h3 className="kicker text-[11px] text-muted-foreground">Or start from a template</h3>
        <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="shrink-0">
              <Link
                href={`/charts?${serializeConfig(t.config)}`}
                className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-xs font-medium whitespace-nowrap no-underline transition-colors hover:border-brand/60"
              >
                <ChartTypeThumb type={t.config.chart} className="h-6 w-9 rounded-full p-0.5" />
                {t.name}
              </Link>
            </li>
          ))}
          <li className="shrink-0">
            <Link
              href="/compare"
              className="flex h-8 items-center rounded-full border border-dashed bg-card px-3 text-xs font-medium whitespace-nowrap no-underline transition-colors hover:border-brand/60"
            >
              Compare two teams or players
            </Link>
          </li>
        </ul>
      </div>
    </Section>
  );
}
