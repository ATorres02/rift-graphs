import { readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { datasetFiles, type DatasetFileName } from "./schema";
import type { ChampionRef, Dataset, Draft, Game, Player, PlayerGame, Series, Team } from "./types";
import { normalizeChampionName } from "@/lib/sources/ddragon";

export const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "worlds-2026";

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

function readJson<K extends DatasetFileName>(dir: string, file: K): ReturnType<(typeof datasetFiles)[K]["parse"]> {
  const raw = readFileSync(path.join(dir, file), "utf8");
  return datasetFiles[file].parse(JSON.parse(raw)) as ReturnType<(typeof datasetFiles)[K]["parse"]>;
}

function groupInto<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

let memo: IndexedDataset | null = null;

function load(): IndexedDataset {
  if (memo) return memo;
  const dir = path.join(process.cwd(), "data", TOURNAMENT_ID);
  const dataset: Dataset = {
    meta: readJson(dir, "meta.json"),
    tournament: readJson(dir, "tournament.json"),
    teams: readJson(dir, "teams.json"),
    players: readJson(dir, "players.json"),
    series: readJson(dir, "series.json"),
    games: readJson(dir, "games.json"),
    drafts: readJson(dir, "drafts.json"),
    playerGames: readJson(dir, "player-games.json"),
    champions: readJson(dir, "champions.json"),
  };
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
  memo = {
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
  return memo;
}

/** Loads and indexes the tournament dataset once per build/request. */
export const getData = cache(load);

export function championRef(data: IndexedDataset, name: string): ChampionRef | null {
  return data.championByName.get(normalizeChampionName(name)) ?? null;
}

/** Minimal team shape for client components (keeps RSC payloads small). */
export interface TeamRef {
  id: string;
  name: string;
  short: string;
  region: string;
}

export function teamRef(team: Team | null | undefined): TeamRef | null {
  return team ? { id: team.id, name: team.name, short: team.short, region: team.region } : null;
}

export function seriesTeams(data: IndexedDataset, s: Series): { team1: TeamRef | null; team2: TeamRef | null } {
  return {
    team1: teamRef(s.team1Id ? data.teamsById.get(s.team1Id) : null),
    team2: teamRef(s.team2Id ? data.teamsById.get(s.team2Id) : null),
  };
}

/** Series the dataset reports as played but for which scoreboard data is still missing. */
export function seriesHasPendingGames(s: Series): boolean {
  return s.status !== "scheduled" && s.gameIds.length < s.gamesPlayed;
}
