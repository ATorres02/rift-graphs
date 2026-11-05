import type { MetadataRoute } from "next";
import { draftedChampions, getData } from "@/lib/data/load";
import { championSlug } from "@/lib/sources/ddragon";
import { site } from "@/lib/site";
import { UPDATES } from "@/lib/updates";
import { duelHref, duelSeries } from "@/lib/duels";
import { lastModifiedDates } from "@/lib/last-modified";
import { ROLES } from "@/lib/metrics";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const data = getData();
  const when = lastModifiedDates(data);
  const updated = when.overall;
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
    {
      url: url("/updates"),
      lastModified: new Date(`${UPDATES[0].date}T00:00:00Z`),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    { url: url("/imprint"), changeFrequency: "yearly", priority: 0.1 },
    ...data.series.map((s) => ({
      url: url(`/matches/${s.id}`),
      lastModified: when.series(s),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...duelSeries(data).flatMap((s) =>
      ROLES.map((role) => ({
        url: url(duelHref(s.id, role)),
        lastModified: when.duel(s),
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
    ),
    ...data.teams.map((t) => ({
      url: url(`/teams/${t.id}`),
      lastModified: when.team(t.id),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...data.players.map((p) => ({
      url: url(`/players/${p.id}`),
      lastModified: when.player(p.id),
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
