import type { Metadata } from "next";
import { Headlines, type Headline } from "@/components/headlines";
import { LocalTime } from "@/components/local-time";
import { PageHeader, Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, teamRef } from "@/lib/data/load";
import type { Series, StageId } from "@/lib/data/types";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { SWISS_TARGET, swissGroups, swissStandings } from "@/lib/standings";
import { seriesView } from "@/lib/views";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tournament",
  description: "How the 2026 World Championship works: Play-In, Swiss stage records round by round and the knockout bracket.",
};

export default function TournamentPage() {
  const data = getData();
  const { tournament, series } = data;
  const stage = (id: StageId) => tournament.stages.find((s) => s.id === id);
  const byStage = (id: StageId) => series.filter((s) => s.stage === id);
  const mainTeams = data.teams.filter((t) => t.stages.includes("main"));
  const playinTeams = data.teams.filter((t) => t.stages.includes("playin"));
  const swiss = swissStandings(series, mainTeams.map((t) => t.id));
  const groups = swissGroups(swiss);
  const rounds = Array.from(new Set(byStage("swiss").map((s) => s.round ?? 0))).sort((a, b) => a - b);
  const finishedSwiss = byStage("swiss").filter((s) => s.status === "finished").length;
  const currentRound = rounds.find((r) => byStage("swiss").some((s) => s.round === r && s.status !== "finished"));

  const headlines: Headline[] = [
    { label: "Teams", value: String(data.teams.length), detail: `${playinTeams.length} started in the Play-In, ${mainTeams.length} in the Swiss stage` },
    { label: "Swiss progress", value: `${finishedSwiss} / ${byStage("swiss").length} series`, detail: currentRound ? `Round ${currentRound} next` : "Swiss stage complete" },
    { label: "Final", value: stage("final")?.dateStart ? <LocalTime iso={byStage("final")[0]?.dateTimeUtc ?? `${stage("final")!.dateStart}T00:00:00Z`} mode="date" /> : "–", detail: tournament.country ?? "" },
  ];

  const bracket: { id: StageId; title: string }[] = [
    { id: "quarterfinals", title: "Quarterfinals" },
    { id: "semifinals", title: "Semifinals" },
    { id: "final", title: "Final" },
  ];

  const card = (s: Series) => {
    const v = seriesView(data, s);
    return <SeriesCard key={s.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} compact />;
  };

  return (
    <div className="space-y-10">
      <PageHeader eyebrow={tournament.name} title="Tournament format" description="Three stages, from the Play-In to the final. Dates and formats below come straight from the schedule." />
      <Headlines items={headlines} />

      <Section title="How it works">
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            {
              n: 1,
              title: STAGE_LABEL.playin,
              body: `${playinTeams.length} teams, ${stage("playin")?.seriesCount ?? 0} series, all ${stage("playin")?.bestOf.map((b) => `Bo${b}`).join("/") ?? ""}. The survivors join the main event.`,
              dates: stage("playin"),
            },
            {
              n: 2,
              title: STAGE_LABEL.swiss,
              body: `${mainTeams.length} teams over ${rounds.length} rounds. Teams with the same record play each other; ${SWISS_TARGET} wins qualify, ${SWISS_TARGET} losses eliminate. Decisive matches are best-of-three.`,
              dates: stage("swiss"),
            },
            {
              n: 3,
              title: "Knockout stage",
              body: `${byStage("quarterfinals").length * 2} teams in a single-elimination bracket of best-of-five series: quarterfinals, semifinals and the final.`,
              dates: stage("quarterfinals") ? { ...stage("quarterfinals")!, dateEnd: stage("final")?.dateEnd ?? null } : undefined,
            },
          ].map((step) => (
            <li key={step.n} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step {step.n}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              {step.dates?.dateStart ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {step.dates.dateStart === step.dates.dateEnd ? step.dates.dateStart : `${step.dates.dateStart} → ${step.dates.dateEnd}`}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Swiss stage by record" description="Teams grouped by wins–losses. Each letter is a round: W for a win, L for a loss.">
        <Spoiler as="div" label="Reveal Swiss records">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g.label} className={cn("rounded-xl border bg-card p-3", g.wins >= SWISS_TARGET && "border-brand/60", g.losses >= SWISS_TARGET && "opacity-80")}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg font-semibold tabular">{g.label}</span>
                  <span className="text-xs text-muted-foreground">{g.wins >= SWISS_TARGET ? "Qualified" : g.losses >= SWISS_TARGET ? "Eliminated" : `${g.teams.length} teams`}</span>
                </div>
                <ul className="space-y-1.5">
                  {g.teams.map((r) => (
                    <li key={r.teamId} className="flex items-center justify-between gap-2 text-sm">
                      <TeamPill team={teamRef(data.teamsById.get(r.teamId))} size="sm" withName />
                      <span className="flex gap-1">
                        {r.results.map((res) => (
                          <span key={res.seriesId} className={cn("inline-flex size-5 items-center justify-center rounded text-[10px] font-bold", res.won ? "bg-win/15 text-win" : "bg-loss/15 text-loss")} title={`Round ${res.round}`}>
                            {res.won ? "W" : "L"}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Spoiler>
        <div className="space-y-6 pt-4">
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Round {r}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{byStage("swiss").filter((s) => s.round === r).map(card)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Knockout bracket" description="Best-of-five from the quarterfinals on. Pairings appear as soon as Leaguepedia publishes them.">
        <div className="grid gap-4 lg:grid-cols-3">
          {bracket.map((b) => (
            <div key={b.id} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{b.title}</h3>
              <div className="space-y-3">{byStage(b.id).map(card)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={STAGE_LABEL.playin} description={`${playinTeams.length} teams, ${stage("playin")?.seriesCount ?? 0} best-of-five series.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{byStage("playin").map(card)}</div>
        <p className="text-xs text-muted-foreground">
          Advanced to the main event: {playinTeams.filter((t) => t.stages.includes("main")).map((t) => t.name).join(", ") || "none yet"} ·{" "}
          {fmt.int(playinTeams.length - playinTeams.filter((t) => t.stages.includes("main")).length)} eliminated.
        </p>
      </Section>
    </div>
  );
}
