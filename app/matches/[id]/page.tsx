import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { CompareBars } from "@/components/match/compare-bars";
import { DraftBoard } from "@/components/match/draft-board";
import { Scoreboard } from "@/components/match/scoreboard";
import { PageHeader, Section } from "@/components/page-header";
import { PendingData } from "@/components/pending-data";
import { StatusLabel } from "@/components/series-card";
import { Spoiler } from "@/components/spoilers";
import { TeamPill } from "@/components/team-pill";
import { getData, seriesHasPendingGames, seriesTeams, teamRef } from "@/lib/data/load";
import { lockedChampionsBefore } from "@/lib/draft";
import { bestOfLabel, fmt, roundLabel, STAGE_LABEL } from "@/lib/format";
import { site } from "@/lib/site";
import { champIcon } from "@/lib/views";

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
    openGraph: { title: `${title} · ${STAGE_LABEL[s.stage]}` },
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${team1?.name ?? "TBD"} vs ${team2?.name ?? "TBD"} · ${roundLabel(s.stage, s.round, s.tab)}`,
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
        eyebrow={`${roundLabel(s.stage, s.round, s.tab)} · ${bestOfLabel(s.bestOf)}${s.patch ? ` · Patch ${s.patch}` : ""}`}
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
          <a href={data.tournament.officialUrl ?? site.lolesportsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
            Watch on lolesports.com <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
          {s.streamUrl ? (
            <a href={s.streamUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
              Stream <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </PageHeader>

      {games.length === 0 && s.status === "scheduled" ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">This series has not started. Game data appears here once Leaguepedia publishes the scoreboards.</p>
      ) : null}

      {games.map((g) => {
        const blue = teamRef(data.teamsById.get(g.blue.teamId));
        const red = teamRef(data.teamsById.get(g.red.teamId));
        const rows = data.playerGamesByGame.get(g.id) ?? [];
        const draft = data.draftsByGame.get(g.id);
        const winner = g.winnerSide === "blue" ? blue : red;
        const dmg = (side: "blue" | "red") => rows.filter((r) => r.side === side).reduce((a, r) => a + r.damageToChampions, 0);
        return (
          <Section
            key={g.id}
            title={`Game ${g.gameNumber}`}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Duration {fmt.duration(g.durationSeconds)}</span>
                {g.dateTimeUtc ? <LocalTime iso={g.dateTimeUtc} mode="time" /> : null}
                <Spoiler label="Reveal winner">
                  <span className="inline-flex items-center gap-1.5">
                    Winner <TeamPill team={winner} size="sm" /> ({g.winnerSide} side)
                  </span>
                </Spoiler>
                {g.vodUrl ? (
                  <a href={g.vodUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
                    VOD <ExternalLinkIcon className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </span>
            }
          >
            <Spoiler as="div" label={`Reveal game ${g.gameNumber}`} className="block space-y-4">
              {draft ? (
                <DraftBoard draft={draft} blue={blue} red={red} icon={icon} locked={s.bestOf > 1 ? lockedChampionsBefore(games, g.gameNumber) : []} />
              ) : (
                <p className="text-sm text-muted-foreground">Draft order not published yet.</p>
              )}
              <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <Scoreboard rows={rows.filter((r) => r.side === "blue")} players={data.playersById} icon={icon} side="blue" teamName={blue?.name ?? "Blue"} />
                  <Scoreboard rows={rows.filter((r) => r.side === "red")} players={data.playersById} icon={icon} side="red" teamName={red?.name ?? "Red"} />
                </div>
                <CompareBars
                  blueName={blue?.short ?? "Blue"}
                  redName={red?.short ?? "Red"}
                  metrics={[
                    { label: "Kills", blue: g.blue.kills, red: g.red.kills },
                    { label: "Gold", blue: g.blue.gold, red: g.red.gold, format: fmt.compact },
                    { label: "Damage to champions", blue: dmg("blue"), red: dmg("red"), format: fmt.compact },
                    { label: "Towers", blue: g.blue.towers, red: g.red.towers },
                    { label: "Inhibitors", blue: g.blue.inhibitors, red: g.red.inhibitors },
                    { label: "Dragons", blue: g.blue.dragons, red: g.red.dragons },
                    { label: "Elder dragons", blue: g.blue.elders, red: g.red.elders },
                    { label: "Barons", blue: g.blue.barons, red: g.red.barons },
                    { label: "Rift Heralds", blue: g.blue.heralds, red: g.red.heralds },
                    { label: "Void grubs", blue: g.blue.voidGrubs, red: g.red.voidGrubs },
                    ...(g.blue.atakhans !== null && g.red.atakhans !== null ? [{ label: "Atakhan", blue: g.blue.atakhans, red: g.red.atakhans }] : []),
                  ]}
                />
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

      <p className="text-sm text-muted-foreground">
        <Link href="/matches" className="underline hover:text-foreground">
          Back to all matches
        </Link>
      </p>
    </div>
  );
}
