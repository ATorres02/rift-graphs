import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { ChampionIcon } from "@/components/champion-icon";
import { Section } from "@/components/page-header";
import { RoleGlyph } from "@/components/rift/role-glyph";
import { SeriesCard } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { chartHref, championRecordChart, compareChart, TEAM_RADAR_MEASURES } from "@/lib/charts/page-charts";
import { getData, teamRef, type IndexedDataset, type TeamRef } from "@/lib/data/load";
import type { Team } from "@/lib/data/types";
import { fmt, ROLE_LABEL } from "@/lib/format";
import { seriesRecord } from "@/lib/metrics";
import {
  championPool,
  barShare,
  formatPreview,
  LANE_CHART_MEASURES,
  laneMatchups,
  leader,
  teamMatchup,
  type ChampionCount,
  type LanePlayer,
  type PreviewMetric,
} from "@/lib/preview";
import { swissStandings } from "@/lib/standings";
import { duelHref, hasDuels } from "@/lib/duels";
import { cn } from "@/lib/utils";
import { champIcon, seriesView } from "@/lib/views";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ChartsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Open in Charts: ${label}`}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
    >
      Open in Charts <ArrowUpRightIcon className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * One metric for both sides: the values at the ends and a bar growing out of the centre towards each side, scaled to
 * the best in the reference group, with a tick at its average. The better of the two is drawn in the brand colour.
 */
export function MetricRow({ m, aName, bName }: { m: PreviewMetric; aName: string; bName: string }) {
  const lead = leader(m);
  const fa = formatPreview(m.a, m.format);
  const fb = formatPreview(m.b, m.format);
  const width = (v: number | null) => `${barShare(m, v) * 100}%`;
  const tick = m.avg === null ? null : `${barShare(m, m.avg) * 100}%`;
  const bar = (side: "a" | "b") => (
    <span className={cn("relative h-2 bg-muted", side === "a" ? "rounded-l-full" : "rounded-r-full")}>
      <span
        className={cn(
          "absolute inset-y-0",
          side === "a" ? "right-0 rounded-l-full" : "left-0 rounded-r-full",
          lead === side ? "bg-brand" : "bg-muted-foreground/45",
        )}
        style={{ width: width(side === "a" ? m.a : m.b) }}
      />
      {tick ? (
        <span
          className="absolute -inset-y-0.5 w-0.5 rounded-full bg-foreground/70"
          style={side === "a" ? { right: tick } : { left: tick }}
        />
      ) : null}
    </span>
  );
  return (
    <li>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-baseline gap-1 text-xs tabular">
        <span className={cn(lead === "a" ? "font-semibold text-foreground" : "text-muted-foreground")}>{fa}</span>
        <span className="truncate text-center text-muted-foreground">{m.label}</span>
        <span className={cn("text-right", lead === "b" ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {fb}
        </span>
      </div>
      <div
        className="mt-1 grid grid-cols-2 gap-0.5"
        role="img"
        aria-label={`${m.label}: ${aName} ${fa}, ${bName} ${fb}${m.avg !== null ? `, average ${formatPreview(m.avg, m.format)}` : ""}`}
      >
        {bar("a")}
        {bar("b")}
      </div>
    </li>
  );
}

function TeamHeads({ a, b, note }: { a: TeamRef | null; b: TeamRef | null; note?: (side: "a" | "b") => ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex flex-col items-start gap-1">
        <TeamPill team={a} size="sm" withName />
        {note ? <span className="text-[11px] text-muted-foreground">{note("a")}</span> : null}
      </div>
      <div className="flex flex-col items-end gap-1">
        <TeamPill team={b} size="sm" withName />
        {note ? <span className="text-[11px] text-muted-foreground">{note("b")}</span> : null}
      </div>
    </div>
  );
}

function LaneSide({ p, align }: { p: LanePlayer | null; align: "left" | "right" }) {
  const data = getData();
  if (!p) return <span className="text-sm text-muted-foreground">Unknown</span>;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", align === "right" && "items-end text-right")}>
      <div className="min-w-0">
        <Link
          href={`/players/${p.playerId}`}
          className="block truncate font-semibold no-underline hover:text-brand xl:text-sm"
        >
          {p.name}
        </Link>
        <span className="text-[11px] text-muted-foreground">{plural(p.games, "game")}</span>
      </div>
      {p.champions.length ? (
        <ul className={cn("flex gap-1.5", align === "right" && "flex-row-reverse")}>
          {p.champions.map((c) => (
            <li key={c.champion} className="relative" title={`${c.champion}, ${plural(c.count, "game")}`}>
              <ChampionIcon champion={champIcon(data, c.champion)} size="sm" linked />
              <span className="absolute -right-1 -bottom-1 rounded border bg-background px-0.5 text-[9px] leading-tight font-semibold tabular">
                {c.count}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChampionList({ title, team, rows }: { title: string; team: string; rows: ChampionCount[] }) {
  const data = getData();
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <h3 className="kicker mb-2 text-[11px] text-muted-foreground">
        {title}
        <span className="sr-only">, {team}</span>
      </h3>
      {rows.length ? (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.champion} className="flex items-center gap-2">
              <ChampionIcon champion={champIcon(data, r.champion)} size="sm" linked />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-1 text-xs">
                  <span className="truncate">{r.champion}</span>
                  <span className="font-semibold tabular">{r.count}</span>
                </span>
                <span aria-hidden className="mt-0.5 block h-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">None yet.</p>
      )}
    </div>
  );
}

/** Both teams side by side before the series: team numbers, lane by lane, and champion pools. */
/** `duelsOf`: the series whose lane duel pages the lanes link to, when it has them. */
function Matchup({ data, a, b, duelsOf }: { data: IndexedDataset; a: Team; b: Team; duelsOf: string | null }) {
  const ra = teamRef(a)!;
  const rb = teamRef(b)!;
  const teams = teamMatchup(data, a.id, b.id);
  const lanes = laneMatchups(data, a.id, b.id);
  const pools = [championPool(data.confirmedGames, a.id), championPool(data.confirmedGames, b.id)];
  const teamChart = compareChart("teams", a.id, b.id, Object.keys(TEAM_RADAR_MEASURES));
  if (!teams.games.a && !teams.games.b) return null;
  return (
    <>
      <Section
        title="Tale of the tape"
        description="Per game at Worlds 2026 so far. Bars run to the best team in the tournament and the tick marks the average team; the better of the two is in blue."
        action={<ChartsLink href={chartHref(teamChart)} label={`${a.short} and ${b.short}`} />}
      >
        <div className="rounded-xl border bg-card p-4">
          <TeamHeads a={ra} b={rb} note={(s) => plural(s === "a" ? teams.games.a : teams.games.b, "game")} />
          <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3 lg:space-y-0">
            {teams.metrics.map((m) => (
              <MetricRow key={m.key} m={m} aName={a.short} bName={b.short} />
            ))}
          </ul>
          <Spoiler as="div" label="Reveal win rates" className="mt-3 block border-t pt-3">
            <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3 lg:space-y-0">
              {teams.results.map((m) => (
                <MetricRow key={m.key} m={m} aName={a.short} bName={b.short} />
              ))}
            </ul>
          </Spoiler>
        </div>
      </Section>

      <Section
        title="Lane by lane"
        description="Who is likely to face whom, with their most played champions. Bars run to the best player in the role (3 games or more)."
      >
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-5">
          {lanes.map((lane) => (
            <article
              key={lane.role}
              className="flex w-[82%] shrink-0 snap-start flex-col gap-3 rounded-xl border bg-card p-4 sm:w-auto"
            >
              <h3 className="kicker flex items-center justify-center gap-1.5 text-xs text-brand">
                <RoleGlyph kind={lane.role} className="size-4" />
                {ROLE_LABEL[lane.role]}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <LaneSide p={lane.a} align="left" />
                <LaneSide p={lane.b} align="right" />
              </div>
              <ul className="flex-1 space-y-2.5">
                {lane.metrics.map((m) => (
                  <MetricRow key={m.key} m={m} aName={lane.a?.name ?? a.short} bName={lane.b?.name ?? b.short} />
                ))}
              </ul>
              {lane.a && lane.b ? (
                <div className="flex items-center justify-between gap-2 border-t pt-2">
                  {duelsOf ? (
                    <Link
                      href={duelHref(duelsOf, lane.role)}
                      aria-label={`Full duel: ${lane.a.name} vs ${lane.b.name}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand no-underline hover:underline"
                    >
                      Full duel <ArrowRightIcon className="size-3.5" aria-hidden />
                    </Link>
                  ) : (
                    <span />
                  )}
                  <ChartsLink
                    href={chartHref(compareChart("players", lane.a.playerId, lane.b.playerId, LANE_CHART_MEASURES))}
                    label={`${lane.a.name} and ${lane.b.name}`}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Champions" description="What each team plays most, and what its opponents ban against it.">
        <div className="grid grid-cols-2 gap-3">
          {pools.map((pool, i) => {
            const team = i === 0 ? a : b;
            return (
              <div key={pool.teamId} className="flex flex-col gap-4 rounded-xl border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <TeamPill team={i === 0 ? ra : rb} size="sm" />
                  <span className="text-[11px] text-muted-foreground">{plural(pool.games, "game")}</span>
                </div>
                <div className="grid flex-1 gap-4 lg:grid-cols-2">
                  <ChampionList title="Most played" team={team.short} rows={pool.played} />
                  <ChampionList title="Banned against them" team={team.short} rows={pool.bannedAgainst} />
                </div>
                <div className="flex justify-end border-t pt-2">
                  <ChartsLink
                    href={chartHref(championRecordChart({ teamId: team.id }, team.short, 10))}
                    label={`${team.short} champions`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

/** What to know before a series starts: the two teams, how they compare, and earlier meetings in this tournament. */
export function SeriesPreview({
  seriesId,
  live,
  teams,
}: {
  seriesId: string;
  live: boolean;
  teams: [Team | undefined, Team | undefined];
}) {
  const data = getData();
  const swiss = swissStandings(
    data.series,
    data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id),
  );
  const [a, b] = teams;
  const met =
    a && b
      ? data.series.filter(
          (x) =>
            x.id !== seriesId &&
            x.status === "finished" &&
            ((x.team1Id === a.id && x.team2Id === b.id) || (x.team1Id === b.id && x.team2Id === a.id)),
        )
      : [];
  const both = Boolean(a && b);
  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {live
          ? "This series is in progress. The score updates within minutes of each game; drafts and scoreboards follow when Leaguepedia publishes them."
          : "This series has not started. Drafts and scoreboards appear here once Leaguepedia publishes them."}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team, i) => {
          if (!team) {
            return (
              <div key={i} className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Opponent to be decided.
              </div>
            );
          }
          const rec = seriesRecord(data.series, team.id);
          const swissRec = swiss.find((r) => r.teamId === team.id);
          const roster = team.roster
            .map((r) => ({ ...r, player: data.playersById.get(r.playerId) }))
            .filter((r) => r.player);
          return (
            <div key={team.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/teams/${team.id}`} className="flex items-center gap-2 no-underline hover:text-brand">
                  <TeamPill team={teamRef(team)} size="md" link={false} />
                  <span className="font-semibold">{team.name}</span>
                </Link>
                <span className="text-xs text-muted-foreground">{team.region}</span>
              </div>
              <Spoiler as="div" label="Reveal record" className="mt-3 block">
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Series</dt>
                    <dd className="font-semibold tabular">{fmt.record(rec.wins, rec.losses)}</dd>
                  </div>
                  {swissRec ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Swiss stage</dt>
                      <dd className="flex items-center gap-1.5">
                        <span className="font-semibold tabular">{fmt.record(swissRec.wins, swissRec.losses)}</span>
                        <span className="flex gap-1">
                          {swissRec.results.map((res) => (
                            <span
                              key={res.seriesId}
                              className={cn(
                                "inline-flex size-5 items-center justify-center rounded text-[10px] font-bold",
                                res.won ? "bg-win/15 text-win" : "bg-loss/15 text-loss",
                              )}
                              title={`Round ${res.round}`}
                            >
                              {res.won ? "W" : "L"}
                            </span>
                          ))}
                        </span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </Spoiler>
              {/* With both teams known the lanes below name the players; with one, the roster stands in. */}
              {both ? null : (
                <ul className="mt-3 divide-y rounded-lg border">
                  {roster.map(({ player, role }) => (
                    <li key={player!.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-16 text-xs font-medium uppercase text-muted-foreground">
                        {ROLE_LABEL[role]}
                      </span>
                      <Link href={`/players/${player!.id}`} className="font-medium no-underline hover:text-brand">
                        {player!.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {a && b ? (
        <Matchup
          data={data}
          a={a}
          b={b}
          duelsOf={(() => {
            const s = data.seriesById.get(seriesId);
            return s && hasDuels(s) ? s.id : null;
          })()}
        />
      ) : null}
      {a && b ? (
        <Section
          title="Head to head"
          description={met.length ? "Earlier meetings in this tournament." : "First meeting in this tournament."}
        >
          {met.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {met.map((x) => {
                const v = seriesView(data, x);
                return (
                  <SeriesCard
                    key={x.id}
                    series={v.series}
                    team1={v.team1}
                    team2={v.team2}
                    pending={v.pending}
                    compact
                  />
                );
              })}
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
