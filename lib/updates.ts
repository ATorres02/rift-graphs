/**
 * What changed on the site, newest first. The /updates page and the homepage's latest-update bar read this list.
 * Every change to the site adds its entry here in the same pull request. Features only: the data refreshes after
 * every game on its own, so that is not an update, and no entry may give away a result.
 */
export type UpdateKind = "new" | "improved" | "fixed";

export interface SiteUpdate {
  /** Anchor on /updates. Keep it once published: links to it may be out there. */
  id: string;
  /** Day it went live, YYYY-MM-DD (UTC). */
  date: string;
  kind: UpdateKind;
  title: string;
  summary: string;
  items?: string[];
  link?: { href: string; label: string };
}

export const UPDATE_KIND_LABEL: Record<UpdateKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };

export const UPDATES: SiteUpdate[] = [
  {
    id: "lane-duels",
    date: "2026-11-05",
    kind: "new",
    title: "Lane duels",
    summary:
      "A page for each lane of every knockout series: the two players side by side, with their numbers from the games before the series.",
    items: [
      "KDA, damage, gold, CS and vision, against the best and the average in the role.",
      "Every champion each one played, and the games they already met in lane.",
      "Open them from any knockout series page. Each duel has its own card for sharing.",
    ],
    link: { href: "/matches", label: "Matches" },
  },
  {
    id: "updates-page",
    date: "2026-11-05",
    kind: "new",
    title: "Site updates",
    summary: "A log of what changes on the site, newest first, with the latest change on the homepage for a week.",
  },
  {
    id: "new-homepage",
    date: "2026-11-03",
    kind: "improved",
    title: "A new homepage",
    summary:
      "Three parts: the next series and the chart builder side by side, then the bracket, then the leaders and charts.",
    items: [
      "The leaders sit side by side on a wide screen and in tabs on a phone.",
      "The charts come with the builder's templates as shortcuts.",
    ],
    link: { href: "/", label: "Homepage" },
  },
  {
    id: "early-game",
    date: "2026-11-03",
    kind: "new",
    title: "First blood and gold at 15",
    summary:
      "First blood, and gold and CS at 15 minutes for every team and player, read from the live stats of lolesports.com after each game.",
    items: [
      "In series previews, in Compare and in the new Early game group of Charts.",
      "The 15 minutes are game time: pauses are taken out.",
    ],
    link: { href: "/charts", label: "Open Charts" },
  },
  {
    id: "series-previews",
    date: "2026-11-03",
    kind: "new",
    title: "Series previews",
    summary:
      "A series that has not started shows how both teams compare: Tale of the tape, the five lane match-ups and each team's champions.",
    items: ["Every block opens in Charts.", "Only confirmed games count."],
    link: { href: "/matches", label: "Matches" },
  },
  {
    id: "charts-compare",
    date: "2026-11-02",
    kind: "new",
    title: "Compare any number in Charts",
    summary: "Pick as many players, teams or champions as you like in step 3 of the chart builder.",
    items: [
      "Radars take up to 12: all on one radar or one radar each, with the average dashed on every one.",
      "Every entry gets its own colour, and there is a new template: Top laners side by side.",
      "Phones can save a chart as a PNG.",
    ],
    link: { href: "/charts", label: "Open Charts" },
  },
  {
    id: "charts-homepage",
    date: "2026-10-30",
    kind: "new",
    title: "Charts on the homepage",
    summary:
      "Three small charts and the leaders in KDA, damage per minute and kill participation, each one opening in the chart builder.",
    items: ["A faster homepage: its art is now served by the site itself."],
    link: { href: "/charts", label: "Open Charts" },
  },
  {
    id: "brackets",
    date: "2026-10-30",
    kind: "new",
    title: "Brackets and team logos",
    summary:
      "The Swiss stage and the knockout bracket, drawn round by round with every series linked. The homepage shows the stage being played.",
    items: [
      "Team logos across the site.",
      "Open in Charts under every chart on the site.",
      "Compare teams from every series page.",
    ],
    link: { href: "/tournament", label: "Tournament" },
  },
  {
    id: "launch",
    date: "2026-10-28",
    kind: "new",
    title: "Rift Graphs is live",
    summary: "Free stats for the 2026 World Championship, refreshed within minutes of every game.",
    items: [
      "Matches in your time zone, with drafts and scoreboards.",
      "A page for every team, player and champion.",
      "A chart builder to make your own charts, and Compare for two players or teams.",
      "Spoiler mode for anyone watching later.",
    ],
    link: { href: "/", label: "Homepage" },
  },
];

const DAY = 86_400_000;

/** The newest update, through the `maxAgeDays`th day after the day it went live (UTC); null once older. */
export function latestUpdate(now: Date = new Date(), maxAgeDays = 7, updates = UPDATES): SiteUpdate | null {
  const u = updates[0];
  if (!u) return null;
  return now.getTime() - Date.parse(`${u.date}T00:00:00Z`) <= (maxAgeDays + 1) * DAY ? u : null;
}

/** Updates grouped by day, newest day first, keeping the list's order inside each day. */
export function updatesByDay(updates = UPDATES): { date: string; updates: SiteUpdate[] }[] {
  const days: { date: string; updates: SiteUpdate[] }[] = [];
  for (const u of updates) {
    const last = days[days.length - 1];
    if (last?.date === u.date) last.updates.push(u);
    else days.push({ date: u.date, updates: [u] });
  }
  return days;
}
