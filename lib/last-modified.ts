/**
 * When each page last changed, for the sitemap: the end of the latest game it shows. A sitemap where every URL carries
 * the time of the last ingest tells search engines nothing, and they end up ignoring it; real dates point them at the
 * pages that did change (the series being played, its teams and players).
 */
import type { IndexedDataset } from "@/lib/data/load";
import type { Game, Series } from "@/lib/data/types";
import { gamesBefore } from "@/lib/duels";

/** When a game ended: its start (or its series' start) plus its length; null without a start. */
export function gameEnd(data: IndexedDataset, g: Game): number | null {
  const start = g.dateTimeUtc ?? data.seriesById.get(g.seriesId)?.dateTimeUtc;
  return start ? Date.parse(start) + g.durationSeconds * 1000 : null;
}

function latest(data: IndexedDataset, games: Game[]): Date | null {
  const ends = games.map((g) => gameEnd(data, g)).filter((t): t is number => t !== null);
  return ends.length ? new Date(Math.max(...ends)) : null;
}

export function lastModifiedDates(data: IndexedDataset) {
  const fallback = new Date(data.meta.updatedAt);
  const overall = latest(data, data.games) ?? fallback;
  const gamesById = new Map(data.games.map((g) => [g.id, g]));
  const ofRows = (rows: { gameId: string }[] | undefined) =>
    latest(
      data,
      (rows ?? []).flatMap((r) => (gamesById.has(r.gameId) ? [gamesById.get(r.gameId)!] : [])),
    );
  return {
    /** Pages that sum up the whole tournament change with every game. */
    overall,
    /** A played series changes with its own games; one to come changes with every game (its preview). */
    series: (s: Series) => latest(data, data.gamesBySeries.get(s.id) ?? []) ?? overall,
    /** A duel uses the games before its series, so it stops changing once the series starts. */
    duel: (s: Series) => (s.status === "scheduled" ? overall : (latest(data, gamesBefore(data, s)) ?? overall)),
    team: (id: string) => ofRows(data.playerGamesByTeam.get(id)) ?? overall,
    player: (id: string) => ofRows(data.playerGamesByPlayer.get(id)) ?? overall,
  };
}
