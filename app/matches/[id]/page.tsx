import type { Metadata } from "next";
import Link from "next/link";
import { jsonLdHtml, seriesEndDate, seriesEventJsonLd, STAGE_VENUE, venueLabel, venueTown } from "@/lib/jsonld";
import { gameEnd } from "@/lib/last-modified";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, GitCompareArrowsIcon } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { CompareBars } from "@/components/match/compare-bars";
import { DraftBoard, type DraftPlayer } from "@/components/match/draft-board";
import { GameTabs } from "@/components/match/game-tabs";
import { GoldGraph } from "@/components/match/gold-graph";
import { BuildTable, RunesTable } from "@/components/match/loadout-tables";
import { LineupTable } from "@/components/match/lineup";
import { Scoreboard } from "@/components/match/scoreboard";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { stageCrumbHref } from "@/lib/links";
import { DuelStrip } from "@/components/match/duel-strip";
import { FinalDeeper, FinalDuels, FinalMatchInfo, FinalPicks } from "@/components/match/final-page";
import { FinalHero } from "@/components/home/final-hero";
import { signatureArt } from "@/lib/hero-art";
import { SeriesPreview } from "@/components/match/series-preview";
import { PageHeader, Section } from "@/components/page-header";
import { PendingData } from "@/components/pending-data";
import { ProvisionalBadge } from "@/components/provisional";
import { StatusLabel } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, getLoadout, getTimelines, seriesHasPendingGames, seriesTeams, teamRef } from "@/lib/data/load";
import type { Game, Side } from "@/lib/data/types";
import { lockedChampionsBefore } from "@/lib/draft";
import { bestOfLabel, fmt, roundLabel, STAGE_LABEL } from "@/lib/format";
import { seriesNumberInStage, seriesTitleLabel, weekdayDate } from "@/lib/series-labels";
import { hasDuels } from "@/lib/duels";
import { previewRound, showsPreview } from "@/lib/preview";
import { baseOpenGraph, site } from "@/lib/site";
import { compareTeamsHref } from "@/lib/links";
import { champIcon, seriesArt } from "@/lib/views";

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
  const teams = `${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"}`;
  const town = venueTown(STAGE_VENUE[s.stage]);
  // Before the teams are known, the page is what people find for "Worlds 2026 final": name it by the round and day.
  if (!team1 || !team2) {
    const label = seriesTitleLabel(s, seriesNumberInStage(data.series, s));
    const title = `Worlds 2026 ${label}, ${weekdayDate(s.dateTimeUtc)}: bracket and stats`;
    return {
      title,
      description: `The Worlds 2026 ${label.toLowerCase()} (${bestOfLabel(s.bestOf)}) on ${weekdayDate(s.dateTimeUtc)} in ${town}: ${team1 || team2 ? `${(team1 ?? team2)!.name} and an opponent still to be decided` : "both teams once known"}, a preview of the two, then draft and scoreboards for every game.`,
      openGraph: { ...baseOpenGraph, title },
    };
  }
  // Before the first game the page is a preview, and its title and description say so.
  const round = previewRound(s.stage, s.round);
  if (showsPreview(s, data.gamesBySeries.get(s.id)?.length ?? 0)) {
    const title = `${teams}: Worlds 2026 ${round} preview`;
    return {
      title,
      description: `${teams} before their Worlds 2026 ${round} (${bestOfLabel(s.bestOf)}): team stats side by side, the five lane match-ups and each team's champions.`,
      openGraph: { ...baseOpenGraph, title },
    };
  }
  // The round keeps titles unique when two teams meet again (Swiss, then knockout). No score: titles show in search.
  const title = `${teams}: Worlds 2026 ${round} stats`;
  return {
    title,
    description: `${teams}, Worlds 2026 ${round} (${bestOfLabel(s.bestOf)}): draft, gold graph, scoreboard and objectives for every game${hasDuels(s) ? ", plus the five lane duels" : ""}.`,
    openGraph: { ...baseOpenGraph, title },
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
  const preview = showsPreview(s, games.length);
  const timelines = getTimelines();
  const loadout = getLoadout();

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

  // The final, once both teams are known, gets its own poster page: big art first, the numbers one tap away.
  const final = s.stage === "final" && team1 && team2 ? { team1, team2 } : null;

  const label = seriesTitleLabel(s, seriesNumberInStage(data.series, s));
  const jsonLd = seriesEventJsonLd({
    name: team1 && team2 ? `${team1.name} vs ${team2.name}, Worlds 2026 ${label}` : `Worlds 2026 ${label}`,
    description: `${label} of the 2026 League of Legends World Championship (${bestOfLabel(s.bestOf)}) at ${venueLabel(STAGE_VENUE[s.stage])}.`,
    url: `${site.url}/matches/${s.id}`,
    image: `${site.url}/matches/${s.id}/opengraph-image`,
    startDate: s.dateTimeUtc,
    endDate: seriesEndDate(
      s.dateTimeUtc,
      s.bestOf,
      s.status === "finished" && games.length
        ? Math.max(...games.map((g) => gameEnd(data, g) ?? Date.parse(s.dateTimeUtc)))
        : null,
    ),
    stage: s.stage,
    competitors: [team1, team2].flatMap((t) => (t ? [{ name: t.name, url: `${site.url}/teams/${t.id}` }] : [])),
    streamUrl: s.streamUrl ?? data.tournament.officialUrl ?? site.lolesportsUrl,
  });

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <Breadcrumbs
        items={[
          { label: "Matches", href: "/matches" },
          { label: STAGE_LABEL[s.stage], href: stageCrumbHref(s.stage) },
          { label: team1 && team2 ? `${team1.short} vs ${team2.short}` : label },
        ]}
      />
      {final ? (
        <div className="space-y-6 sm:space-y-10">
          <FinalHero
            onSeriesPage
            series={s}
            team1={final.team1}
            team2={final.team2}
            art1={signatureArt(data, final.team1.id)}
            art2={signatureArt(data, final.team2.id)}
          />
          <FinalMatchInfo
            series={s}
            team1={final.team1}
            team2={final.team2}
            watchUrl={s.streamUrl ?? data.tournament.officialUrl ?? site.lolesportsUrl}
          />
          {pending || s.provisional ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {s.provisional ? <ProvisionalBadge source={s.source} /> : null}
              {pending ? <PendingData /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <PageHeader
          art={seriesArt(data, s, games)}
          eyebrow={`${roundLabel(s.stage, s.round, s.tab)} / ${bestOfLabel(s.bestOf)}${s.patch ? ` / Patch ${s.patch}` : ""}`}
          title={
            // The spaces are for search engines and screen readers, which read the heading as text; flex hides them.
            <span className="flex flex-wrap items-center gap-3">
              <TeamPill team={team1} size="lg" withName /> <span className="text-muted-foreground">vs</span>{" "}
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
            {team1 && team2 ? (
              <Link
                href={compareTeamsHref(team1.id, team2.id)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium text-foreground no-underline transition-colors hover:border-brand"
              >
                <GitCompareArrowsIcon className="size-4" aria-hidden />
                Compare teams
              </Link>
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
      )}

      {final && preview ? (
        <>
          <FinalDuels data={data} series={s} team1={final.team1} team2={final.team2} />
          <FinalPicks data={data} team1={final.team1} team2={final.team2} />
          <FinalDeeper team1={final.team1} team2={final.team2} />
          <Section
            collapsible
            defaultOpen={false}
            title="Every number"
            description="The full preview: tale of the tape, lane by lane, champions and head to head."
          >
            <SeriesPreview
              seriesId={s.id}
              live={s.status === "live"}
              teams={[data.teamsById.get(s.team1Id ?? ""), data.teamsById.get(s.team2Id ?? "")]}
            />
          </Section>
        </>
      ) : preview ? (
        <SeriesPreview
          seriesId={s.id}
          live={s.status === "live"}
          teams={[data.teamsById.get(s.team1Id ?? ""), data.teamsById.get(s.team2Id ?? "")]}
        />
      ) : null}

      {/* Once the preview (and its Full duel links) is gone, the duels stay one tap away. */}
      {!preview && !final && hasDuels(s) ? <DuelStrip series={s} /> : null}

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
          const sideName = (side: "blue" | "red") => (side === "blue" ? (blue?.name ?? "Blue") : (red?.name ?? "Red"));
          return (
            <Section
              key={g.id}
              id={`game-${g.gameNumber}`}
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
                {timelines.has(g.id) ? (
                  <GoldGraph
                    id={g.id}
                    timeline={timelines.get(g.id)!}
                    blue={blue}
                    red={red}
                    duration={g.durationSeconds}
                  />
                ) : null}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    {rows.length ? (
                      <GameTabs
                        id={g.id}
                        tabs={[
                          {
                            key: "stats",
                            label: "Stats",
                            panel: (["blue", "red"] as const).map((side) => (
                              <Scoreboard
                                key={side}
                                rows={rows.filter((r) => r.side === side)}
                                players={data.playersById}
                                icon={icon}
                                side={side}
                                teamName={sideName(side)}
                              />
                            )),
                          },
                          {
                            key: "builds",
                            label: "Builds",
                            panel: (["blue", "red"] as const).map((side) => (
                              <BuildTable
                                key={side}
                                rows={rows.filter((r) => r.side === side)}
                                players={data.playersById}
                                icon={icon}
                                loadout={loadout}
                                side={side}
                                teamName={sideName(side)}
                              />
                            )),
                          },
                          {
                            key: "runes",
                            label: "Runes",
                            panel: (["blue", "red"] as const).map((side) => (
                              <RunesTable
                                key={side}
                                rows={rows.filter((r) => r.side === side)}
                                players={data.playersById}
                                icon={icon}
                                loadout={loadout}
                                side={side}
                                teamName={sideName(side)}
                              />
                            )),
                          },
                        ]}
                      />
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

      {final && !preview ? (
        <>
          <FinalDuels data={data} series={s} team1={final.team1} team2={final.team2} />
          <FinalDeeper team1={final.team1} team2={final.team2} />
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Link href="/matches" className="underline hover:text-foreground">
          Back to all matches
        </Link>
      </p>
    </div>
  );
}
