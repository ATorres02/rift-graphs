/**
 * Site-wide configuration. Author and imprint details come from environment
 * variables so the repository holds no personal data.
 */
// NEXT_PUBLIC_* values are inlined into the browser bundle only when read as `process.env.NAME`
// literally; a dynamic lookup would stay undefined on the client.

export const site = {
  name: "Rift Graphs",
  tagline: "Visual stats for the 2026 World Championship",
  description:
    "Fan-made, free statistics site for the 2026 League of Legends World Championship: matches, teams, players, champions and drafts, built on Leaguepedia data.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  author: {
    name: process.env.NEXT_PUBLIC_AUTHOR_NAME || "Alex Torres",
    linkedin: process.env.NEXT_PUBLIC_AUTHOR_LINKEDIN ?? "",
    x: process.env.NEXT_PUBLIC_AUTHOR_X ?? "",
  },
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? "",
  /** Cloudflare Web Analytics beacon token (cookie-free). Empty = analytics off. */
  analytics: { cfBeaconToken: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "" },
  imprint: {
    name: process.env.NEXT_PUBLIC_IMPRINT_NAME ?? "",
    address: process.env.NEXT_PUBLIC_IMPRINT_ADDRESS ?? "",
    email: process.env.NEXT_PUBLIC_IMPRINT_EMAIL ?? "",
  },
  leaguepedia: {
    name: "Leaguepedia",
    url: "https://lol.fandom.com",
    license: "CC BY-SA",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  dataDragonUrl: "https://developer.riotgames.com/docs/lol#data-dragon",
  lolesportsUrl: "https://lolesports.com",
  riotLegalUrl: "https://www.riotgames.com/en/legal",
} as const;

/** "@handle" taken from the author's X profile URL, for the twitter:creator tag (undefined when unset). */
const xHandle = /(?:x|twitter)\.com\/(\w{1,15})/.exec(site.author.x)?.[1];
export const authorXHandle = xHandle ? `@${xHandle}` : undefined;

/** Default share image from the brand kit (pages with a generated opengraph-image override it). */
export const defaultOgImage = { url: "/og-image.png", width: 1200, height: 630, alt: site.name };

/**
 * Open Graph fields every page shares; `./` resolves to the page's own path, which gives each page its og:url.
 * A page that sets `openGraph` replaces the layout's object rather than merging it, so it spreads this first
 * (and leaves `images` out when it has an opengraph-image file: an explicit `images` would hide the file).
 */
export const baseOpenGraph = { siteName: site.name, type: "website", locale: "en_US", url: "./" } as const;

/** Mandatory notice (footer and About page), verbatim from Riot's policy. */
export const riotNotice = `${site.name} was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.`;
