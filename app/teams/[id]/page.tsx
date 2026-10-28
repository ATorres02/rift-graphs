import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChampionIcon } from "@/components/champion-icon";
import { Chart } from "@/components/charts/chart";
import { Headlines, type Headline } from "@/components/headlines";
import { PageHeader, Section } from "@/components/page-header";
import { SeriesCard } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { RegionTag, TeamPill } from "@/components/team-pill";
import type { BarSpec, RadarSpec } from "@/lib/charts/spec";
import { getData, teamRef } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import { fmt, ROLE_LABEL, STAGE_LABEL } from "@/lib/format";
import { aggregateByTeam, aggregateTeamGames, seriesRecord, type TeamAggregate } from "@/lib/metrics";
import { swissStandings, teamStatus } from "@/lib/standings";
import { champIcon, mostPlayedArt, seriesView } from "@/lib/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return getData().teams.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = getData().teamsById.get(id);
  if (!t) return {};
  return {
    title: `${t.name} (${t.short})`,
    description: `${t.name}'s 2026 World Championship: roster, record, blue/red side performance, objectives, most played champions and every series.`,
  };
}

const RADAR_METRICS: { key: keyof TeamAggregate; name: string }[] = [
  { key: "winRate", name: "Win rate" },
  { key: "killsPerGame", name: "Kills / game" },
  { key: "goldPerMinute", name: "Gold / min" },
  { key: "towersPerGame", name: "Towers / game" },
  { key: "dragonControl", name: "Dragon control" },
  { key: "baronControl", name: "Baron control" },
];

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const team = data.teamsById.get(id);
  if (!team) notFound();

  const agg = aggregateTeamGames(data.confirmedGames, team.id);
  const all = aggregateByTeam(
    data.confirmedGames,
    data.teams.map((t) => t.id),
  );
  const played = Array.from(all.values()).filter((a) => a.games > 0);
  const avg = (key: keyof TeamAggregate) => {
    const vals = played.map((a) => a[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const max = (key: keyof TeamAggregate) =>
    Math.max(...played.map((a) => (typeof a[key] === "number" ? (a[key] as number) : 0)), 0.0001);
  const rec = seriesRecord(data.series, team.id);
  const swiss = swissStandings(
    data.series,
    data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id),
  );
  const status = teamStatus(team, data.series, swiss);
  const swissRec = swiss.find((r) => r.teamId === team.id);

  const roster = team.roster.map((r) => ({ ...r, player: data.playersById.get(r.playerId) })).filter((r) => r.player);
  const teamSeries = (data.seriesByTeam.get(team.id) ?? []).map((s) => seriesView(data, s));
  const champUsage = new Map<string, { games: number; wins: number }>();
  for (const pg of data.playerGamesByTeam.get(team.id) ?? []) {
    const c = champUsage.get(pg.champion) ?? { games: 0, wins: 0 };
    c.games += 1;
    if (pg.win) c.wins += 1;
    champUsage.set(pg.champion, c);
  }
  const topChamps = Array.from(champUsage, ([champion, c]) => ({ champion, ...c }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.champion.localeCompare(b.champion))
    .slice(0, 10);

  const radar: RadarSpec = {
    type: "radar",
    indicators: RADAR_METRICS.map((m) => ({ name: m.name, max: max(m.key) })),
    series: [
      {
        name: team.short,
        values: RADAR_METRICS.map((m) => (typeof agg[m.key] === "number" ? (agg[m.key] as number) : 0)),
        color: `var(${regionInfo(team.region).cssVar})`,
      },
      { name: "Tournament average", values: RADAR_METRICS.map((m) => avg(m.key)) },
    ],
  };
  const radarTable = {
    columns: ["Metric", team.short, "Tournament average"],
    rows: RADAR_METRICS.map((m, i) => [m.name, radar.series[0].values[i], radar.series[1].values[i]]),
  };

  const champBar: BarSpec = {
    type: "bar",
    horizontal: true,
    stacked: true,
    categories: topChamps.map((c) => c.champion),
    series: [
      { name: "Wins", values: topChamps.map((c) => c.wins), color: "var(--win)" },
      { name: "Losses", values: topChamps.map((c) => c.games - c.wins), color: "var(--loss)" },
    ],
  };

  const headlines: Headline[] = [
    {
      label: "Game record",
      value: <Spoiler>{fmt.record(agg.wins, agg.losses)}</Spoiler>,
      detail: agg.games ? `${fmt.pct(agg.winRate)} win rate · ${agg.games} games` : "No games yet",
    },
    {
      label: "Series record",
      value: <Spoiler>{fmt.record(rec.wins, rec.losses)}</Spoiler>,
      detail: swissRec ? `Swiss ${swissRec.wins}–${swissRec.losses} · ${swissRec.status}` : STAGE_LABEL.playin,
    },
    {
      label: "Average game length",
      value: agg.games ? fmt.duration(agg.avgDurationSeconds) : "–",
      detail: `Tournament average ${fmt.duration(avg("avgDurationSeconds"))}`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        art={mostPlayedArt(data, data.playerGamesByTeam.get(team.id) ?? [])}
        eyebrow={<RegionTag region={team.region} />}
        title={
          <span className="flex items-center gap-3">
            <TeamPill team={teamRef(team)} size="lg" link={false} />
            {team.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3">
            <span>{team.location ?? regionInfo(team.region).name}</span>
            <span>·</span>
            <span>{team.stages.map((s) => (s === "playin" ? "Play-In" : "Main Event")).join(" + ")}</span>
            <span>·</span>
            <Spoiler label="Status">
              <span className={status === "eliminated" ? "" : "text-brand"}>
                {status === "champion"
                  ? "World champion"
                  : status === "alive"
                    ? "Still in the tournament"
                    : "Eliminated"}
              </span>
            </Spoiler>
          </span>
        }
      />
      <Headlines items={headlines} />

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <Section
          title="Profile vs. tournament average"
          description="Six team metrics scaled to the best value in the tournament."
        >
          <Spoiler as="div" label="Reveal chart (contains results)">
            <Chart
              spec={radar}
              table={radarTable}
              height={340}
              description={`Radar chart comparing ${team.name} with the tournament average on win rate, kills per game, gold per minute, towers per game, dragon control and baron control.`}
            />
          </Spoiler>
        </Section>
        <Section title="Roster">
          <ul className="divide-y rounded-xl border bg-card">
            {roster.map(({ player, role }) => (
              <li key={player!.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium uppercase text-muted-foreground">{ROLE_LABEL[role]}</span>
                  <Link href={`/players/${player!.id}`} className="font-medium hover:text-brand">
                    {player!.name}
                  </Link>
                </span>
                <span className="text-xs text-muted-foreground">{player!.country ?? ""}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section
        title="Side and objectives"
        description="Per game, from Leaguepedia scoreboards. First blood and first objective timings are not available in the source."
      >
        <Spoiler as="div" label="Reveal (contains results)">
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Blue side",
                value: `${fmt.record(agg.blue.wins, agg.blue.games - agg.blue.wins)}`,
                detail: fmt.pct(agg.blue.winRate),
              },
              {
                label: "Red side",
                value: `${fmt.record(agg.red.wins, agg.red.games - agg.red.wins)}`,
                detail: fmt.pct(agg.red.winRate),
              },
              {
                label: "Kills / game",
                value: fmt.dec(agg.killsPerGame, 1),
                detail: `${fmt.dec(agg.deathsPerGame, 1)} deaths`,
              },
              {
                label: "Dragons / game",
                value: fmt.dec(agg.dragonsPerGame, 1),
                detail: `${fmt.pct(agg.dragonControl)} control`,
              },
              {
                label: "Barons / game",
                value: fmt.dec(agg.baronsPerGame, 2),
                detail: `${fmt.pct(agg.baronControl)} control`,
              },
              {
                label: "Towers / game",
                value: fmt.dec(agg.towersPerGame, 1),
                detail: `${fmt.dec(agg.heraldsPerGame, 1)} heralds · ${fmt.dec(agg.voidGrubsPerGame, 1)} grubs`,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border bg-card p-3">
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className="text-lg font-semibold tabular">{m.value}</dd>
                <dd className="text-xs text-muted-foreground">{m.detail}</dd>
              </div>
            ))}
          </dl>
        </Spoiler>
      </Section>

      {topChamps.length ? (
        <Section title="Most played champions" description="Games and wins across the whole roster.">
          <Spoiler as="div" label="Reveal chart (contains results)">
            <Chart
              spec={champBar}
              table={{
                columns: ["Champion", "Wins", "Losses"],
                rows: topChamps.map((c) => [c.champion, c.wins, c.games - c.wins]),
              }}
              height={Math.max(220, topChamps.length * 32)}
              description={`Stacked bars of ${team.name}'s ten most played champions; ${topChamps[0].champion} leads with ${topChamps[0].games} games.`}
            />
          </Spoiler>
          <ul className="flex flex-wrap gap-2">
            {topChamps.map((c) => (
              <li key={c.champion} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
                <ChampionIcon champion={champIcon(data, c.champion)} size="xs" />
                {c.champion} <span className="tabular text-muted-foreground">×{c.games}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Series" description="Every series, latest first.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[...teamSeries].reverse().map((v) => (
            <SeriesCard key={v.series.id} series={v.series} team1={v.team1} team2={v.team2} pending={v.pending} />
          ))}
        </div>
      </Section>
    </div>
  );
}
