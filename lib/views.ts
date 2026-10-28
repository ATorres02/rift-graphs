/**
 * Server-side helpers that turn dataset rows into small, serialisable view
 * models for client components.
 */
import type { ChampionIconRef } from "@/components/champion-icon";
import type { PlayerCell } from "@/components/data-table";
import { championRef, seriesHasPendingGames, seriesTeams, type IndexedDataset, type TeamRef } from "@/lib/data/load";
import type { ArtRef } from "@/components/art-backdrop";
import type { Game, Player, PlayerGame, Series } from "@/lib/data/types";
import { regionInfo } from "@/lib/data/regions";

export function champIcon(data: IndexedDataset, name: string): ChampionIconRef {
  const ref = championRef(data, name);
  return { name, ddragonId: ref?.id ?? null, version: data.champions.version };
}

export function playerCell(p: Player): PlayerCell {
  return { id: p.id, name: p.name };
}

export interface SeriesView {
  series: Series;
  team1: TeamRef | null;
  team2: TeamRef | null;
  pending: boolean;
}

export function seriesView(data: IndexedDataset, s: Series): SeriesView {
  return { series: s, ...seriesTeams(data, s), pending: seriesHasPendingGames(s) };
}

/** Art of the champion that appears most in the given rows (team, player), for header backdrops. */
export function mostPlayedArt(data: IndexedDataset, rows: PlayerGame[]): ArtRef | null {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.champion, (counts.get(r.champion) ?? 0) + 1);
  const top = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const ref = top ? championRef(data, top) : null;
  return ref ? { ddragonId: ref.id } : null;
}

/** Art for a series header: the MVP's champion in the last game when known, else the most played champion of the series. */
export function seriesArt(data: IndexedDataset, s: Series, games: Game[]): ArtRef | null {
  const rows = games.flatMap((g) => data.playerGamesByGame.get(g.id) ?? []);
  if (s.mvp) {
    const last = games[games.length - 1];
    const mvpRow = rows.find((r) => r.gameId === last?.id && data.playersById.get(r.playerId)?.name === s.mvp);
    const ref = mvpRow ? championRef(data, mvpRow.champion) : null;
    if (ref) return { ddragonId: ref.id };
  }
  return mostPlayedArt(data, rows);
}

/** CSS colour for a region, usable in charts. */
export function regionColorVar(region: string): string {
  return `var(${regionInfo(region).cssVar})`;
}

export function playerLabel(data: IndexedDataset, playerId: string): string {
  const p = data.playersById.get(playerId);
  if (!p) return playerId;
  const t = data.teamsById.get(p.teamId);
  return t ? `${p.name} (${t.short})` : p.name;
}
