/**
 * Server-side helpers that turn dataset rows into small, serialisable view
 * models for client components.
 */
import type { ChampionIconRef } from "@/components/champion-icon";
import type { PlayerCell } from "@/components/data-table";
import { championRef, seriesHasPendingGames, seriesTeams, type IndexedDataset, type TeamRef } from "@/lib/data/load";
import type { Player, Series } from "@/lib/data/types";
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
