import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Saved views of the chart builder, Compare and the match filters: hundreds of URLs that all canonicalise to a
      // page already in the sitemap. Search crawlers only, so link previews of a shared chart keep working.
      { userAgent: ["Googlebot", "Bingbot"], allow: "/", disallow: ["/charts?", "/compare?", "/matches?"] },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
