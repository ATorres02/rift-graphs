import type { Metadata } from "next";
import Link from "next/link";
import { Chart } from "@/components/charts/chart";
import { Headlines, type Headline } from "@/components/headlines";
import { ProvisionalNote } from "@/components/provisional";
import { PageHeader, Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { RegionTag, TeamPill } from "@/components/team-pill";
import type { ScatterSpec } from "@/lib/charts/spec";
import { getData, teamRef } from "@/lib/data/load";
import { REGION_ORDER, regionInfo } from "@/lib/data/regions";
import { fmt } from "@/lib/format";
import { aggregateByTeam, seriesRecord } from "@/lib/metrics";
import { swissStandings, teamStatus, type TeamStatus } from "@/lib/standings";
import { regionColorVar } from "@/lib/views";

export const metadata: Metadata = {
  title: "Teams",
  description:
    "The 19 teams of the 2026 World Championship by region: records, win rates, average game length and whether they are still alive.",
};

const STATUS_LABEL: Record<TeamStatus, string> = { champion: "Champion", alive: "Still in", eliminated: "Eliminated" };

export default function TeamsPage() {
  const data = getData();
  const byTeam = aggregateByTeam(
    data.confirmedGames,
    data.teams.map((t) => t.id),
  );
  const swiss = swissStandings(
    data.series,
    data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id),
  );
  const statuses = new Map(data.teams.map((t) => [t.id, teamStatus(t, data.series, swiss)]));

  const regions = Array.from(new Set(data.teams.map((t) => t.region))).sort((a, b) => {
    const ia = REGION_ORDER.indexOf(a);
    const ib = REGION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const played = data.teams.filter((t) => (byTeam.get(t.id)?.games ?? 0) > 0);
  const best = [...played].sort(
    (a, b) =>
      byTeam.get(b.id)!.winRate - byTeam.get(a.id)!.winRate || byTeam.get(b.id)!.games - byTeam.get(a.id)!.games,
  )[0];
  const fastest = [...played].sort(
    (a, b) => byTeam.get(a.id)!.avgDurationSeconds - byTeam.get(b.id)!.avgDurationSeconds,
  )[0];
  const alive = data.teams.filter((t) => statuses.get(t.id) !== "eliminated").length;
  const avgDuration = data.confirmedGames.length
    ? data.confirmedGames.reduce((a, g) => a + g.durationSeconds, 0) / data.confirmedGames.length
    : 0;

  const headlines: Headline[] = [
    {
      label: "Still in the tournament",
      value: `${alive} of ${data.teams.length}`,
      detail: `${data.teams.length - alive} eliminated`,
      href: "/tournament",
    },
    best
      ? {
          label: "Best game win rate",
          value: fmt.pct(byTeam.get(best.id)!.winRate),
          detail: `${best.name} · ${byTeam.get(best.id)!.wins}–${byTeam.get(best.id)!.losses} in games`,
          href: `/teams/${best.id}`,
        }
      : { label: "Best game win rate", value: "–" },
    fastest
      ? {
          label: "Fastest games",
          value: fmt.duration(byTeam.get(fastest.id)!.avgDurationSeconds),
          detail: `${fastest.name} · tournament average ${fmt.duration(avgDuration)}`,
          href: `/teams/${fastest.id}`,
        }
      : { label: "Fastest games", value: "–" },
  ];

  const scatter: ScatterSpec = {
    type: "scatter",
    xLabel: "Average game length",
    yLabel: "Game win rate",
    xUnit: "seconds",
    yUnit: "percent",
    xReference: avgDuration,
    yReference: 0.5,
    points: played.map((t) => {
      const a = byTeam.get(t.id)!;
      return {
        label: t.short,
        x: a.avgDurationSeconds,
        y: a.winRate,
        color: regionColorVar(t.region),
        group: regionInfo(t.region).code,
      };
    }),
  };
  const scatterTable = {
    columns: ["Team", "Average game length", "Game win rate", "Games"],
    rows: played.map((t) => [
      t.name,
      byTeam.get(t.id)!.avgDurationSeconds,
      byTeam.get(t.id)!.winRate,
      byTeam.get(t.id)!.games,
    ]),
  };
  const topY = scatter.points.reduce((m, p) => (p.y > m.y ? p : m), scatter.points[0]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Teams"
        description="Nineteen teams from six regions. Tags on coloured pills stand in for logos; the colour is the team's region."
      />
      <Headlines items={headlines} />
      <ProvisionalNote meta={data.meta} />

      <Section
        title="Win rate vs. game length"
        description="Each point is a team; colour is the region. Dashed lines mark 50% and the tournament's average game length."
      >
        <Spoiler as="div" label="Reveal chart (contains results)">
          <Chart
            spec={scatter}
            table={scatterTable}
            height={360}
            description={`Scatter plot of ${played.length} teams: game win rate against average game length. Highest win rate: ${topY ? `${topY.label} at ${fmt.pct(topY.y)}` : "none"}.`}
          />
        </Spoiler>
      </Section>

      {regions.map((region) => (
        <Section
          key={region}
          title={
            <span className="flex items-center gap-2">
              {regionInfo(region).code} <RegionTag region={region} className="font-normal" />
            </span>
          }
          description={regionInfo(region).name}
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.teams
              .filter((t) => t.region === region)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => {
                const a = byTeam.get(t.id)!;
                const rec = seriesRecord(data.series, t.id);
                const status = statuses.get(t.id)!;
                return (
                  <li key={t.id} className="rounded-xl border bg-card p-4 transition-colors hover:border-brand/60">
                    <div className="flex items-center justify-between gap-2">
                      <TeamPill team={teamRef(t)} size="lg" withName />
                      <Spoiler label="Status">
                        <span
                          className={
                            status === "eliminated"
                              ? "text-xs font-medium text-muted-foreground"
                              : "text-xs font-medium text-brand"
                          }
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </Spoiler>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Series</dt>
                        <dd className="tabular font-medium">
                          <Spoiler>{fmt.record(rec.wins, rec.losses)}</Spoiler>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Games</dt>
                        <dd className="tabular font-medium">
                          <Spoiler>{fmt.record(a.wins, a.losses)}</Spoiler>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Avg. length</dt>
                        <dd className="tabular font-medium">{a.games ? fmt.duration(a.avgDurationSeconds) : "–"}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t.location ?? regionInfo(t.region).name} ·{" "}
                      <Link href={`/teams/${t.id}`} className="underline hover:text-foreground">
                        Team page
                      </Link>
                    </p>
                  </li>
                );
              })}
          </ul>
        </Section>
      ))}
    </div>
  );
}
