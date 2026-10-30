import Link from "next/link";
import { Headlines, type Headline } from "@/components/headlines";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { KnockoutBracket } from "@/components/bracket/knockout-bracket";
import { SwissBracket } from "@/components/bracket/swiss-bracket";
import { SpoilerToggle } from "@/components/spoilers";
import { homeBracket } from "@/lib/bracket";
import { getData } from "@/lib/data/load";
import { heroArt, heroChampion } from "@/lib/hero-art";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { aggregateByPlayer, DEFAULT_MIN_GAMES, rankPlayers } from "@/lib/metrics";
import { site } from "@/lib/site";
import { swissStandings } from "@/lib/standings";
import { TEMPLATES } from "@/lib/charts/templates";
import { serializeConfig } from "@/lib/charts/url";
import { chartHref, playerRankingChart } from "@/lib/charts/page-charts";
import { BuildChartButton } from "@/components/home/build-chart-button";
import { ChartStrip } from "@/components/home/chart-strip";
import { ChartTypeThumb } from "@/components/charts/mini";
import { playerLabel, seriesView } from "@/lib/views";

export default function HomePage() {
  const data = getData();
  const { series, tournament } = data;

  const upcoming = series.filter((s) => s.status !== "finished").slice(0, 6);
  const live = series.filter((s) => s.status === "live");
  const latest = [...series.filter((s) => s.status === "finished")]
    .sort((a, b) => b.dateTimeUtc.localeCompare(a.dateTimeUtc))
    .slice(0, 6);

  const mainTeamIds = data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id);
  const swiss = swissStandings(series, mainTeamIds);
  const qualified = swiss.filter((r) => r.status === "qualified").length;
  const eliminated = swiss.filter((r) => r.status === "eliminated").length;

  const byPlayer = aggregateByPlayer(data.playerGames);
  const top5 = {
    kda: rankPlayers(byPlayer, (a) => a.kda, { limit: 5 }),
    dpm: rankPlayers(byPlayer, (a) => a.dpm, { limit: 5 }),
    kp: rankPlayers(byPlayer, (a) => a.killParticipation, { limit: 5 }),
  };
  const leaders = { kda: top5.kda[0], dpm: top5.dpm[0], kp: top5.kp[0] };
  // Top 5 under each leader tile, linked to the same ranking (top 10) in the chart builder.
  const ranking = (
    rows: (typeof top5)["kda"],
    format: (v: number) => string,
    measure: "kda" | "dpm" | "kp",
    label: string,
  ) => ({
    rows: rows.map((r) => ({
      key: r.playerId,
      label: data.playersById.get(r.playerId)?.name ?? r.playerId,
      value: r.value,
      display: format(r.value),
    })),
    href: chartHref(playerRankingChart(measure, label)),
  });

  const next = upcoming[0];

  const heroPick = heroChampion(data);
  const art = heroPick ? heroArt(heroPick) : null;
  const headlines: Headline[] = [
    live.length
      ? {
          label: "Right now",
          value: `${live.length} series in progress`,
          detail: STAGE_LABEL[live[0].stage],
          href: `/matches/${live[0].id}`,
        }
      : next
        ? {
            label: "Next up",
            value: STAGE_LABEL[next.stage] + (next.round ? ` / Round ${next.round}` : ""),
            detail: <LocalTime iso={next.dateTimeUtc} hasTime={next.hasTime} />,
            href: `/matches/${next.id}`,
          }
        : { label: "Tournament", value: "Completed", detail: tournament.name, href: "/tournament" },
    leaders.kda
      ? {
          label: "KDA leader",
          value: fmt.dec(leaders.kda.value, 1),
          detail: `${playerLabel(data, leaders.kda.playerId)}, ${leaders.kda.aggregate.games} games`,
          href: `/players/${leaders.kda.playerId}`,
          ranking: ranking(top5.kda, (v) => fmt.dec(v, 1), "kda", "KDA"),
        }
      : { label: "KDA leader", value: "–", detail: `Needs ${DEFAULT_MIN_GAMES}+ games` },
    leaders.dpm
      ? {
          label: "Damage per minute",
          value: fmt.int(leaders.dpm.value),
          detail: `${playerLabel(data, leaders.dpm.playerId)}, ${leaders.dpm.aggregate.games} games`,
          href: `/players/${leaders.dpm.playerId}`,
          ranking: ranking(top5.dpm, (v) => fmt.int(v), "dpm", "damage per minute"),
        }
      : { label: "Damage per minute", value: "–" },
    leaders.kp
      ? {
          label: "Kill participation",
          value: fmt.pct(leaders.kp.value),
          detail: `${playerLabel(data, leaders.kp.playerId)}, ${leaders.kp.aggregate.games} games`,
          href: `/players/${leaders.kp.playerId}`,
          ranking: ranking(top5.kp, (v) => fmt.pct(v), "kp", "kill participation"),
        }
      : { label: "Kill participation", value: "–" },
  ];

  // WebSite markup: search engines read the site name shown in results from it.
  const sameAs = [site.author.linkedin, site.author.x].filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: `${site.url}/`,
    description: site.description,
    inLanguage: "en",
    author: { "@type": "Person", name: site.author.name, ...(sameAs.length ? { sameAs } : {}) },
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="space-y-4">
        <div className="relative -mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-md">
          {art ? (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-3/5">
              <picture>
                <source media="(max-width: 640px)" srcSet={art.portrait} />
                <img
                  src={art.splash}
                  alt=""
                  width={1215}
                  height={717}
                  fetchPriority="high"
                  decoding="async"
                  className="size-full object-cover object-[70%_20%] opacity-80"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10 sm:via-black/40" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            </div>
          ) : null}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand" />
          <div className="relative flex min-h-[380px] flex-col justify-end p-5 sm:min-h-[460px] sm:p-10">
            <p className="kicker text-xs text-brand sm:text-sm">
              {tournament.name}
              {next ? ` / ${STAGE_LABEL[next.stage]}${next.round ? ` / Round ${next.round}` : ""}` : ""}
            </p>
            <h1 className="display mt-2 max-w-3xl text-5xl font-extrabold text-white sm:text-7xl lg:text-8xl">
              {site.tagline}
            </h1>
            <p className="mt-4 max-w-xl text-sm text-zinc-300 sm:text-base">
              Matches, teams, players, champions and drafts of the 2026 World Championship, refreshed within minutes of
              every game. Free, no ads.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/matches"
                className="cut-corner border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white no-underline backdrop-blur hover:bg-white/10"
              >
                Schedule and results
              </Link>
              <BuildChartButton />
            </div>
            {art ? (
              <p className="kicker mt-6 text-[10px] text-zinc-500">
                {art.name}, most picked champion of the tournament
              </p>
            ) : null}
          </div>
        </div>
        <Headlines items={headlines} className="lg:grid-cols-4" />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Spoilers:</span> scores and winners are shown by default. Hide
            them to browse the schedule safely and reveal results one by one.
          </p>
          <SpoilerToggle />
        </div>
      </section>

      {homeBracket(series) === "knockout" ? (
        <Section
          title="Knockout stage"
          description="Quarterfinals, semifinals and the final, all best of five."
          action={
            <Link href="/tournament" className="text-sm text-brand underline">
              Full format
            </Link>
          }
        >
          <KnockoutBracket data={data} />
        </Section>
      ) : (
        <Section
          title="Swiss Stage"
          description={`${qualified} qualified, ${eliminated} eliminated, ${mainTeamIds.length - qualified - eliminated} still playing. Every series links to its page.`}
          action={
            <Link href="/tournament" className="text-sm text-brand underline">
              Full format
            </Link>
          }
        >
          <SwissBracket data={data} />
        </Section>
      )}

      <ChartStrip data={data} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <Section
            title="Upcoming series"
            description="Times shown in your local time zone."
            action={
              <Link href="/matches" className="text-sm text-brand underline">
                All matches
              </Link>
            }
          >
            {upcoming.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((s) => {
                  const v = seriesView(data, s);
                  return (
                    <SeriesCard key={s.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No series left on the schedule.</p>
            )}
          </Section>

          <Section title="Latest results">
            <div className="grid gap-3 sm:grid-cols-2">
              {latest.map((s) => {
                const v = seriesView(data, s);
                return <SeriesCard key={s.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} />;
              })}
            </div>
          </Section>
        </div>

        <aside className="space-y-10">
          <Section
            title="Build your own chart"
            description="Pick a measure, group, filter and chart type; share the link."
            action={
              <Link href="/charts" className="text-sm text-brand underline">
                Open the builder
              </Link>
            }
          >
            <ul className="space-y-1.5">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/charts?${serializeConfig(t.config)}`}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm no-underline transition-colors hover:border-brand/60"
                  >
                    <ChartTypeThumb type={t.config.chart} />
                    <span>
                      <span className="font-medium">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Or compare two teams or players head to head on the{" "}
              <Link href="/compare" className="underline hover:text-foreground">
                comparison page
              </Link>
              .
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
