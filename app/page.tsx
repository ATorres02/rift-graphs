import Link from "next/link";
import { jsonLdHtml } from "@/lib/jsonld";
import { Section } from "@/components/page-header";
import { KnockoutBracket } from "@/components/bracket/knockout-bracket";
import { SwissBracket } from "@/components/bracket/swiss-bracket";
import { homeBracket } from "@/lib/bracket";
import { getData } from "@/lib/data/load";
import { heroArt, heroChampion } from "@/lib/hero-art";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { aggregateByPlayer, DEFAULT_MIN_GAMES, rankPlayers } from "@/lib/metrics";
import { showsPreview } from "@/lib/preview";
import { latestUpdate } from "@/lib/updates";
import { site } from "@/lib/site";
import { swissStandings } from "@/lib/standings";
import { chartHref, playerRankingChart } from "@/lib/charts/page-charts";
import { BuildChartButton } from "@/components/home/build-chart-button";
import { ChartStrip } from "@/components/home/chart-strip";
import { Leaders, type LeaderBoard } from "@/components/home/leaders";
import { LatestUpdate } from "@/components/home/latest-update";
import { NextMatch } from "@/components/home/next-match";
import { playerLabel, seriesView } from "@/lib/views";

export default function HomePage() {
  const data = getData();
  const { series, tournament } = data;

  const upcoming = series.filter((s) => s.status !== "finished");
  const live = series.filter((s) => s.status === "live");
  // The series to watch: the one in progress, else the next on the schedule.
  const next = live[0] ?? upcoming[0];
  const nextView = next ? seriesView(data, next) : null;

  const mainTeamIds = data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id);
  const swiss = swissStandings(series, mainTeamIds);
  const qualified = swiss.filter((r) => r.status === "qualified").length;
  const eliminated = swiss.filter((r) => r.status === "eliminated").length;

  // Leaders: a top 5 per measure, each linked to the same ranking (top 10) in the chart builder.
  const byPlayer = aggregateByPlayer(data.playerGames);
  const board = (
    key: "kda" | "dpm" | "kp",
    label: string,
    short: string,
    chartLabel: string,
    get: Parameters<typeof rankPlayers>[1],
    format: (v: number) => string,
  ): LeaderBoard[] => {
    const top = rankPlayers(byPlayer, get, { limit: 5 });
    if (!top.length) return [];
    return [
      {
        key,
        label,
        short,
        value: format(top[0].value),
        detail: `${playerLabel(data, top[0].playerId)}, ${top[0].aggregate.games} games`,
        playerHref: `/players/${top[0].playerId}`,
        rows: top.map((r) => ({
          key: r.playerId,
          label: data.playersById.get(r.playerId)?.name ?? r.playerId,
          value: r.value,
          display: format(r.value),
        })),
        chartHref: chartHref(playerRankingChart(key, chartLabel)),
      },
    ];
  };
  const boards = [
    ...board(
      "kda",
      "KDA",
      "KDA",
      "KDA",
      (a) => a.kda,
      (v) => fmt.dec(v, 1),
    ),
    ...board(
      "dpm",
      "Damage per minute",
      "Damage/min",
      "damage per minute",
      (a) => a.dpm,
      (v) => fmt.int(v),
    ),
    ...board(
      "kp",
      "Kill participation",
      "Participation",
      "kill participation",
      (a) => a.killParticipation,
      (v) => fmt.pct(v),
    ),
  ];

  // The newest site update hangs under the hero for a week after it went live (the site is rebuilt every game).
  const update = latestUpdate();

  const heroPick = heroChampion(data);
  const art = heroPick ? heroArt(heroPick) : null;

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

  const links = (
    <div className="flex gap-4 text-sm">
      <Link href="/matches" className="text-brand underline">
        All matches
      </Link>
      <Link href="/tournament" className="text-brand underline">
        Full format
      </Link>
    </div>
  );

  return (
    <div className="space-y-14 sm:space-y-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <div>
        <section
          className={`relative -mx-4 overflow-hidden bg-black sm:mx-0 ${update ? "sm:rounded-t-md" : "sm:rounded-md"}`}
        >
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
          <div className="relative flex flex-col justify-end p-5 pt-14 sm:min-h-[460px] sm:p-10">
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
            <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
              {next && nextView ? (
                <NextMatch
                  series={next}
                  team1={nextView.team1}
                  team2={nextView.team2}
                  preview={
                    !!(nextView.team1 && nextView.team2) &&
                    showsPreview(next, data.gamesBySeries.get(next.id)?.length ?? 0)
                  }
                />
              ) : null}
              <BuildChartButton />
            </div>
            {art ? (
              <p className="kicker mt-6 text-[10px] text-zinc-500">
                {art.name}, most picked champion of the tournament
              </p>
            ) : null}
          </div>
        </section>
        {update ? <LatestUpdate update={update} /> : null}
      </div>

      {homeBracket(series) === "knockout" ? (
        <Section
          title="Knockout stage"
          description="Quarterfinals, semifinals and the final, all best of five. Every series links to its page."
          action={links}
        >
          <KnockoutBracket data={data} />
        </Section>
      ) : (
        <Section
          title="Swiss Stage"
          description={`${qualified} qualified, ${eliminated} eliminated, ${mainTeamIds.length - qualified - eliminated} still playing. Every series links to its page.`}
          action={links}
        >
          <SwissBracket data={data} />
        </Section>
      )}

      {boards.length ? (
        <div className="bg-muted/40 py-10 shadow-[0_0_0_100vmax_color-mix(in_oklab,var(--muted)_40%,transparent)] [clip-path:inset(0_-100vmax)]">
          <Section
            title="Leaders"
            description={`Players with ${DEFAULT_MIN_GAMES} games or more.`}
            action={
              <Link href="/players" className="text-sm text-brand underline">
                All players
              </Link>
            }
          >
            <Leaders boards={boards} />
          </Section>
        </div>
      ) : null}

      <ChartStrip data={data} />
    </div>
  );
}
