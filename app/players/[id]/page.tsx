import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChampionIcon } from "@/components/champion-icon";
import { Chart } from "@/components/charts/chart";
import { DataTable, type TableColumn } from "@/components/data-table";
import { Headlines, type Headline } from "@/components/headlines";
import { PageHeader, Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import type { BarSpec, LineSpec } from "@/lib/charts/spec";
import { getData, teamRef } from "@/lib/data/load";
import { fmt, ROLE_LABEL, STAGE_SHORT } from "@/lib/format";
import { aggregatePlayerGames, kda, killParticipation, perMinute } from "@/lib/metrics";
import { champIcon, mostPlayedArt } from "@/lib/views";
import { chartHref, championRecordChart, playerGamesChart } from "@/lib/charts/page-charts";

export const dynamicParams = false;

export function generateStaticParams() {
  return getData().players.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = getData();
  const p = data.playersById.get(id);
  if (!p) return {};
  const team = data.teamsById.get(p.teamId);
  return {
    title: `${p.name}${team ? ` (${team.short})` : ""}`,
    description: `${p.name}'s 2026 World Championship: KDA, kill participation, CS, damage and gold per minute, champion pool and game-by-game numbers.`,
  };
}

const GAME_COLUMNS: TableColumn[] = [
  { key: "game", header: "Game", kind: "link" },
  { key: "opponent", header: "vs", kind: "team" },
  { key: "champion", header: "Champion", kind: "champion" },
  { key: "result", header: "Result", kind: "result" },
  { key: "kills", header: "K", kind: "int" },
  { key: "deaths", header: "D", kind: "int" },
  { key: "assists", header: "A", kind: "int" },
  { key: "kda", header: "KDA", kind: "dec1" },
  { key: "kp", header: "KP", kind: "pct" },
  { key: "cs", header: "CS", kind: "int" },
  { key: "cspm", header: "CSPM", kind: "dec1" },
  { key: "gold", header: "Gold", kind: "int" },
  { key: "dpm", header: "DPM", kind: "int" },
  { key: "vision", header: "Vision", kind: "int" },
  { key: "duration", header: "Length", kind: "duration" },
];

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const p = data.playersById.get(id);
  if (!p) notFound();
  const team = data.teamsById.get(p.teamId);
  const rows = [...(data.playerGamesByPlayer.get(p.id) ?? [])].sort((a, b) => {
    const ga = data.gamesById.get(a.gameId);
    const gb = data.gamesById.get(b.gameId);
    return (
      (ga?.dateTimeUtc ?? "").localeCompare(gb?.dateTimeUtc ?? "") || (ga?.gameNumber ?? 0) - (gb?.gameNumber ?? 0)
    );
  });
  const agg = aggregatePlayerGames(rows);
  // Supports are judged by vision rather than damage, in the big tile and in the game-by-game line.
  const support = p.role === "support";
  const visionPerGame = agg.games ? rows.reduce((a, r) => a + r.visionScore, 0) / agg.games : 0;

  const headlines: Headline[] = [
    {
      label: "KDA",
      value: agg.games ? fmt.dec(agg.kda, 1) : "–",
      detail: agg.games
        ? `${fmt.dec(agg.avgKills, 1)} / ${fmt.dec(agg.avgDeaths, 1)} / ${fmt.dec(agg.avgAssists, 1)} per game`
        : "No games yet",
    },
    {
      label: "Kill participation",
      value: fmt.pct(agg.killParticipation),
      detail: agg.games ? `${agg.games} games` : "No games yet",
    },
    support
      ? {
          label: "Vision score",
          value: agg.games ? fmt.dec(visionPerGame, 1) : "–",
          detail: `per game, ${fmt.dec(agg.visionPerMinute, 2)} per minute`,
        }
      : {
          label: "Damage per minute",
          value: agg.games ? fmt.int(agg.dpm) : "–",
          detail: `${fmt.pct(agg.damageShare)} of team damage`,
        },
    {
      label: "Gold per minute",
      value: agg.games ? fmt.int(agg.gpm) : "–",
      detail: `${fmt.dec(agg.cspm, 1)} CSPM, ${fmt.pct(agg.goldShare)} of team gold`,
    },
  ];

  const gameLabel = (gameId: string) => {
    const g = data.gamesById.get(gameId);
    const s = g ? data.seriesById.get(g.seriesId) : undefined;
    if (!g || !s) return gameId;
    const opp = data.teamsById.get(g.blue.teamId === p.teamId ? g.red.teamId : g.blue.teamId);
    return `${STAGE_SHORT[s.stage]}${s.round ? ` R${s.round}` : ""} G${g.gameNumber} vs ${opp?.short ?? "?"}`;
  };

  const line = (name: string, values: number[], unit: LineSpec["unit"], ref: number): LineSpec => ({
    type: "line",
    categories: rows.map((r) => gameLabel(r.gameId)),
    series: [{ name, values }],
    unit,
    reference: { value: ref, label: "Average" },
  });
  const dpmLine = support
    ? line(
        "Vision score",
        rows.map((r) => r.visionScore),
        "number",
        Math.round(visionPerGame),
      )
    : line(
        "Damage per minute",
        rows.map((r) => Math.round(perMinute(r.damageToChampions, r.durationSeconds))),
        "number",
        Math.round(agg.dpm),
      );
  const kdaLine = line(
    "KDA",
    rows.map((r) => Number(kda(r.kills, r.deaths, r.assists).toFixed(1))),
    "decimal1",
    Number(agg.kda.toFixed(1)),
  );

  const champBar: BarSpec = {
    type: "bar",
    horizontal: true,
    stacked: true,
    categories: agg.champions.map((c) => c.champion),
    series: [
      { name: "Wins", values: agg.champions.map((c) => c.wins), color: "var(--win)" },
      { name: "Losses", values: agg.champions.map((c) => c.games - c.wins), color: "var(--loss)" },
    ],
  };

  const tableRows = rows.map((r) => {
    const g = data.gamesById.get(r.gameId);
    return {
      game: { href: `/matches/${r.seriesId}`, label: gameLabel(r.gameId) },
      opponent: teamRef(data.teamsById.get(r.opponentTeamId)),
      champion: champIcon(data, r.champion),
      result: r.win ? "W" : "L",
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      kda: kda(r.kills, r.deaths, r.assists),
      kp: killParticipation(r.kills, r.assists, r.teamKills),
      cs: r.cs,
      cspm: perMinute(r.cs, r.durationSeconds),
      gold: r.gold,
      dpm: perMinute(r.damageToChampions, r.durationSeconds),
      vision: r.visionScore,
      duration: g?.durationSeconds ?? r.durationSeconds,
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        art={mostPlayedArt(data, data.playerGamesByPlayer.get(p.id) ?? [])}
        eyebrow={ROLE_LABEL[p.role]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.name}
            <TeamPill team={teamRef(team)} size="md" />
          </span>
        }
        description={[p.realName, p.nativeName, p.country].filter(Boolean).join(", ") || undefined}
      >
        <Link
          href={`/compare?type=players&a=${p.id}`}
          className="cut-corner inline-block bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground no-underline hover:brightness-110"
        >
          Compare
        </Link>
      </PageHeader>
      <Headlines items={headlines} className="lg:grid-cols-4" />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Games", value: String(agg.games) },
          { label: "Record", value: <Spoiler>{fmt.record(agg.wins, agg.games - agg.wins)}</Spoiler> },
          { label: "Win rate", value: <Spoiler>{fmt.pct(agg.winRate)}</Spoiler> },
          { label: "Gold share", value: fmt.pct(agg.goldShare) },
          { label: "Vision / min", value: fmt.dec(agg.visionPerMinute, 2) },
          { label: "Pentakills", value: String(agg.pentakills) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{m.label}</dt>
            <dd className="text-lg font-semibold tabular">{m.value}</dd>
          </div>
        ))}
      </dl>

      {rows.length ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={support ? "Vision score, game by game" : "Damage per minute, game by game"}>
              <Chart
                builderHref={chartHref(
                  support
                    ? playerGamesChart(p.id, p.name, "vision", "vision score")
                    : playerGamesChart(p.id, p.name, "dpm", "damage per minute"),
                )}
                spec={dpmLine}
                table={{
                  columns: ["Game", support ? "Vision score" : "DPM"],
                  rows: rows.map((r, i) => [dpmLine.categories[i], dpmLine.series[0].values[i]]),
                }}
                height={260}
                description={
                  support
                    ? `Line of ${p.name}'s vision score over ${rows.length} games; average ${fmt.dec(visionPerGame, 1)}.`
                    : `Line of ${p.name}'s damage per minute over ${rows.length} games; average ${fmt.int(agg.dpm)}.`
                }
              />
            </Section>
            <Section title="KDA, game by game">
              <Chart
                builderHref={chartHref(playerGamesChart(p.id, p.name, "kda", "KDA"))}
                spec={kdaLine}
                table={{
                  columns: ["Game", "KDA"],
                  rows: rows.map((r, i) => [kdaLine.categories[i], kdaLine.series[0].values[i]]),
                }}
                height={260}
                description={`Line of ${p.name}'s KDA over ${rows.length} games; average ${fmt.dec(agg.kda, 1)}.`}
              />
            </Section>
          </div>

          <Section title="Champion pool" description="Games and wins per champion.">
            <Spoiler as="div" label="Reveal chart (contains results)">
              <Chart
                builderHref={chartHref(championRecordChart({ playerId: p.id }, p.name, null))}
                spec={champBar}
                table={{
                  columns: ["Champion", "Wins", "Losses"],
                  rows: agg.champions.map((c) => [c.champion, c.wins, c.games - c.wins]),
                }}
                height={Math.max(200, agg.champions.length * 32)}
                description={`Stacked bars of ${p.name}'s champions; ${agg.champions[0].champion} most played with ${agg.champions[0].games} games.`}
              />
            </Spoiler>
            <ul className="flex flex-wrap gap-2">
              {agg.champions.map((c) => (
                <li key={c.champion} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
                  <ChampionIcon champion={champIcon(data, c.champion)} size="xs" />
                  {c.champion} <span className="tabular text-muted-foreground">×{c.games}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Every game" description="Oldest first. Click a game to open the series.">
            <Spoiler as="div" label="Reveal games (contains results)">
              <DataTable
                columns={GAME_COLUMNS}
                rows={tableRows}
                caption={`${p.name}'s games`}
                rowLinkKey="game"
                dense
              />
            </Spoiler>
          </Section>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No games with published scoreboards yet.
        </p>
      )}
    </div>
  );
}
