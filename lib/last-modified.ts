/**
 * When each page last changed, for the sitemap: the end of the latest game it shows. A sitemap where every URL carries
 * the time of the last ingest tells search engines nothing, and they end up ignoring it; real dates point them at the
 * pages that did change (the series being played, its teams and players).
 */
import type { IndexedDataset } from "@/lib/data/load";
import type { Game, Series } from "@/lib/data/types";
import { gamesBefore } from "@/lib/duels";
import { normalizeChampionName } from "@/lib/sources/ddragon";

/** When a game ended: its start (or its series' start) plus its length; null without a start. */
export function gameEnd(data: IndexedDataset, g: Game): number | null {
  const start = g.dateTimeUtc ?? data.seriesById.get(g.seriesId)?.dateTimeUtc;
  return start ? Date.parse(start) + g.durationSeconds * 1000 : null;
}

function latest(data: IndexedDataset, games: Game[]): Date | null {
  const ends = games.map((g) => gameEnd(data, g)).filter((t): t is number => t !== null);
  return ends.length ? new Date(Math.max(...ends)) : null;
}

/**
 * When the player and team pages last changed for everyone, whatever their games: trophies and history, new titles and
 * descriptions. Move it only when a release really changes all of those pages, or the dates stop meaning anything.
 */
export const PROFILES_CHANGED = new Date("2026-11-09T12:25:22Z");

/** The same for champion pages (build titles and pro builds, PR #17). */
export const CHAMPIONS_CHANGED = new Date("2026-11-05T15:48:10Z");

export function lastModifiedDates(
  data: IndexedDataset,
  profilesChanged: Date = PROFILES_CHANGED,
  championsChanged: Date = CHAMPIONS_CHANGED,
) {
  const fallback = new Date(data.meta.updatedAt);
  const overall = latest(data, data.games) ?? fallback;
  const gamesById = new Map(data.games.map((g) => [g.id, g]));
  const ofRows = (rows: { gameId: string }[] | undefined) =>
    latest(
      data,
      (rows ?? []).flatMap((r) => (gamesById.has(r.gameId) ? [gamesById.get(r.gameId)!] : [])),
    );
  const profile = (d: Date) => (d > profilesChanged ? d : profilesChanged);
  return {
    /** Pages that sum up the whole tournament change with every game. */
    overall,
    /** A played series changes with its own games; one to come changes with every game (its preview). */
    series: (s: Series) => latest(data, data.gamesBySeries.get(s.id) ?? []) ?? overall,
    /** A duel uses the games before its series, so it stops changing once the series starts. */
    duel: (s: Series) => (s.status === "scheduled" ? overall : (latest(data, gamesBefore(data, s)) ?? overall)),
    team: (id: string) => profile(ofRows(data.playerGamesByTeam.get(id)) ?? overall),
    player: (id: string) => profile(ofRows(data.playerGamesByPlayer.get(id)) ?? overall),
    /** A champion page changes when the champion is picked or banned, not with every game of the tournament. */
    champion: (name: string) => {
      const key = normalizeChampionName(name);
      const drafted = data.confirmedGames.filter((g) =>
        [...g.blue.picks, ...g.blue.bans, ...g.red.picks, ...g.red.bans].some((n) => normalizeChampionName(n) === key),
      );
      const date = latest(data, drafted) ?? overall;
      return date > championsChanged ? date : championsChanged;
    },
  };
}
