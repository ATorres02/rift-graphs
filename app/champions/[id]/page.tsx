import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChampionIcon } from "@/components/champion-icon";
import { Headlines, type Headline } from "@/components/headlines";
import { Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getData, seriesTeams, teamRef } from "@/lib/data/load";
import type { ChampionRef, StageId } from "@/lib/data/types";
import { fmt, ROLE_LABEL, roundLabel, STAGE_LABEL } from "@/lib/format";
import { aggregateChampions, kda, ROLES } from "@/lib/metrics";
import { championLoadingUrl, championSlug, championSplashUrl, normalizeChampionName } from "@/lib/sources/ddragon";

export const dynamicParams = false;

function drafted(): ChampionRef[] {
  const data = getData();
  const seen = new Set<string>();
  for (const g of data.confirmedGames)
    for (const side of ["blue", "red"] as const)
      for (const n of [...g[side].picks, ...g[side].bans]) seen.add(normalizeChampionName(n));
  return data.champions.champions.filter((c) => seen.has(normalizeChampionName(c.name)));
}

export function generateStaticParams() {
  return drafted().map((c) => ({ id: championSlug(c.id) }));
}

function find(id: string): ChampionRef | undefined {
  return getData().champions.champions.find((c) => championSlug(c.id) === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = find(id);
  if (!c) return {};
  return {
    title: c.name,
    description: `${c.name}${c.title ? `, ${c.title}` : ""} at the 2026 World Championship: presence, picks, bans, win rate by role and every game it was played in.`,
    openGraph: { title: `${c.name} · Worlds 2026 stats` },
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
  const splash = championSplashUrl(c.id);

  return (
    <div className="space-y-8">
      <header className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <div className="absolute inset-0">
          <picture>
            <source media="(max-width: 640px)" srcSet={championLoadingUrl(c.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- remote splash art, fixed box; phones get the 55 KB portrait instead of the 160 KB splash */}
            <img
              src={splash}
              alt=""
              width={1215}
              height={717}
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover object-[center_25%]"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        </div>
        <div className="relative flex min-h-[320px] flex-col justify-end p-5 sm:min-h-[420px] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            Champion · patch {data.tournament.patch ?? "?"}
          </p>
          <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight sm:text-6xl">{c.name}</h1>
          {c.title ? <p className="mt-1 text-base capitalize text-muted-foreground sm:text-lg">{c.title}</p> : null}
          <p className="mt-3 flex flex-wrap gap-1.5">
            {ROLES.filter((r) => agg.byRole[r]).map((r) => (
              <span
                key={r}
                className="rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur"
              >
                {ROLE_LABEL[r]} · {agg.byRole[r]!.games} {agg.byRole[r]!.games === 1 ? "game" : "games"}
              </span>
            ))}
          </p>
        </div>
      </header>

      <Headlines items={headlines} className="lg:grid-cols-4" />

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="By role" description="Games and wins when picked in each role.">
          <Spoiler as="div" label="Reveal win rates">
            <StatTable
              columns={["Role", "Games", "W–L", "Win rate"]}
              rows={ROLES.filter((r) => agg.byRole[r]).map((r) => [
                ROLE_LABEL[r],
                agg.byRole[r]!.games,
                `${agg.byRole[r]!.wins}–${agg.byRole[r]!.games - agg.byRole[r]!.wins}`,
                fmt.pct(agg.byRole[r]!.wins / agg.byRole[r]!.games),
              ])}
            />
          </Spoiler>
        </Section>
        <Section title="By stage" description="Picks, bans and wins per stage of the tournament.">
          <Spoiler as="div" label="Reveal win rates">
            <StatTable
              columns={["Stage", "Picks", "Bans", "W–L"]}
              rows={byStage.map((s) => [
                STAGE_LABEL[s.stage],
                s.games,
                s.bans,
                s.games ? `${s.wins}–${s.games - s.wins}` : "–",
              ])}
            />
          </Spoiler>
        </Section>
      </div>

      <Section title="Who played it" description="Players ranked by games on this champion.">
        {players.length ? (
          <Spoiler as="div" label="Reveal records">
            <StatTable
              columns={["Player", "Team", "Games", "W–L", "KDA"]}
              rows={players.map((p) => {
                const pl = data.playersById.get(p.playerId);
                const team = teamRef(pl ? data.teamsById.get(pl.teamId) : undefined);
                return [
                  <Link key="p" href={`/players/${p.playerId}`} className="font-medium hover:underline">
                    {pl?.name ?? p.playerId}
                  </Link>,
                  <TeamPill key="t" team={team} size="sm" />,
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
        <Section title="Every game" description="Newest first. Results stay hidden in spoiler mode.">
          <ul className="divide-y rounded-xl border bg-card">
            {gameRows.map(({ r, g, s }) => {
              const { team1, team2 } = seriesTeams(data, s);
              const pl = data.playersById.get(r.playerId);
              return (
                <li key={r.gameId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <Link href={`/matches/${s.id}`} className="font-medium hover:underline">
                    {team1?.short ?? "TBD"} vs {team2?.short ?? "TBD"} · G{g.gameNumber}
                  </Link>
                  <span className="text-xs text-muted-foreground">{roundLabel(s.stage, s.round, s.tab)}</span>
                  <span className="text-xs text-muted-foreground">
                    {pl?.name ?? r.playerId} · {ROLE_LABEL[r.role]} · {r.side} side
                  </span>
                  <Spoiler label="Result">
                    <span className={r.win ? "text-xs font-semibold text-win" : "text-xs font-semibold text-loss"}>
                      {r.win ? "WIN" : "LOSS"} · {r.kills}/{r.deaths}/{r.assists}
                    </span>
                  </Spoiler>
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

function StatTable({ columns, rows }: { columns: string[]; rows: (string | number | React.ReactNode)[][] }) {
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
            <TableRow key={i}>
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
