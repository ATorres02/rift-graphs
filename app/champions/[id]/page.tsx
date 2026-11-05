import { Breadcrumbs } from "@/components/breadcrumbs";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChampionIcon } from "@/components/champion-icon";
import { ProBuilds } from "@/components/champions/pro-builds";
import { Chart } from "@/components/charts/chart";
import { Headlines, type Headline } from "@/components/headlines";
import { Inventory, RuneIcon } from "@/components/loadout-icons";
import { Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { championBuild } from "@/lib/builds";
import { draftedChampions, getData, getLoadout, teamRef } from "@/lib/data/load";
import type { BarSpec } from "@/lib/charts/spec";
import type { ChampionRef, StageId } from "@/lib/data/types";
import { fmt, ROLE_LABEL, roundLabel, STAGE_LABEL } from "@/lib/format";
import { aggregateChampions, kda, ROLES } from "@/lib/metrics";
import {
  championLoadingUrl,
  championPageArt,
  championSlug,
  championSplashUrl,
  normalizeChampionName,
} from "@/lib/sources/ddragon";
import { baseOpenGraph, defaultOgImage } from "@/lib/site";
import { chartHref, championRolesChart, championStagesChart } from "@/lib/charts/page-charts";

export const dynamicParams = false;

export function generateStaticParams() {
  return draftedChampions(getData()).map((c) => ({ id: championSlug(c.id) }));
}

function find(id: string): ChampionRef | undefined {
  return getData().champions.champions.find((c) => championSlug(c.id) === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = find(id);
  if (!c) return {};
  const key = normalizeChampionName(c.name);
  const played = getData().playerGames.some((r) => normalizeChampionName(r.champion) === key);
  // "<champion> build" is what people search; a champion that was only banned has no build to show.
  const title = played ? `${c.name} build, runes and stats at Worlds 2026` : `${c.name}, Worlds 2026 stats`;
  return {
    title,
    description: `${c.name}${c.title ? `, ${c.title}` : ""} at the 2026 World Championship: ${played ? "pro builds and runes, " : ""}presence, picks, bans, win rate by role and every game it was played in.`,
    openGraph: { ...baseOpenGraph, title, images: [defaultOgImage] },
  };
}

const STAGES: StageId[] = ["playin", "swiss", "quarterfinals", "semifinals", "final"];

export default async function ChampionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = find(id);
  if (!c) notFound();
  const data = getData();
  const key = normalizeChampionName(c.name);
  const agg = aggregateChampions(data.confirmedGames, data.playerGames).find(
    (a) => normalizeChampionName(a.champion) === key,
  );
  if (!agg) notFound();
  const games = data.confirmedGames.length;

  const rows = data.playerGames.filter((r) => normalizeChampionName(r.champion) === key);
  // The builder filters on the name as the data spells it.
  const dataName = agg?.champion ?? rows[0]?.champion ?? c.name;
  const byPlayer = new Map<string, { games: number; wins: number; k: number; d: number; a: number }>();
  for (const r of rows) {
    const p = byPlayer.get(r.playerId) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0 };
    p.games += 1;
    if (r.win) p.wins += 1;
    p.k += r.kills;
    p.d += r.deaths;
    p.a += r.assists;
    byPlayer.set(r.playerId, p);
  }
  const players = Array.from(byPlayer, ([playerId, s]) => ({ playerId, ...s })).sort(
    (x, y) => y.games - x.games || y.wins - x.wins,
  );

  const byStage = STAGES.map((stage) => {
    const list = rows.filter((r) => r.stage === stage);
    const bans = data.confirmedGames.filter(
      (g) => g.stage === stage && [...g.blue.bans, ...g.red.bans].some((n) => normalizeChampionName(n) === key),
    ).length;
    return { stage, games: list.length, wins: list.filter((r) => r.win).length, bans };
  }).filter((s) => s.games || s.bans);

  const playedRoles = ROLES.filter((r) => agg.byRole[r]);
  const roleBar: BarSpec = {
    type: "bar",
    horizontal: true,
    stacked: true,
    categories: playedRoles.map((r) => ROLE_LABEL[r]),
    series: [
      { name: "Wins", values: playedRoles.map((r) => agg.byRole[r]!.wins), color: "var(--win)" },
      {
        name: "Losses",
        values: playedRoles.map((r) => agg.byRole[r]!.games - agg.byRole[r]!.wins),
        color: "var(--loss)",
      },
    ],
  };
  const stageBar: BarSpec = {
    type: "bar",
    horizontal: true,
    stacked: true,
    categories: byStage.map((s) => STAGE_LABEL[s.stage]),
    series: [
      { name: "Wins", values: byStage.map((s) => s.wins), color: "var(--win)" },
      { name: "Losses", values: byStage.map((s) => s.games - s.wins), color: "var(--loss)" },
      { name: "Bans", values: byStage.map((s) => s.bans), color: "var(--muted-foreground)" },
    ],
  };

  const gameRows = rows
    .map((r) => {
      const g = data.gamesById.get(r.gameId);
      const s = g ? data.seriesById.get(g.seriesId) : undefined;
      return g && s ? { r, g, s } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => (y.g.dateTimeUtc ?? y.s.dateTimeUtc).localeCompare(x.g.dateTimeUtc ?? x.s.dateTimeUtc));

  const headlines: Headline[] = [
    {
      label: "Presence",
      value: fmt.pct(agg.presence),
      detail: `${agg.picks} picks + ${agg.bans} bans in ${games} games`,
    },
    { label: "Pick rate", value: fmt.pct(agg.pickRate), detail: `${agg.picks} games played` },
    { label: "Ban rate", value: fmt.pct(agg.banRate), detail: `${agg.bans} bans` },
    agg.winRate !== null
      ? { label: "Win rate", value: fmt.pct(agg.winRate), detail: `${agg.wins}–${agg.picks - agg.wins}`, spoiler: true }
      : { label: "Win rate", value: "–", detail: "Never picked" },
  ];
  const loadout = getLoadout();
  const build = rows.length && loadout.version ? championBuild(rows, loadout) : null;

  const art = championPageArt(c.id);
  const splash = championSplashUrl(c.id, art.skin);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Champions", href: "/champions" }, { label: c.name }]} />
      <header className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <div className="absolute inset-0">
          <picture>
            <source media="(max-width: 640px)" srcSet={championLoadingUrl(c.id, art.skin)} />
            <img
              src={splash}
              alt=""
              width={1215}
              height={717}
              fetchPriority="high"
              decoding="async"
              className={`size-full object-cover object-[center_25%]${art.tribute ? " grayscale" : ""}`}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        </div>
        <div className="relative flex min-h-[320px] flex-col justify-end p-5 sm:min-h-[420px] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            Champion / patch {data.tournament.patch ?? "?"}
          </p>
          <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight sm:text-6xl">{c.name}</h1>
          {c.title ? <p className="mt-1 text-base capitalize text-muted-foreground sm:text-lg">{c.title}</p> : null}
          <p className="mt-3 flex flex-wrap gap-1.5">
            {ROLES.filter((r) => agg.byRole[r]).map((r) => (
              <span
                key={r}
                className="rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur"
              >
                {ROLE_LABEL[r]}: {agg.byRole[r]!.games} {agg.byRole[r]!.games === 1 ? "game" : "games"}
              </span>
            ))}
          </p>
        </div>
      </header>

      <Headlines items={headlines} className="lg:grid-cols-4" />

      {build ? (
        <Section
          title="Pro builds"
          description={`What the pros ended their games with on ${c.name}, over ${build.games} ${build.games === 1 ? "game" : "games"}: items from the final inventory, so an item still being built does not count.`}
        >
          <ProBuilds build={build} loadout={loadout} />
        </Section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="By role" description="Games and wins when picked in each role.">
          <Spoiler as="div" label="Reveal win rates">
            <Chart
              builderHref={chartHref(championRolesChart(dataName))}
              spec={roleBar}
              table={{
                columns: ["Role", "Games", "W–L", "Win rate"],
                rows: playedRoles.map((r) => [
                  ROLE_LABEL[r],
                  agg.byRole[r]!.games,
                  `${agg.byRole[r]!.wins}–${agg.byRole[r]!.games - agg.byRole[r]!.wins}`,
                  fmt.pct(agg.byRole[r]!.wins / agg.byRole[r]!.games),
                ]),
              }}
              height={Math.max(160, playedRoles.length * 44 + 60)}
              description={`Stacked bars of ${c.name}'s wins and losses per role.`}
            />
          </Spoiler>
        </Section>
        <Section title="By stage" description="Picks, bans and wins per stage of the tournament.">
          <Spoiler as="div" label="Reveal win rates">
            <Chart
              builderHref={chartHref(championStagesChart(dataName))}
              spec={stageBar}
              table={{
                columns: ["Stage", "Picks", "Bans", "W–L"],
                rows: byStage.map((s) => [
                  STAGE_LABEL[s.stage],
                  s.games,
                  s.bans,
                  s.games ? `${s.wins}–${s.games - s.wins}` : "–",
                ]),
              }}
              height={Math.max(160, byStage.length * 44 + 60)}
              description={`Stacked bars of ${c.name}'s wins, losses and bans per stage.`}
            />
          </Spoiler>
        </Section>
      </div>

      <Section title="Who played it" description="Players ranked by games on this champion.">
        {players.length ? (
          <Spoiler as="div" label="Reveal records">
            <StatTable
              columns={["Player", "Team", "Role", "Games", "W–L", "KDA"]}
              linkRows
              rows={players.map((p) => {
                const pl = data.playersById.get(p.playerId);
                const team = teamRef(pl ? data.teamsById.get(pl.teamId) : undefined);
                return [
                  <Link
                    key="p"
                    href={`/players/${p.playerId}`}
                    className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    {pl?.name ?? p.playerId}
                  </Link>,
                  <TeamPill key="t" team={team} size="sm" className="relative z-10" />,
                  pl ? ROLE_LABEL[pl.role] : "–",
                  p.games,
                  `${p.wins}–${p.games - p.wins}`,
                  fmt.dec(kda(p.k, p.d, p.a), 1),
                ];
              })}
            />
          </Spoiler>
        ) : (
          <p className="text-sm text-muted-foreground">
            Banned every time it showed up: nobody has played {c.name} yet.
          </p>
        )}
      </Section>

      {gameRows.length ? (
        <Section
          title="Every game"
          description="Newest first, with the keystone and final items of each game. Results stay hidden in spoiler mode."
        >
          <ul className="divide-y rounded-xl border bg-card">
            {gameRows.map(({ r, g, s }) => {
              const team = data.teamsById.get(r.teamId);
              const opponent = data.teamsById.get(r.opponentTeamId);
              const pl = data.playersById.get(r.playerId);
              return (
                <li key={r.gameId} className="relative space-y-1.5 px-3 py-2.5 transition-colors hover:bg-brand-soft">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <Link
                      href={`/matches/${s.id}`}
                      className="text-base font-semibold after:absolute after:inset-0 after:content-[''] hover:underline sm:text-lg"
                    >
                      {team?.short ?? "TBD"} {pl?.name ?? r.playerId}{" "}
                      <span className="font-normal text-muted-foreground">vs</span> {opponent?.short ?? "TBD"}
                    </Link>
                    <span className="text-xs text-muted-foreground sm:text-sm">
                      {roundLabel(s.stage, s.round, s.tab)} – Game {g.gameNumber}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span>
                      {ROLE_LABEL[r.role]}, {r.side} side
                    </span>
                    <Spoiler label="Result">
                      <span className={r.win ? "font-semibold text-win" : "font-semibold text-loss"}>
                        {r.win ? "WIN" : "LOSS"} {r.kills}/{r.deaths}/{r.assists}
                      </span>
                    </Spoiler>
                    {loadout.version ? (
                      <span className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
                        {r.keystone ? <RuneIcon name={r.keystone} loadout={loadout} size="md" /> : null}
                        <Inventory items={r.items} trinket={r.trinket} loadout={loadout} size="sm" />
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <ChampionIcon champion={{ name: c.name, ddragonId: c.id, version: data.champions.version }} size="sm" />
        <Link href="/champions" className="underline hover:text-foreground">
          All champions
        </Link>
      </p>
    </div>
  );
}

function StatTable({
  columns,
  rows,
  linkRows = false,
}: {
  columns: string[];
  rows: (string | number | React.ReactNode)[][];
  /** Rows carry a stretched link in their first cell: position them and highlight on hover. */
  linkRows?: boolean;
}) {
  return (
    <div className="scroll-x rounded-xl border bg-card">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => (
              <TableHead key={c} className={i ? "text-right" : undefined}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} className={linkRows ? "relative cursor-pointer hover:bg-brand-soft" : undefined}>
              {r.map((cell, j) => (
                <TableCell key={j} className={j ? "text-right tabular" : undefined}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
