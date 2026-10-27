/**
 * Site-wide configuration. Author and imprint details come from environment
 * variables so the repository holds no personal data.
 */
const env = (key: string, fallback = ""): string => process.env[key] ?? fallback;

export const site = {
  name: "Rift Ledger",
  tagline: "Visual stats for the 2026 World Championship",
  description:
    "Fan-made, free statistics site for the 2026 League of Legends World Championship: matches, teams, players, champions and drafts, built on Leaguepedia data.",
  url: env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  author: {
    name: env("NEXT_PUBLIC_AUTHOR_NAME", "Unstable Devs"),
    linkedin: env("NEXT_PUBLIC_AUTHOR_LINKEDIN"),
  },
  repoUrl: env("NEXT_PUBLIC_REPO_URL"),
  imprint: {
    name: env("NEXT_PUBLIC_IMPRINT_NAME"),
    address: env("NEXT_PUBLIC_IMPRINT_ADDRESS"),
    email: env("NEXT_PUBLIC_IMPRINT_EMAIL"),
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

/** Mandatory notice (footer and About page), verbatim from Riot's policy. */
export const riotNotice = `${site.name} was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.`;
