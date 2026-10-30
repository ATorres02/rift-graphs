import type { Metadata } from "next";
import { KnockoutBracket } from "@/components/bracket/knockout-bracket";
import { SwissBracket } from "@/components/bracket/swiss-bracket";
import { Headlines, type Headline } from "@/components/headlines";
import { LocalTime } from "@/components/local-time";
import { ProvisionalNote } from "@/components/provisional";
import { PageHeader, Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, teamRef } from "@/lib/data/load";
import type { Series, StageId } from "@/lib/data/types";
import { dateRange, STAGE_LABEL } from "@/lib/format";
import { SWISS_TARGET, swissStandings } from "@/lib/standings";
import { seriesView } from "@/lib/views";

export const metadata: Metadata = {
  title: "Tournament",
  description:
    "How the 2026 World Championship works: Play-In, the Swiss stage bracket round by round and the knockout bracket.",
};

const KNOCKOUT: { id: StageId; title: string }[] = [
  { id: "quarterfinals", title: "Quarterfinals" },
  { id: "semifinals", title: "Semifinals" },
  { id: "final", title: "Final" },
];

export default function TournamentPage() {
  const data = getData();
  const { tournament, series } = data;
  const stage = (id: StageId) => tournament.stages.find((s) => s.id === id);
  const byStage = (id: StageId) => series.filter((s) => s.stage === id);
  const dates = (id: StageId) => dateRange(stage(id)?.dateStart ?? null, stage(id)?.dateEnd ?? null);

  const mainTeams = data.teams.filter((t) => t.stages.includes("main"));
  const playinTeams = data.teams.filter((t) => t.stages.includes("playin"));
  const advanced = playinTeams.filter((t) => t.stages.includes("main"));
  const playinOut = playinTeams.filter((t) => !t.stages.includes("main"));

  const swiss = swissStandings(
    series,
    mainTeams.map((t) => t.id),
  );
  const swissOut = swiss.filter((r) => r.losses >= SWISS_TARGET).length;
  const swissSeries = byStage("swiss");
  const rounds = Array.from(new Set(swissSeries.map((s) => s.round ?? 0))).sort((a, b) => b - a);
  const finishedSwiss = swissSeries.filter((s) => s.status === "finished").length;
  const currentRound = [...rounds]
    .reverse()
    .find((r) => swissSeries.some((s) => s.round === r && s.status !== "finished"));

  const knockout = KNOCKOUT.flatMap((b) => byStage(b.id));
  // Every finished knockout series sends one team home.
  const knockoutOut = knockout.filter((s) => s.status === "finished" && s.winnerId).length;
  const bracketSeries = [...byStage("quarterfinals"), ...byStage("semifinals")];
  const bracketPlayed = bracketSeries.filter((s) => s.status === "finished").length;
  const finalSeries = byStage("final")[0];
  const remaining = data.teams.length - playinOut.length - swissOut - knockoutOut;

  const headlines: Headline[] = [
    {
      label: "Teams remaining",
      value: String(remaining),
      detail: `of ${data.teams.length}: ${[
        `${playinOut.length} out in the Play-In`,
        swissOut ? `${swissOut} in the Swiss stage` : null,
        knockoutOut ? `${knockoutOut} in the knockouts` : null,
      ]
        .filter(Boolean)
        .join(", ")}`,
    },
    {
      label: "Swiss progress",
      value: `${finishedSwiss} / ${swissSeries.length} series`,
      detail: currentRound ? `Round ${currentRound} next` : "Swiss stage complete",
    },
    {
      label: "Knockout stage",
      value: dateRange(stage("quarterfinals")?.dateStart ?? null, stage("semifinals")?.dateEnd ?? null),
      detail: bracketPlayed
        ? `${bracketPlayed} / ${bracketSeries.length} series played`
        : `${byStage("quarterfinals").length * 2} teams, quarterfinals and semifinals, best of five`,
    },
    {
      label: "Final",
      value: finalSeries ? (
        <LocalTime iso={finalSeries.dateTimeUtc} mode="date" hasTime={finalSeries.hasTime} />
      ) : (
        dates("final")
      ),
      detail: finalSeries ? (
        <>
          {tournament.country ? `${tournament.country}, ` : ""}
          <LocalTime iso={finalSeries.dateTimeUtc} mode="time" hasTime={finalSeries.hasTime} /> in your time zone
        </>
      ) : (
        (tournament.country ?? "")
      ),
    },
  ];

  const steps = [
    {
      title: STAGE_LABEL.playin,
      body: `${playinTeams.length} teams, ${stage("playin")?.seriesCount ?? 0} series, all ${
        stage("playin")
          ?.bestOf.map((b) => `Bo${b}`)
          .join("/") ?? ""
      }. The survivors join the main event.`,
      when: dates("playin"),
    },
    {
      title: STAGE_LABEL.swiss,
      body: `${mainTeams.length} teams over ${rounds.length} rounds. Teams with the same record play each other; ${SWISS_TARGET} wins qualify, ${SWISS_TARGET} losses eliminate. Decisive matches are best-of-three.`,
      when: dates("swiss"),
    },
    {
      title: "Knockout stage",
      body: `${byStage("quarterfinals").length * 2} teams in a single-elimination bracket of best-of-five series: quarterfinals and semifinals.`,
      when: dateRange(stage("quarterfinals")?.dateStart ?? null, stage("semifinals")?.dateEnd ?? null),
    },
    {
      title: "Final",
      body: "One best-of-five series for the title.",
      when: finalSeries ? (
        <>
          <LocalTime iso={finalSeries.dateTimeUtc} mode="datetime" hasTime={finalSeries.hasTime} />
          {tournament.country ? `, ${tournament.country}` : ""}
        </>
      ) : (
        dates("final")
      ),
    },
  ];

  const card = (s: Series, emphasis: "bold" | "strong" = "bold") => {
    const v = seriesView(data, s);
    return (
      <SeriesCard
        key={s.id}
        series={v.series}
        team1={v.team1}
        team2={v.team2}
        pending={v.pending}
        emphasis={emphasis}
        compact
      />
    );
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={tournament.name}
        title="Tournament format"
        description="Three stages, from the Play-In to the final. Dates and formats below come straight from the schedule."
      />
      <Headlines items={headlines} className="lg:grid-cols-4" />
      <ProvisionalNote meta={data.meta} />

      <Section
        collapsible
        title="Swiss bracket"
        description="Teams with the same record meet each round. Point at a team to follow its path; every series links to its page."
      >
        <SwissBracket data={data} />
      </Section>

      <Section collapsible title="Knockout bracket" description="Best-of-five from the quarterfinals on.">
        {knockout.length ? (
          <KnockoutBracket data={data} />
        ) : (
          <div className="rounded-xl border border-dashed bg-card/60 p-5">
            <p className="kicker text-xs text-brand">Coming soon</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              The bracket is drawn here, connectors and all, as soon as the quarterfinal pairings are known after the
              last Swiss round{stage("swiss")?.dateEnd ? ` on ${dateRange(stage("swiss")!.dateEnd, null)}` : ""}.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {KNOCKOUT.map((b) => (
                <div key={b.id} className="rounded-lg border bg-card p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.title}</dt>
                  <dd className="mt-1 font-medium">{dates(b.id)}</dd>
                  <dd className="text-xs text-muted-foreground">{byStage(b.id).length} series, best of five</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Section>

      <Section
        collapsible
        title={STAGE_LABEL.playin}
        description={`${playinTeams.length} teams, ${stage("playin")?.seriesCount ?? 0} best-of-five series.`}
      >
        <Spoiler as="div" label="Reveal who advanced">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-brand/60 bg-brand-soft p-4 sm:p-5">
            <div className="flex items-center gap-3">
              {advanced.map((t) => (
                <TeamPill key={t.id} team={teamRef(t)} size="lg" />
              ))}
              <div>
                <p className="kicker text-xs text-brand">Advanced to the main event</p>
                <p className="display text-2xl font-bold sm:text-3xl">
                  {advanced.length ? advanced.map((t) => t.name).join(", ") : "Nobody yet"}
                </p>
              </div>
            </div>
            {playinOut.length ? (
              <p className="text-sm text-muted-foreground sm:ml-auto">
                {playinOut.length} eliminated: {playinOut.map((t) => t.name).join(", ")}
              </p>
            ) : null}
          </div>
        </Spoiler>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byStage("playin").map((s) => card(s, "strong"))}
        </div>
      </Section>

      <Section collapsible defaultOpen={false} title="How it works" description="Format and dates of each stage.">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{step.when}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
