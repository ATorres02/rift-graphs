import Link from "next/link";
import { Headlines, type Headline } from "@/components/headlines";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/page-header";
import { Rift3D, type RiftLeader, type RiftObjective } from "@/components/rift/rift-3d";
import { SeriesCard } from "@/components/series-card";
import { Spoiler, SpoilerToggle } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { championRef, getData, teamRef } from "@/lib/data/load";
import { championLoadingUrl, championSplashUrl } from "@/lib/sources/ddragon";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { aggregateByPlayer, aggregateChampions, DEFAULT_MIN_GAMES, rankPlayers, ROLES } from "@/lib/metrics";
import { site } from "@/lib/site";
import { swissGroups, swissStandings } from "@/lib/standings";
import { TEMPLATES } from "@/lib/charts/templates";
import { serializeConfig } from "@/lib/charts/url";
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
  const groups = swissGroups(swiss);
  const qualified = swiss.filter((r) => r.status === "qualified").length;
  const eliminated = swiss.filter((r) => r.status === "eliminated").length;

  const byPlayer = aggregateByPlayer(data.playerGames);
  const leaders = {
    kda: rankPlayers(byPlayer, (a) => a.kda, { limit: 1 })[0],
    dpm: rankPlayers(byPlayer, (a) => a.dpm, { limit: 1 })[0],
    kp: rankPlayers(byPlayer, (a) => a.killParticipation, { limit: 1 })[0],
  };

  const next = upcoming[0];

  // The Rift: KDA leader per role (minimum games threshold, relaxed when nobody reaches it) and objective control per team.
  const riftLeaders: RiftLeader[] = ROLES.flatMap((role) => {
    const ids = new Set(data.players.filter((p) => p.role === role).map((p) => p.id));
    const pool = new Map(Array.from(byPlayer).filter(([id]) => ids.has(id)));
    const top =
      rankPlayers(pool, (a) => a.kda, { limit: 1 })[0] ?? rankPlayers(pool, (a) => a.kda, { minGames: 1, limit: 1 })[0];
    if (!top) return [];
    const player = data.playersById.get(top.playerId);
    const team = player ? data.teamsById.get(player.teamId) : undefined;
    const champs = new Map<string, number>();
    for (const r of data.playerGamesByPlayer.get(top.playerId) ?? [])
      champs.set(r.champion, (champs.get(r.champion) ?? 0) + 1);
    const champion = Array.from(champs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return [
      {
        role,
        playerId: top.playerId,
        name: player?.name ?? top.playerId,
        teamShort: team?.short ?? "",
        teamId: team?.id ?? "",
        champion,
        ddragonId: champion ? (championRef(data, champion)?.id ?? null) : null,
        stat: `KDA ${fmt.dec(top.value, 1)}`,
        statLabel: "KDA",
        games: top.aggregate.games,
      },
    ];
  });
  const control = (key: "dragons" | "barons"): RiftObjective => {
    const taken = new Map<string, { own: number; all: number }>();
    for (const g of data.confirmedGames) {
      const total = g.blue[key] + g.red[key];
      for (const side of ["blue", "red"] as const) {
        const t = taken.get(g[side].teamId) ?? { own: 0, all: 0 };
        t.own += g[side][key];
        t.all += total;
        taken.set(g[side].teamId, t);
      }
    }
    const best = Array.from(taken)
      .filter(([, v]) => v.all >= 3)
      .map(([id, v]) => ({ id, share: v.own / v.all, own: v.own, all: v.all }))
      .sort((a, b) => b.share - a.share || b.own - a.own)[0];
    const team = best ? data.teamsById.get(best.id) : undefined;
    return {
      kind: key === "dragons" ? "dragon" : "baron",
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      stat: best ? fmt.pct(best.share) : "",
      statLabel: best ? `of the ${key} in its games (${best.own} of ${best.all})` : "",
    };
  };
  const riftObjectives = [control("dragons"), control("barons")];
  const mostPicked = aggregateChampions(data.confirmedGames, data.playerGames)
    .filter((c) => c.picks > 0)
    .sort((a, b) => b.picks - a.picks)[0];
  const mostPickedRef = mostPicked ? championRef(data, mostPicked.champion) : null;
  const heroArt = mostPickedRef
    ? {
        name: mostPickedRef.name,
        splash: championSplashUrl(mostPickedRef.id),
        portrait: championLoadingUrl(mostPickedRef.id),
      }
    : null;
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
        }
      : { label: "KDA leader", value: "–", detail: `Needs ${DEFAULT_MIN_GAMES}+ games` },
    leaders.dpm
      ? {
          label: "Damage per minute",
          value: fmt.int(leaders.dpm.value),
          detail: `${playerLabel(data, leaders.dpm.playerId)}, ${leaders.dpm.aggregate.games} games`,
          href: `/players/${leaders.dpm.playerId}`,
        }
      : { label: "Damage per minute", value: "–" },
    leaders.kp
      ? {
          label: "Kill participation",
          value: fmt.pct(leaders.kp.value),
          detail: `${playerLabel(data, leaders.kp.playerId)}, ${leaders.kp.aggregate.games} games`,
          href: `/players/${leaders.kp.playerId}`,
        }
      : { label: "Kill participation", value: "–" },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="relative -mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-md">
          {heroArt ? (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-3/5">
              <picture>
                <source media="(max-width: 640px)" srcSet={heroArt.portrait} />
                {/* eslint-disable-next-line @next/next/no-img-element -- remote splash art, decorative; phones get the 55 KB portrait */}
                <img
                  src={heroArt.splash}
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
              every game. Free, no ads, no logos.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/matches"
                className="cut-corner bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground no-underline hover:brightness-110"
              >
                Schedule and results
              </Link>
              <Link
                href="/charts"
                className="cut-corner border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white no-underline backdrop-blur hover:bg-white/10"
              >
                Build a chart
              </Link>
            </div>
            {heroArt ? (
              <p className="kicker mt-6 text-[10px] text-zinc-500">
                {heroArt.name}, most picked champion of the tournament
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

      <Section
        title="Pick your lane"
        description="The Rift, role by role: tap a position to see who leads it so far, or Dragon and Baron for the teams that control them."
      >
        <Rift3D leaders={riftLeaders} objectives={riftObjectives} />
      </Section>

      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
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
            title="Swiss Stage"
            description={`${qualified} qualified, ${eliminated} eliminated, ${mainTeamIds.length - qualified - eliminated} still playing`}
            action={
              <Link href="/tournament" className="text-sm text-brand underline">
                Full format
              </Link>
            }
          >
            <Spoiler as="div" label="Reveal standings">
              <ol className="space-y-2">
                {groups.map((g) => (
                  <li key={g.label} className="rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="tabular text-sm font-semibold text-foreground">{g.label}</span>
                      <span>
                        {g.wins >= 3 ? "Qualified" : g.losses >= 3 ? "Eliminated" : `${g.teams.length} teams`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.teams.map((r) => (
                        <TeamPill key={r.teamId} team={teamRef(data.teamsById.get(r.teamId))} size="sm" />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </Spoiler>
          </Section>

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
                    className="block rounded-lg border bg-card px-3 py-2 text-sm no-underline transition-colors hover:border-brand/60"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">{t.description}</span>
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
