import type { StageId } from "@/lib/data/types";

/**
 * JSON-LD helpers.
 *
 * `JSON.stringify` leaves `<` untouched, so a dataset string containing
 * `</script>` would close the `application/ld+json` block and the rest would be
 * parsed as HTML. Escaping `<` as `\u003c` keeps the JSON valid and inert.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export interface Venue {
  name: string;
  locality: string;
  region: string;
  country: string;
}

/**
 * Where each stage is played, from lolesports.com ("MSI and Worlds", 22 Mar 2026, the Play-In moved to Los Angeles
 * that day): Google wants a location for every event.
 */
export const STAGE_VENUE: Record<StageId, Venue> = {
  playin: { name: "Riot Games Arena", locality: "Los Angeles", region: "CA", country: "US" },
  swiss: { name: "Credit Union of Texas Event Center", locality: "Allen", region: "TX", country: "US" },
  quarterfinals: { name: "Credit Union of Texas Event Center", locality: "Allen", region: "TX", country: "US" },
  semifinals: { name: "Credit Union of Texas Event Center", locality: "Allen", region: "TX", country: "US" },
  final: { name: "Barclays Center", locality: "Brooklyn", region: "NY", country: "US" },
};

/** "Barclays Center, Brooklyn": a venue as it reads in a sentence. */
export const venueLabel = (v: Venue) => `${v.name}, ${v.locality}`;

const STATE: Record<string, string> = { CA: "California", TX: "Texas", NY: "New York" };

/** "Allen, Texas": the town, for text that must stay short (descriptions in search results). */
export const venueTown = (v: Venue) => `${v.locality}, ${STATE[v.region] ?? v.region}`;

export interface SeriesEventInput {
  name: string;
  description: string;
  url: string;
  image: string;
  startDate: string;
  stage: StageId;
  competitors: string[];
  /** Where it can be watched online. */
  streamUrl: string;
}

/** SportsEvent for a series page: held at the venue and streamed, with both teams once they are known. */
export function seriesEventJsonLd(e: SeriesEventInput) {
  const v = STAGE_VENUE[e.stage];
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: e.name,
    description: e.description,
    url: e.url,
    image: [e.image],
    startDate: e.startDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    location: [
      {
        "@type": "Place",
        name: v.name,
        address: {
          "@type": "PostalAddress",
          addressLocality: v.locality,
          addressRegion: v.region,
          addressCountry: v.country,
        },
      },
      { "@type": "VirtualLocation", url: e.streamUrl },
    ],
    sport: "League of Legends",
    ...(e.competitors.length ? { competitor: e.competitors.map((name) => ({ "@type": "SportsTeam", name })) } : {}),
    organizer: { "@type": "Organization", name: "Riot Games", url: "https://lolesports.com" },
  };
}

export interface Crumb {
  label: string;
  /** Site path; the current page goes last, without one. */
  href?: string;
}

/** BreadcrumbList for the trail a page shows; `base` is the site's origin. */
export function breadcrumbJsonLd(crumbs: Crumb[], base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, base).toString() } : {}),
    })),
  };
}
