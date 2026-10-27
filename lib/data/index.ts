/**
 * Dataset indexing shared by the server loader and the browser (chart builder).
 * Pure: no file system access.
 */
import type { ChampionRef, Dataset, Draft, Game, Player, PlayerGame, Series, Team } from "./types";
import { normalizeChampionName } from "@/lib/sources/ddragon";

export interface IndexedDataset extends Dataset {
  teamsById: Map<string, Team>;
  playersById: Map<string, Player>;
  seriesById: Map<string, Series>;
  gamesById: Map<string, Game>;
  gamesBySeries: Map<string, Game[]>;
  draftsByGame: Map<string, Draft>;
  playerGamesByGame: Map<string, PlayerGame[]>;
  playerGamesByPlayer: Map<string, PlayerGame[]>;
  playerGamesByTeam: Map<string, PlayerGame[]>;
  seriesByTeam: Map<string, Series[]>;
  championByName: Map<string, ChampionRef>;
}

export function groupInto<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

export function indexDataset(dataset: Dataset): IndexedDataset {
  const gamesBySeries = groupInto(dataset.games, (g) => g.seriesId);
  for (const list of gamesBySeries.values()) list.sort((a, b) => a.gameNumber - b.gameNumber);
  const seriesByTeam = new Map<string, Series[]>();
  for (const s of dataset.series) {
    for (const id of [s.team1Id, s.team2Id]) {
      if (!id) continue;
      const list = seriesByTeam.get(id);
      if (list) list.push(s);
      else seriesByTeam.set(id, [s]);
    }
  }
  return {
    ...dataset,
    teamsById: new Map(dataset.teams.map((t) => [t.id, t])),
    playersById: new Map(dataset.players.map((p) => [p.id, p])),
    seriesById: new Map(dataset.series.map((s) => [s.id, s])),
    gamesById: new Map(dataset.games.map((g) => [g.id, g])),
    gamesBySeries,
    draftsByGame: new Map(dataset.drafts.map((d) => [d.gameId, d])),
    playerGamesByGame: groupInto(dataset.playerGames, (r) => r.gameId),
    playerGamesByPlayer: groupInto(dataset.playerGames, (r) => r.playerId),
    playerGamesByTeam: groupInto(dataset.playerGames, (r) => r.teamId),
    seriesByTeam,
    championByName: new Map(dataset.champions.champions.map((c) => [normalizeChampionName(c.name), c])),
  };
}
