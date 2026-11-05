/**
 * The whole game from the lolesports live stats feed, every 30 seconds of game time: gold, kills, towers, inhibitors,
 * barons and dragons of both teams, for the gold graph on series pages. About two feed requests per minute of game,
 * so results are kept in data/<tournament>/gold-timeline.json and only missing games are read. Fails soft.
 */
import type { Game, Series, Team } from "../data/types";
import { readTimeline, type GameTimeline } from "../sources/livestats";
import { fetchFeedGames, type FetchFeedOptions } from "./early";

/** Game id → the game's timeline, or why the feed gave none (kept so the game is not read again on every run). */
export type TimelineCache = Record<string, GameTimeline | { unavailable: string }>;

export const isTimeline = (v: GameTimeline | { unavailable: string } | undefined): v is GameTimeline =>
  !!v && "esportsGameId" in v;

export async function fetchTimelines(
  series: Series[],
  games: Game[],
  teams: Team[],
  cache: TimelineCache,
  options: FetchFeedOptions,
): Promise<{ cache: TimelineCache; read: number; failed: number }> {
  return fetchFeedGames(
    series,
    games,
    teams,
    cache,
    (id, reader, g) => readTimeline(id, reader, g.durationSeconds * 1000),
    { label: "gold timeline", ...options },
  );
}

/** The cache as written to disk: indented like the other data files, but each list of numbers on one line. */
export function timelineJson(cache: TimelineCache): string {
  return (
    JSON.stringify(cache, null, 2).replace(
      /\[\n\s+(-?\d[\d.]*(?:,\n\s+-?\d[\d.]*)*)\n\s+\]/g,
      (_, inner: string) => `[${inner.replace(/,\n\s+/g, ", ")}]`,
    ) + "\n"
  );
}
