import { readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { indexDataset, type IndexedDataset } from "./index";
import { datasetFiles, type DatasetFileName } from "./schema";
import type { ChampionRef, Dataset, Series, Team } from "./types";
import { normalizeChampionName } from "@/lib/sources/ddragon";
import { teamLogo, type TeamLogo } from "./team-logos";

export type { IndexedDataset } from "./index";

export const TOURNAMENT_ID = process.env.TOURNAMENT_ID ?? "worlds-2026";

function readJson<K extends DatasetFileName>(dir: string, file: K): ReturnType<(typeof datasetFiles)[K]["parse"]> {
  const raw = readFileSync(path.join(dir, file), "utf8");
  return datasetFiles[file].parse(JSON.parse(raw)) as ReturnType<(typeof datasetFiles)[K]["parse"]>;
}

let memo: IndexedDataset | null = null;

export function readDataset(): Dataset {
  const dir = path.join(process.cwd(), "data", TOURNAMENT_ID);
  return {
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
}

function load(): IndexedDataset {
  if (memo) return memo;
  memo = indexDataset(readDataset());
  return memo;
}

/** Loads and indexes the tournament dataset once per build/request. */
export const getData = cache(load);

export function championRef(data: IndexedDataset, name: string): ChampionRef | null {
  return data.championByName.get(normalizeChampionName(name)) ?? null;
}

/** Champions picked or banned in at least one confirmed game: the ones with a page under /champions. */
export function draftedChampions(data: IndexedDataset): ChampionRef[] {
  const seen = new Set<string>();
  for (const g of data.confirmedGames)
    for (const side of ["blue", "red"] as const)
      for (const n of [...g[side].picks, ...g[side].bans]) seen.add(normalizeChampionName(n));
  return data.champions.champions.filter((c) => seen.has(normalizeChampionName(c.name)));
}

/** Minimal team shape for client components (keeps RSC payloads small). */
export interface TeamRef {
  id: string;
  name: string;
  short: string;
  region: string;
  logo: TeamLogo | null;
}

export function teamRef(team: Team | null | undefined): TeamRef | null {
  return team
    ? { id: team.id, name: team.name, short: team.short, region: team.region, logo: teamLogo(team.id) }
    : null;
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
