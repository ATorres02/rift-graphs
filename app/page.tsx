import Link from "next/link";
import { Headlines, type Headline } from "@/components/headlines";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Spoiler, SpoilerToggle } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, teamRef } from "@/lib/data/load";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { aggregateByPlayer, DEFAULT_MIN_GAMES, rankPlayers } from "@/lib/metrics";
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
  const latest = [...series.filter((s) => s.status === "finished")].sort((a, b) => b.dateTimeUtc.localeCompare(a.dateTimeUtc)).slice(0, 6);

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
  const headlines: Headline[] = [
    live.length
      ? { label: "Right now", value: `${live.length} series in progress`, detail: STAGE_LABEL[live[0].stage], href: `/matches/${live[0].id}` }
      : next
        ? {
            label: "Next up",
            value: STAGE_LABEL[next.stage] + (next.round ? ` · Round ${next.round}` : ""),
            detail: <LocalTime iso={next.dateTimeUtc} hasTime={next.hasTime} />,
            href: `/matches/${next.id}`,
          }
        : { label: "Tournament", value: "Completed", detail: tournament.name, href: "/tournament" },
    leaders.kda
      ? { label: "KDA leader", value: fmt.dec(leaders.kda.value, 1), detail: `${playerLabel(data, leaders.kda.playerId)} · ${leaders.kda.aggregate.games} games`, href: `/players/${leaders.kda.playerId}` }
      : { label: "KDA leader", value: "–", detail: `Needs ${DEFAULT_MIN_GAMES}+ games` },
    leaders.dpm
      ? { label: "Damage per minute", value: fmt.int(leaders.dpm.value), detail: `${playerLabel(data, leaders.dpm.playerId)} · ${leaders.dpm.aggregate.games} games`, href: `/players/${leaders.dpm.playerId}` }
      : { label: "Damage per minute", value: "–" },
    leaders.kp
      ? { label: "Kill participation", value: fmt.pct(leaders.kp.value), detail: `${playerLabel(data, leaders.kp.playerId)} · ${leaders.kp.aggregate.games} games`, href: `/players/${leaders.kp.playerId}` }
      : { label: "Kill participation", value: "–" },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand">{tournament.name}</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{site.tagline}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Matches, teams, players, champions and drafts of the 2026 World Championship, refreshed automatically from Leaguepedia. Free, no ads, no logos.
            </p>
          </div>
        </div>
        <Headlines items={headlines} className="lg:grid-cols-4" />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Spoilers:</span> scores and winners are shown by default. Hide them to browse the schedule safely and reveal results one by one.
          </p>
          <SpoilerToggle />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          <Section title="Upcoming series" description="Times shown in your local time zone." action={<Link href="/matches" className="text-sm text-brand underline">All matches</Link>}>
            {upcoming.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((s) => {
                  const v = seriesView(data, s);
                  return <SeriesCard key={s.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} />;
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
            description={`${qualified} qualified · ${eliminated} eliminated · ${mainTeamIds.length - qualified - eliminated} still playing`}
            action={<Link href="/tournament" className="text-sm text-brand underline">Full format</Link>}
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

          <Section title="Build your own chart" description="Pick a measure, group, filter and chart type; share the link." action={<Link href="/charts" className="text-sm text-brand underline">Open the builder</Link>}>
            <ul className="space-y-1.5">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <Link href={`/charts?${serializeConfig(t.config)}`} className="block rounded-lg border bg-card px-3 py-2 text-sm no-underline transition-colors hover:border-brand/60">
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
