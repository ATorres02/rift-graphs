import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartBuilder } from "@/components/charts/builder/chart-builder";
import { PageHeader } from "@/components/page-header";
import { ProvisionalNote } from "@/components/provisional";
import { getData, teamRef } from "@/lib/data/load";

const description =
  "Build your own chart from the tournament data: pick a measure, group, filter, choose a chart type and share the link.";

/**
 * Static metadata: the site is a static export, so the chart described by the
 * query string is rendered in the browser and the link preview is the fixed
 * image in `opengraph-image.tsx`.
 */
export const metadata: Metadata = {
  title: "Chart builder",
  description,
  openGraph: { title: "Chart builder", description },
  twitter: { card: "summary_large_image", title: "Chart builder", description },
};

export default function ChartsPage() {
  const data = getData();
  const champions = new Set<string>();
  for (const g of data.confirmedGames)
    for (const side of ["blue", "red"] as const) for (const c of [...g[side].picks, ...g[side].bans]) champions.add(c);
  const catalog = {
    teams: data.teams.map((t) => teamRef(t)!).sort((a, b) => a.short.localeCompare(b.short)),
    regions: Array.from(new Set(data.teams.map((t) => t.region))).sort(),
    champions: Array.from(champions).sort(),
    stages: data.tournament.stages.map((s) => s.id),
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart builder"
        description="Pick the data, a measure, how to group it and a chart type. The chart updates instantly and the link reproduces it anywhere."
      />
      <ProvisionalNote meta={data.meta} />
      <Suspense>
        <ChartBuilder version={data.meta.updatedAt} catalog={catalog} />
      </Suspense>
    </div>
  );
}
