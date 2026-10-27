import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartBuilder } from "@/components/charts/builder/chart-builder";
import { PageHeader } from "@/components/page-header";
import { autoTitle } from "@/lib/charts/build";
import { parseConfig, serializeConfig } from "@/lib/charts/url";
import { getData, teamRef } from "@/lib/data/load";
import { runQuery } from "@/lib/query";
import { site } from "@/lib/site";

type SearchParams = Record<string, string | string[] | undefined>;

function toParams(sp: SearchParams): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  return p;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = toParams(await searchParams);
  const base = { title: "Chart builder", description: "Build your own chart from the tournament data: pick a measure, group, filter, choose a chart type and share the link." };
  if (![...params.keys()].length) return base;
  const data = getData();
  const config = parseConfig(params);
  const result = runQuery(config, data);
  const title = config.title?.trim() || autoTitle(result);
  const qs = serializeConfig(config);
  return {
    title,
    description: `${title} · ${site.name}, stats from Leaguepedia.`,
    openGraph: { title, description: `Chart built on ${site.name}`, images: [{ url: `/api/og/chart?${qs}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [`/api/og/chart?${qs}`] },
  };
}

export default function ChartsPage() {
  const data = getData();
  const champions = new Set<string>();
  for (const g of data.games) for (const side of ["blue", "red"] as const) for (const c of [...g[side].picks, ...g[side].bans]) champions.add(c);
  const catalog = {
    teams: data.teams.map((t) => teamRef(t)!).sort((a, b) => a.short.localeCompare(b.short)),
    regions: Array.from(new Set(data.teams.map((t) => t.region))).sort(),
    champions: Array.from(champions).sort(),
    stages: data.tournament.stages.map((s) => s.id),
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Chart builder" description="Pick the data, a measure, how to group it and a chart type. The chart updates instantly and the link reproduces it anywhere." />
      <Suspense>
        <ChartBuilder version={data.meta.updatedAt} catalog={catalog} />
      </Suspense>
    </div>
  );
}
