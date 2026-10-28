import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { CompareBars } from "@/components/match/compare-bars";
import { DraftBoard, type DraftPlayer } from "@/components/match/draft-board";
import { LineupTable } from "@/components/match/lineup";
import { Scoreboard } from "@/components/match/scoreboard";
import { PageHeader, Section } from "@/components/page-header";
import { PendingData } from "@/components/pending-data";
import { ProvisionalBadge } from "@/components/provisional";
import { SeriesCard, StatusLabel } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, seriesHasPendingGames, seriesTeams, teamRef } from "@/lib/data/load";
import type { Game, Side, Team } from "@/lib/data/types";
import { lockedChampionsBefore } from "@/lib/draft";
import { bestOfLabel, fmt, ROLE_LABEL, roundLabel, STAGE_LABEL } from "@/lib/format";
import { seriesRecord } from "@/lib/metrics";
import { site } from "@/lib/site";
import { swissStandings } from "@/lib/standings";
import { champIcon, seriesArt, seriesView } from "@/lib/views";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return getData().series.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = getData();
  const s = data.seriesById.get(id);
  if (!s) return {};
  const { team1, team2 } = seriesTeams(data, s);
  const title = `${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}`;
  return {
    title,
    description: `${roundLabel(s.stage, s.round, s.tab)} (${bestOfLabel(s.bestOf)}) of the 2026 World Championship: draft, scoreboard and objectives for every game.`,
    openGraph: { title: `${title}, ${STAGE_LABEL[s.stage]}` },
  };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const s = data.seriesById.get(id);
  if (!s) notFound();
  const { team1, team2 } = seriesTeams(data, s);
  const games = data.gamesBySeries.get(s.id) ?? [];
  const icon = (name: string) => champIcon(data, name);
  const pending = seriesHasPendingGames(s);
  const missing = Math.max(0, s.gamesPlayed - games.length);
  const preview = games.length === 0 && (s.status === "scheduled" || (s.status === "live" && missing === 0));

  /** Who played what, from the scoreboard rows or, for a manual game, the typed line-up. */
  const lineupFor = (g: Game, side: Side): DraftPlayer[] => {
    const rows = (data.playerGamesByGame.get(g.id) ?? []).filter((r) => r.side === side);
    if (rows.length) {
      return rows.map((r) => ({
        role: r.role,
        champion: r.champion,
        playerId: r.playerId,
        name: data.playersById.get(r.playerId)?.name ?? r.playerId,
      }));
    }
    return (g[side].lineup ?? []).map((l) => ({
      role: l.role,
      champion: l.champion,
      playerId: l.playerId,
      name: l.name,
    }));
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}, ${roundLabel(s.stage, s.round, s.tab)}`,
    startDate: s.dateTimeUtc,
    eventStatus: s.status === "finished" ? "https://schema.org/EventScheduled" : "https://schema.org/EventScheduled",
    competitor: [team1, team2].filter(Boolean).map((t) => ({ "@type": "SportsTeam", name: t!.name })),
    url: `${site.url}/matches/${s.id}`,
    organizer: { "@type": "Organization", name: "Riot Games" },
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader
        art={seriesArt(data, s, games)}
        eyebrow={`${roundLabel(s.stage, s.round, s.tab)} / ${bestOfLabel(s.bestOf)}${s.patch ? ` / Patch ${s.patch}` : ""}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <TeamPill team={team1} size="lg" withName />
            <span className="text-muted-foreground">vs</span>
            <TeamPill team={team2} size="lg" withName />
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <LocalTime iso={s.dateTimeUtc} hasTime={s.hasTime} />
          <StatusLabel series={s} />
          {s.provisional ? <ProvisionalBadge source={s.source} /> : null}
          {s.score ? (
            <Spoiler label="Reveal score">
              <span className="text-lg font-semibold tabular text-foreground">
                {s.score.team1} – {s.score.team2}
              </span>
            </Spoiler>
          ) : null}
          {pending ? <PendingData /> : null}
          {s.mvp ? (
            <Spoiler label="MVP">
              <span>MVP: {s.mvp}</span>
            </Spoiler>
          ) : null}
          <a
            href={data.tournament.officialUrl ?? site.lolesportsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-foreground"
          >
            Watch on lolesports.com <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
          {s.streamUrl ? (
            <a
              href={s.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-foreground"
            >
              Stream <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </PageHeader>

      {preview ? (
        <SeriesPreview
          seriesId={s.id}
          live={s.status === "live"}
          teams={[data.teamsById.get(s.team1Id ?? ""), data.teamsById.get(s.team2Id ?? "")]}
        />
      ) : null}

      <div className="space-y-12">
        {games.map((g) => {
          const blue = teamRef(data.teamsById.get(g.blue.teamId));
          const red = teamRef(data.teamsById.get(g.red.teamId));
          const rows = data.playerGamesByGame.get(g.id) ?? [];
          const draft = data.draftsByGame.get(g.id);
          const winner = g.winnerSide === "blue" ? blue : red;
          const dmg = (side: "blue" | "red") =>
            rows.filter((r) => r.side === side).reduce((a, r) => a + r.damageToChampions, 0);
          const hasLineup = Boolean(g.blue.lineup || g.red.lineup);
          return (
            <Section
              key={g.id}
              collapsible
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  Game {g.gameNumber}
                  {g.provisional ? <ProvisionalBadge source={g.source} /> : null}
                </span>
              }
              description={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Duration {fmt.duration(g.durationSeconds)}</span>
                  <Spoiler label="Reveal winner">
                    <span className="inline-flex items-center gap-1.5">
                      Winner <TeamPill team={winner} size="sm" /> ({g.winnerSide} side)
                    </span>
                  </Spoiler>
                  {g.vodUrl ? (
                    <a
                      href={g.vodUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline hover:text-foreground"
                    >
                      VOD <ExternalLinkIcon className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </span>
              }
            >
              <Spoiler as="div" label={`Reveal game ${g.gameNumber}`} className="block space-y-4 pt-1">
                {draft ? (
                  <DraftBoard
                    draft={draft}
                    blue={blue}
                    red={red}
                    lineups={{ blue: lineupFor(g, "blue"), red: lineupFor(g, "red") }}
                    icon={icon}
                    locked={s.bestOf > 1 ? lockedChampionsBefore(games, g.gameNumber) : []}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Draft order not published yet.</p>
                )}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    {rows.length ? (
                      <>
                        <Scoreboard
                          rows={rows.filter((r) => r.side === "blue")}
                          players={data.playersById}
                          icon={icon}
                          side="blue"
                          teamName={blue?.name ?? "Blue"}
                        />
                        <Scoreboard
                          rows={rows.filter((r) => r.side === "red")}
                          players={data.playersById}
                          icon={icon}
                          side="red"
                          teamName={red?.name ?? "Red"}
                        />
                      </>
                    ) : hasLineup ? (
                      <>
                        {g.blue.lineup ? (
                          <LineupTable lineup={g.blue.lineup} icon={icon} side="blue" teamName={blue?.name ?? "Blue"} />
                        ) : null}
                        {g.red.lineup ? (
                          <LineupTable lineup={g.red.lineup} icon={icon} side="red" teamName={red?.name ?? "Red"} />
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Line-ups typed by hand. Full player stats appear when Leaguepedia publishes the scoreboard.
                        </p>
                      </>
                    ) : (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Player stats appear when Leaguepedia publishes the scoreboard.
                      </p>
                    )}
                  </div>
                  {g.statsComplete ? (
                    <CompareBars
                      blueName={blue?.short ?? "Blue"}
                      redName={red?.short ?? "Red"}
                      metrics={[
                        { label: "Kills", blue: g.blue.kills, red: g.red.kills },
                        { label: "Gold", blue: g.blue.gold, red: g.red.gold, format: fmt.compact },
                        ...(rows.length
                          ? [
                              {
                                label: "Damage to champions",
                                blue: dmg("blue"),
                                red: dmg("red"),
                                format: fmt.compact,
                              },
                            ]
                          : []),
                        { label: "Towers", blue: g.blue.towers, red: g.red.towers },
                        { label: "Inhibitors", blue: g.blue.inhibitors, red: g.red.inhibitors },
                        { label: "Dragons", blue: g.blue.dragons, red: g.red.dragons },
                        { label: "Elder dragons", blue: g.blue.elders, red: g.red.elders },
                        { label: "Barons", blue: g.blue.barons, red: g.red.barons },
                        { label: "Rift Heralds", blue: g.blue.heralds, red: g.red.heralds },
                        { label: "Void grubs", blue: g.blue.voidGrubs, red: g.red.voidGrubs },
                      ]}
                    />
                  ) : (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Team objectives appear when Leaguepedia publishes the game.
                    </p>
                  )}
                </div>
              </Spoiler>
            </Section>
          );
        })}

        {Array.from({ length: missing }, (_, i) => games.length + i + 1).map((n) => (
          <Section key={`pending-${n}`} title={`Game ${n}`} description="Played, scoreboard not published yet.">
            <div className="rounded-xl border border-dashed p-6">
              <PendingData />
            </div>
          </Section>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        <Link href="/matches" className="underline hover:text-foreground">
          Back to all matches
        </Link>
      </p>
    </div>
  );
}

/** What to know before a series starts: rosters, records so far and earlier meetings in this tournament. */
function SeriesPreview({
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
  return (
    <div className="space-y-6">
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
                  <TeamPill team={teamRef(team)} size="md" />
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
              <ul className="mt-3 divide-y rounded-lg border">
                {roster.map(({ player, role }) => (
                  <li key={player!.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-16 text-xs font-medium uppercase text-muted-foreground">{ROLE_LABEL[role]}</span>
                    <Link href={`/players/${player!.id}`} className="font-medium no-underline hover:text-brand">
                      {player!.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
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
