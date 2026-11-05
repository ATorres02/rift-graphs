import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, GitCompareArrowsIcon } from "lucide-react";
import { ChampionIcon } from "@/components/champion-icon";
import { LocalTime } from "@/components/local-time";
import { ChartsLink, MetricRow } from "@/components/match/series-preview";
import { PageHeader, Section } from "@/components/page-header";
import { RoleGlyph } from "@/components/rift/role-glyph";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { chartHref, compareChart } from "@/lib/charts/page-charts";
import { championRef, getData, teamRef, type IndexedDataset } from "@/lib/data/load";
import { duelHref, duelSeries, DUEL_LABEL, isRole, laneDuel, type DuelSide, type LaneDuel } from "@/lib/duels";
import { bestOfLabel, fmt, roundLabel, ROLE_LABEL } from "@/lib/format";
import { comparePlayersHref } from "@/lib/links";
import { ROLES } from "@/lib/metrics";
import { LANE_CHART_MEASURES, previewRound } from "@/lib/preview";
import { baseOpenGraph } from "@/lib/site";
import { cn } from "@/lib/utils";
import { champIcon } from "@/lib/views";

export const dynamicParams = false;

export function generateStaticParams() {
  return duelSeries(getData()).flatMap((s) => ROLES.map((role) => ({ id: s.id, role })));
}

type Params = Promise<{ id: string; role: string }>;

function load(id: string, role: string): LaneDuel | null {
  const data = getData();
  const s = data.seriesById.get(id);
  if (!s || !isRole(role)) return null;
  return laneDuel(data, s, role);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, role } = await params;
  const duel = load(id, role);
  if (!duel?.a || !duel.b) return {};
  const data = getData();
  const ta = data.teamsById.get(duel.a.teamId);
  const tb = data.teamsById.get(duel.b.teamId);
  const names = `${duel.a.player.name} vs ${duel.b.player.name}`;
  const round = previewRound(duel.series.stage, duel.series.round);
  const title = `${names}: ${ta?.short} vs ${tb?.short} ${DUEL_LABEL[duel.role].toLowerCase()} duel, Worlds 2026`;
  return {
    title,
    description: `${duel.a.player.name} (${ta?.name}) and ${duel.b.player.name} (${tb?.name}) before their Worlds 2026 ${round}: KDA, damage, gold and CS at 15 side by side, their champions and every game they met in lane.`,
    openGraph: { ...baseOpenGraph, title },
  };
}

/** The other lanes of the series, the current one marked. */
function LaneNav({ data, duel }: { data: IndexedDataset; duel: LaneDuel }) {
  return (
    <nav aria-label="Lanes of this series" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-2">
        {ROLES.map((role) => {
          const current = role === duel.role;
          const other = current ? duel : laneDuel(data, duel.series, role);
          return (
            <li key={role}>
              <Link
                href={duelHref(duel.series.id, role)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm no-underline transition-colors",
                  current ? "border-brand bg-brand-soft text-foreground" : "bg-card hover:border-brand",
                )}
              >
                <RoleGlyph kind={role} className="size-4" />
                <span className="font-semibold">{ROLE_LABEL[role]}</span>
                {other?.a && other.b ? (
                  <span className="hidden text-xs text-muted-foreground lg:inline">
                    {other.a.player.name} / {other.b.player.name}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Every champion a player had in the role, with games and, behind the spoiler switch, the record. */
function ChampionColumn({ data, side, name }: { data: IndexedDataset; side: DuelSide | null; name: string }) {
  if (!side?.champions.length) return <p className="text-sm text-muted-foreground">No games in the role yet.</p>;
  const max = Math.max(...side.champions.map((c) => c.games), 1);
  return (
    <ol className="space-y-2" aria-label={`${name}'s champions`}>
      {side.champions.map((c) => (
        <li key={c.champion} className="flex items-center gap-2.5">
          <ChampionIcon champion={champIcon(data, c.champion)} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{c.champion}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular">
                <Spoiler label="W-L">
                  <span className="text-xs text-muted-foreground">{fmt.record(c.wins, c.games - c.wins)}</span>
                </Spoiler>
                <span className="font-semibold">{c.games}</span>
              </span>
            </span>
            <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(c.games / max) * 100}%` }} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function DuelPage({ params }: { params: Params }) {
  const { id, role } = await params;
  const duel = load(id, role);
  if (!duel) notFound();
  const data = getData();
  const s = duel.series;
  const { a, b } = duel;
  const aName = a?.player.name ?? "To be decided";
  const bName = b?.player.name ?? "To be decided";
  // The art behind the header: the most played champion of whichever of the two has played it more.
  const top = [a, b].flatMap((x) => (x?.champions[0] ? [x.champions[0]] : [])).sort((x, y) => y.games - x.games)[0];
  const art = top ? championRef(data, top.champion) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        art={art ? { ddragonId: art.id } : null}
        eyebrow={`${roundLabel(s.stage, s.round, s.tab)} / ${bestOfLabel(s.bestOf)} / ${DUEL_LABEL[duel.role]} duel`}
        title={
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {aName} <span className="text-muted-foreground">vs</span> {bName}
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <TeamPill team={teamRef(data.teamsById.get(s.team1Id ?? ""))} size="sm" />
            <span>vs</span>
            <TeamPill team={teamRef(data.teamsById.get(s.team2Id ?? ""))} size="sm" />
          </span>
          <LocalTime iso={s.dateTimeUtc} hasTime={s.hasTime} />
          <Link href={`/matches/${s.id}`} className="inline-flex items-center gap-1 underline hover:text-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Series page
          </Link>
        </div>
      </PageHeader>

      <LaneNav data={data} duel={duel} />

      <Section
        title="Side by side"
        description={`Per game as ${ROLE_LABEL[duel.role].toLowerCase()} at Worlds 2026, before this series. Bars run to the best of the ${duel.roleCount} players in the role with 3 games or more and the tick marks their average; the better of the two is in blue.`}
        action={
          a && b ? (
            <ChartsLink
              href={chartHref(compareChart("players", a.player.playerId, b.player.playerId, LANE_CHART_MEASURES))}
              label={`${aName} and ${bName}`}
            />
          ) : undefined
        }
      >
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            {[a, b].map((side, i) =>
              side ? (
                <div key={i} className={cn("flex min-w-0 flex-col gap-2", i === 1 && "items-end text-right")}>
                  <TeamPill team={teamRef(data.teamsById.get(side.teamId))} size="sm" withName />
                  <Link
                    href={`/players/${side.player.playerId}`}
                    className="display block max-w-full truncate text-3xl font-bold no-underline hover:text-brand sm:text-4xl"
                  >
                    {side.player.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{plural(side.player.games, "game")}</span>
                  {side.player.champions.length ? (
                    <ul className={cn("flex gap-1.5", i === 1 && "flex-row-reverse")}>
                      {side.player.champions.map((c) => (
                        <li key={c.champion} className="relative" title={`${c.champion}, ${plural(c.count, "game")}`}>
                          <ChampionIcon champion={champIcon(data, c.champion)} size="md" />
                          <span className="absolute -right-1 -bottom-1 rounded border bg-background px-0.5 text-[10px] leading-tight font-semibold tabular">
                            {c.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p key={i} className="text-sm text-muted-foreground">
                  To be decided
                </p>
              ),
            )}
          </div>
          <ul className="space-y-3 border-t pt-4 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3 lg:space-y-0">
            {duel.metrics.map((m) => (
              <MetricRow key={m.key} m={m} aName={aName} bName={bName} />
            ))}
          </ul>
          <Spoiler as="div" label="Reveal win rates" className="mt-3 block border-t pt-3">
            <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:space-y-0">
              {duel.results.map((m) => (
                <MetricRow key={m.key} m={m} aName={aName} bName={bName} />
              ))}
            </ul>
          </Spoiler>
        </div>
      </Section>

      <Section
        title="Champions"
        description={`Every champion each played as ${ROLE_LABEL[duel.role].toLowerCase()} before this series.`}
      >
        <div className="grid grid-cols-2 gap-3">
          {[a, b].map((side, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 sm:p-4">
              <p className="kicker mb-3 text-xs text-muted-foreground">{i === 0 ? aName : bName}</p>
              <ChampionColumn data={data} side={side} name={i === 0 ? aName : bName} />
            </div>
          ))}
        </div>
      </Section>

      {a && b ? (
        <Section
          title="Met in lane"
          description={
            duel.meetings.length
              ? "Earlier games at Worlds 2026 in which they faced each other in this lane."
              : "They have not faced each other in this lane at Worlds 2026 before this series."
          }
        >
          {duel.meetings.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {duel.meetings.map(({ game, a: ra, b: rb }) => {
                const gs = data.seriesById.get(game.seriesId);
                return (
                  <li
                    key={game.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 p-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChampionIcon champion={champIcon(data, ra.champion)} size="sm" />
                      <span className="truncate">{ra.champion}</span>
                      <span className="tabular text-muted-foreground">
                        {ra.kills}/{ra.deaths}/{ra.assists}
                      </span>
                    </span>
                    <Link
                      href={`/matches/${game.seriesId}`}
                      className="text-center text-xs text-muted-foreground no-underline hover:text-brand"
                    >
                      {gs ? roundLabel(gs.stage, gs.round, gs.tab) : ""}, game {game.gameNumber}
                      <Spoiler label="Winner" className="block">
                        <span className="block font-semibold text-foreground">
                          {(game.winnerTeamId === a.teamId ? aName : bName) + " won"}
                        </span>
                      </Spoiler>
                    </Link>
                    <span className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
                      <ChampionIcon champion={champIcon(data, rb.champion)} size="sm" />
                      <span className="truncate">{rb.champion}</span>
                      <span className="tabular text-muted-foreground">
                        {rb.kills}/{rb.deaths}/{rb.assists}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {a && b ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={comparePlayersHref(a.player.playerId, b.player.playerId)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium no-underline transition-colors hover:border-brand"
          >
            <GitCompareArrowsIcon className="size-4" aria-hidden />
            Compare {aName} and {bName}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
