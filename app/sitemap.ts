import type { MetadataRoute } from "next";
import { draftedChampions, getData } from "@/lib/data/load";
import { championSlug } from "@/lib/sources/ddragon";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const data = getData();
  const updated = new Date(data.meta.updatedAt);
  const url = (p: string) => `${site.url}${p}`;
  return [
    { url: url("/"), lastModified: updated, changeFrequency: "hourly", priority: 1 },
    { url: url("/tournament"), lastModified: updated, changeFrequency: "hourly", priority: 0.9 },
    { url: url("/matches"), lastModified: updated, changeFrequency: "hourly", priority: 0.9 },
    { url: url("/teams"), lastModified: updated, changeFrequency: "daily", priority: 0.8 },
    { url: url("/players"), lastModified: updated, changeFrequency: "daily", priority: 0.8 },
    { url: url("/champions"), lastModified: updated, changeFrequency: "daily", priority: 0.7 },
    { url: url("/charts"), lastModified: updated, changeFrequency: "daily", priority: 0.6 },
    { url: url("/compare"), lastModified: updated, changeFrequency: "daily", priority: 0.5 },
    { url: url("/about"), lastModified: updated, changeFrequency: "monthly", priority: 0.3 },
    { url: url("/privacy"), lastModified: updated, changeFrequency: "yearly", priority: 0.1 },
    { url: url("/imprint"), lastModified: updated, changeFrequency: "yearly", priority: 0.1 },
    ...data.series.map((s) => ({
      url: url(`/matches/${s.id}`),
      lastModified: updated,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...data.teams.map((t) => ({
      url: url(`/teams/${t.id}`),
      lastModified: updated,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...data.players.map((p) => ({
      url: url(`/players/${p.id}`),
      lastModified: updated,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...draftedChampions(data).map((c) => ({
      url: url(`/champions/${championSlug(c.id)}`),
      lastModified: updated,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
