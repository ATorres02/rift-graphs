import { z } from "zod";
import type {
  ChampionIndex,
  Draft,
  Game,
  Meta,
  Player,
  PlayerGame,
  Series,
  Team,
  Tournament,
} from "./types";

export const stageIdSchema = z.enum(["playin", "swiss", "quarterfinals", "semifinals", "final"]);
export const roleSchema = z.enum(["top", "jungle", "mid", "bot", "support"]);
export const sideSchema = z.enum(["blue", "red"]);
export const seriesStatusSchema = z.enum(["scheduled", "live", "finished"]);

const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, "ISO 8601 UTC datetime");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const tournamentSchema: z.ZodType<Tournament> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  overviewPage: z.string().min(1),
  dateStart: isoDate,
  dateEnd: isoDate,
  country: z.string().nullable(),
  patch: z.string().nullable(),
  ddragonVersion: z.string().min(1),
  officialUrl: z.string().nullable(),
  stages: z.array(
    z.object({
      id: stageIdSchema,
      name: z.string(),
      overviewPage: z.string(),
      dateStart: isoDate.nullable(),
      dateEnd: isoDate.nullable(),
      bestOf: z.array(z.number().int().positive()),
      seriesCount: z.number().int().nonnegative(),
    }),
  ),
});

export const teamSchema: z.ZodType<Team> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  short: z.string().min(1),
  page: z.string().min(1),
  region: z.string().min(1),
  location: z.string().nullable(),
  stages: z.array(z.enum(["playin", "main"])),
  roster: z.array(z.object({ playerId: z.string().min(1), role: roleSchema })),
});

export const playerSchema: z.ZodType<Player> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  page: z.string().min(1),
  teamId: z.string().min(1),
  role: roleSchema,
  country: z.string().nullable(),
  realName: z.string().nullable(),
  nativeName: z.string().nullable(),
  residency: z.string().nullable(),
  fromScoreboardOnly: z.boolean(),
});

export const seriesSchema: z.ZodType<Series> = z.object({
  id: z.string().min(1),
  matchId: z.string().min(1),
  stage: stageIdSchema,
  tab: z.string(),
  round: z.number().int().positive().nullable(),
  bestOf: z.number().int().positive(),
  team1Id: z.string().nullable(),
  team2Id: z.string().nullable(),
  dateTimeUtc: isoDateTime,
  hasTime: z.boolean(),
  score: z.object({ team1: z.number().int().nonnegative(), team2: z.number().int().nonnegative() }).nullable(),
  winnerId: z.string().nullable(),
  status: seriesStatusSchema,
  matchDay: z.number().int().nullable(),
  patch: z.string().nullable(),
  streamUrl: z.string().nullable(),
  mvp: z.string().nullable(),
  gameIds: z.array(z.string()),
  gamesPlayed: z.number().int().nonnegative(),
});

const gameTeamStatsSchema = z.object({
  teamId: z.string().min(1),
  kills: z.number().int().nonnegative(),
  gold: z.number().nonnegative(),
  towers: z.number().int().nonnegative(),
  inhibitors: z.number().int().nonnegative(),
  dragons: z.number().int().nonnegative(),
  elders: z.number().int().nonnegative(),
  barons: z.number().int().nonnegative(),
  heralds: z.number().int().nonnegative(),
  voidGrubs: z.number().int().nonnegative(),
  atakhans: z.number().int().nonnegative().nullable(),
  bans: z.array(z.string()),
  picks: z.array(z.string()),
});

export const gameSchema: z.ZodType<Game> = z.object({
  id: z.string().min(1),
  seriesId: z.string().min(1),
  stage: stageIdSchema,
  gameNumber: z.number().int().positive(),
  dateTimeUtc: isoDateTime.nullable(),
  durationSeconds: z.number().int().positive(),
  patch: z.string().nullable(),
  winnerSide: sideSchema,
  winnerTeamId: z.string().min(1),
  blue: gameTeamStatsSchema,
  red: gameTeamStatsSchema,
  riotGameId: z.string().nullable(),
  vodUrl: z.string().nullable(),
});

const draftSideSchema = z.object({
  bans: z.array(z.string().nullable()).length(5),
  picks: z.array(z.string().nullable()).length(5),
  picksByRole: z.array(z.string().nullable()).length(5),
});

export const draftSchema: z.ZodType<Draft> = z.object({
  gameId: z.string().min(1),
  blue: draftSideSchema,
  red: draftSideSchema,
  complete: z.boolean(),
});

export const playerGameSchema: z.ZodType<PlayerGame> = z.object({
  gameId: z.string().min(1),
  seriesId: z.string().min(1),
  stage: stageIdSchema,
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  opponentTeamId: z.string().min(1),
  role: roleSchema,
  champion: z.string().min(1),
  side: sideSchema,
  win: z.boolean(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  gold: z.number().nonnegative(),
  cs: z.number().int().nonnegative(),
  damageToChampions: z.number().nonnegative(),
  visionScore: z.number().nonnegative(),
  teamKills: z.number().int().nonnegative(),
  teamGold: z.number().nonnegative(),
  teamDamage: z.number().nonnegative(),
  durationSeconds: z.number().int().positive(),
  items: z.array(z.string()),
  trinket: z.string().nullable(),
  keystone: z.string().nullable(),
  primaryTree: z.string().nullable(),
  secondaryTree: z.string().nullable(),
  runes: z.array(z.string()),
  summonerSpells: z.array(z.string()),
  pentakills: z.number().int().nonnegative(),
});

export const championIndexSchema: z.ZodType<ChampionIndex> = z.object({
  version: z.string().min(1),
  champions: z.array(z.object({ id: z.string().min(1), key: z.string().min(1), name: z.string().min(1) })),
});

export const metaSchema: z.ZodType<Meta> = z.object({
  schemaVersion: z.number().int().positive(),
  updatedAt: isoDateTime,
  tournamentId: z.string().min(1),
  source: z.object({ name: z.string(), url: z.string(), license: z.string(), transport: z.string() }),
  ddragonVersion: z.string().min(1),
  counts: z.object({
    teams: z.number().int().nonnegative(),
    players: z.number().int().nonnegative(),
    series: z.number().int().nonnegative(),
    games: z.number().int().nonnegative(),
    playerGames: z.number().int().nonnegative(),
    drafts: z.number().int().nonnegative(),
  }),
  pendingGameIds: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const SCHEMA_VERSION = 1;

/** File name → schema, used by both the pipeline (write) and the app (read). */
export const datasetFiles = {
  "meta.json": metaSchema,
  "tournament.json": tournamentSchema,
  "teams.json": z.array(teamSchema),
  "players.json": z.array(playerSchema),
  "series.json": z.array(seriesSchema),
  "games.json": z.array(gameSchema),
  "drafts.json": z.array(draftSchema),
  "player-games.json": z.array(playerGameSchema),
  "champions.json": championIndexSchema,
} as const;

export type DatasetFileName = keyof typeof datasetFiles;
