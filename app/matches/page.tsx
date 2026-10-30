import type { Metadata } from "next";
import { MatchList } from "@/components/match-list";
import { PageHeader } from "@/components/page-header";
import { getData, teamRef } from "@/lib/data/load";
import { seriesView } from "@/lib/views";

export const metadata: Metadata = {
  title: "Worlds 2026 schedule and results",
  description:
    "Schedule and results of every series of the 2026 World Championship, from the Play-In to the final, with local start times, scores and links to full game data.",
};

export default function MatchesPage() {
  const data = getData();
  const views = data.series.map((s) => seriesView(data, s));
  const teams = data.teams.map((t) => teamRef(t)!).sort((a, b) => a.name.localeCompare(b.name));
  const stages = data.tournament.stages.map((s) => s.id);
  return (
    <div>
      <PageHeader
        title="Matches"
        description="Every series of the tournament, grouped by day in your time zone. Scores stay hidden while spoiler mode is on."
      />
      <MatchList views={views} teams={teams} stages={stages} />
    </div>
  );
}
