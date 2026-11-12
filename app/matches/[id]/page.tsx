import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesPage } from "@/components/match/series-page";
import { getData, seriesTeams } from "@/lib/data/load";
import { STAGE_VENUE, venueTown } from "@/lib/jsonld";
import { bestOfLabel } from "@/lib/format";
import { seriesNumberInStage, seriesTitleLabel, weekdayDate } from "@/lib/series-labels";
import { hasDuels } from "@/lib/duels";
import { previewRound, showsPreview } from "@/lib/preview";
import { baseOpenGraph } from "@/lib/site";

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
  const s = getData().seriesById.get(id);
  if (!s) notFound();
  return <SeriesPage series={s} />;
}
