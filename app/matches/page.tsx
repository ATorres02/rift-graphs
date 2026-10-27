import type { Metadata } from "next";
import { Suspense } from "react";
import { MatchList } from "@/components/match-list";
import { PageHeader } from "@/components/page-header";
import { getData, teamRef } from "@/lib/data/load";
import { seriesView } from "@/lib/views";

export const metadata: Metadata = {
  title: "Matches",
  description: "Every series of the 2026 World Championship with local times, scores and links to full game data.",
};

export default function MatchesPage() {
  const data = getData();
  const views = data.series.map((s) => seriesView(data, s));
  const teams = data.teams.map((t) => teamRef(t)!).sort((a, b) => a.name.localeCompare(b.name));
  const stages = data.tournament.stages.map((s) => s.id);
  return (
    <div>
      <PageHeader title="Matches" description="Every series of the tournament, grouped by day in your time zone. Scores stay hidden while spoiler mode is on." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading schedule…</p>}>
        <MatchList views={views} teams={teams} stages={stages} />
      </Suspense>
    </div>
  );
}
