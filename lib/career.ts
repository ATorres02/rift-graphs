/**
 * Career history of players and teams: which rows of Leaguepedia's TournamentResults count for the history, and which
 * of those are titles. Leaguepedia gives "place 1" to regular seasons, qualifiers and exhibition games too, so a title
 * is decided here and not by the place alone. Pure: no I/O.
 */
export type CareerTier = "worlds" | "msi" | "first-stand" | "ewc" | "league" | "other";

export interface CareerRow {
  event: string;
  date: string;
  place: string;
  /** The team's name at the time. */
  team: string;
  overviewPage: string;
  league: string | null;
  split: string | null;
  isOfficial: boolean | null;
  isPlayoffs: boolean | null;
  isQualifier: boolean | null;
  level: string | null;
}

export interface CareerEntry {
  event: string;
  date: string;
  place: string;
  team: string;
  tier: CareerTier;
  title: boolean;
}

const INTERNATIONAL: [RegExp, CareerTier][] = [
  [/^Worlds (\d{4}|Season \d)$/, "worlds"],
  [/^MSI \d{4}$/, "msi"],
  [/^First Stand \d{4}$/, "first-stand"],
  [/^Esports World Cup \d{4}$/, "ewc"],
];

const internationalTier = (event: string): CareerTier | null =>
  INTERNATIONAL.find(([re]) => re.test(event))?.[1] ?? null;

/** Stages that crown nobody even when a playoffs flag or a first place says otherwise. */
const NOT_A_TITLE = /Road to|Regional Finals|Qualifier|Qualifying|Promotion|Season Opening/i;

/** Competitions that crown a champion without a separate playoffs row. */
const SINGLE_STAGE_TITLE = /\bCup\b|Lock[- ]In|^Champions 201[34] /i;

/** Official events only: no invitationals, showmatches, qualifiers or the LCK's opening exhibition. */
export function inHistory(r: CareerRow): boolean {
  if (internationalTier(r.event)) return true;
  if (/Season Opening/i.test(r.event)) return false;
  return r.isOfficial === true && r.isQualifier !== true && r.level === "Primary";
}

export function isTitle(r: CareerRow): boolean {
  if (r.place !== "1" || !inHistory(r) || NOT_A_TITLE.test(r.event)) return false;
  if (internationalTier(r.event)) return true;
  if (!r.league || /Rift Rivals/i.test(r.event)) return false;
  return r.isPlayoffs === true || SINGLE_STAGE_TITLE.test(r.event);
}

const seasonKey = (r: CareerRow) => `${r.league}|${r.date.slice(0, 4)}|${r.split}`;

/**
 * One entry per competition, newest first. A regular season goes when the same split has a playoffs row, or every
 * split would be listed twice; the best place stands if a tournament has several rows.
 */
export function buildCareer(rows: CareerRow[]): CareerEntry[] {
  const kept = rows.filter(inHistory);
  const withPlayoffs = new Set(kept.filter((r) => r.isPlayoffs && r.split).map(seasonKey));
  const byEvent = new Map<string, CareerRow>();
  for (const r of kept) {
    if (!r.isPlayoffs && r.split && r.league && withPlayoffs.has(seasonKey(r))) continue;
    const seen = byEvent.get(r.event);
    if (!seen || parseInt(r.place, 10) < parseInt(seen.place, 10)) byEvent.set(r.event, r);
  }
  return [...byEvent.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.event.localeCompare(b.event))
    .map((r) => ({
      event: r.event,
      date: r.date,
      place: r.place,
      team: r.team,
      tier: internationalTier(r.event) ?? (r.league ? "league" : "other"),
      title: isTitle(r),
    }));
}

const ordinal = (n: string) => {
  const v = Number(n);
  const tens = v % 100;
  return `${n}${tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][v % 10] ?? "th")}`;
};

/** "1" gives "1st", "5-8" gives "5th-8th"; Leaguepedia's Q and NQ are the outcomes of a qualifying stage. */
export function placeLabel(place: string): string {
  if (place === "Q") return "Qualified";
  if (place === "NQ") return "Not qualified";
  return place.split("-").map(ordinal).join("-");
}
