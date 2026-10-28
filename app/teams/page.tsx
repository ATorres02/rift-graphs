import type { Metadata } from "next";
import { Chart } from "@/components/charts/chart";
import { Headlines, type Headline } from "@/components/headlines";
import { ProvisionalNote } from "@/components/provisional";
import { PageHeader, Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { TeamsExplorer, type RegionPanel } from "@/components/teams/world-map";
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
          detail: `${best.name}, ${byTeam.get(best.id)!.wins}–${byTeam.get(best.id)!.losses} in games`,
          href: `/teams/${best.id}`,
        }
      : { label: "Best game win rate", value: "–" },
    fastest
      ? {
          label: "Fastest games",
          value: fmt.duration(byTeam.get(fastest.id)!.avgDurationSeconds),
          detail: `${fastest.name}, tournament average ${fmt.duration(avgDuration)}`,
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

  const swissById = new Map(swiss.map((r) => [r.teamId, r]));
  const panels: RegionPanel[] = regions.map((region) => {
    const info = regionInfo(region);
    return {
      code: info.code,
      name: info.name,
      cssVar: info.cssVar,
      teams: data.teams
        .filter((t) => t.region === region)
        .sort((a, b) => (a.seed?.seed ?? 99) - (b.seed?.seed ?? 99) || a.name.localeCompare(b.name))
        .map((t) => {
          const a = byTeam.get(t.id)!;
          const rec = seriesRecord(data.series, t.id);
          const sw = swissById.get(t.id);
          const status = statuses.get(t.id)!;
          return {
            team: teamRef(t)!,
            status,
            statusLabel: STATUS_LABEL[status],
            swiss: sw ? { wins: sw.wins, losses: sw.losses, status: sw.status } : null,
            series: { wins: rec.wins, losses: rec.losses },
            games: { wins: a.wins, losses: a.losses },
            roster: t.roster.map((r) => ({
              playerId: r.playerId,
              name: data.playersById.get(r.playerId)?.name ?? r.playerId,
              role: r.role,
            })),
            coaches: t.coaches,
            seed: t.seed,
            location: t.location,
          };
        }),
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Teams"
        description="Nineteen teams from six regions. Tags on coloured pills stand in for logos; the colour is the team's region."
      />
      <Headlines items={headlines} />
      <ProvisionalNote meta={data.meta} />

      <Section
        title="Where they come from"
        description="The countries of each league, coloured by region. Tap a region on the map or a chip to see its teams, rosters, coaches and seeds."
      >
        <TeamsExplorer regions={panels} />
      </Section>

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
    </div>
  );
}
