import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { applyEarly } from "@/lib/ingest/early";
import { indexDataset, type IndexedDataset } from "./index";
import { datasetFiles, type DatasetFileName } from "./schema";
import type { ChampionRef, Dataset, Series, Team } from "./types";
import { normalizeChampionName } from "@/lib/sources/ddragon";
import type { GameTimeline } from "@/lib/sources/livestats";
import type { LoadoutIndex } from "@/lib/sources/loadout";
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
  // First blood and the 15:00 numbers live in their own file, written by the ingest as it reads the live stats feed.
  const early = existsSync(path.join(dir, "early-game.json")) ? readJson(dir, "early-game.json") : {};
  const { games, playerGames } = applyEarly(
    readJson(dir, "games.json"),
    readJson(dir, "player-games.json"),
    early,
  );
  return {
    meta: readJson(dir, "meta.json"),
    tournament: readJson(dir, "tournament.json"),
    teams: readJson(dir, "teams.json"),
    players: readJson(dir, "players.json"),
    series: readJson(dir, "series.json"),
    games,
    drafts: readJson(dir, "drafts.json"),
    playerGames,
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

let timelineMemo: Map<string, GameTimeline> | null = null;

/**
 * Gold graph timelines by game id, for the games the live stats feed had. Read on the server only: they are not part
 * of the dataset, so /api/dataset stays small.
 */
export function getTimelines(): Map<string, GameTimeline> {
  if (timelineMemo) return timelineMemo;
  const dir = path.join(process.cwd(), "data", TOURNAMENT_ID);
  const raw = existsSync(path.join(dir, "gold-timeline.json")) ? readJson(dir, "gold-timeline.json") : {};
  timelineMemo = new Map(
    Object.entries(raw).flatMap(([id, v]) => ("esportsGameId" in v ? [[id, v] as [string, GameTimeline]] : [])),
  );
  return timelineMemo;
}

let loadoutMemo: LoadoutIndex | null = null;

/** Item, rune and summoner spell icons for the names in the player rows (empty until the ingest has written them). */
export function getLoadout(): LoadoutIndex {
  if (loadoutMemo) return loadoutMemo;
  const dir = path.join(process.cwd(), "data", TOURNAMENT_ID);
  loadoutMemo = existsSync(path.join(dir, "loadout.json"))
    ? readJson(dir, "loadout.json")
    : { version: "", items: {}, runes: {}, spells: {} };
  return loadoutMemo;
}
