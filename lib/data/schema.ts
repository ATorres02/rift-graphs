import { z } from "zod";
import type { EarlyGame } from "../sources/livestats";
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
export const dataSourceSchema = z.enum(["leaguepedia", "manual", "lolesports"]);

/**
 * Text shown in the UI: bounded, and without markup or control characters.
 * The ingest cleans wiki text with `cleanText()`; this is the last line of defence.
 */
const text = (max = 160) =>
  z
    .string()
    .max(max)
    .regex(/^[^<>\u0000-\u001F\u007F]*$/, "must not contain markup or control characters");
const displayText = text().min(1);
const optionalDisplayText = text().nullable();

const lineupEntrySchema = z.object({
  playerId: z.string().min(1).nullable(),
  name: displayText,
  role: roleSchema,
  champion: displayText,
  kills: z.number().int().nonnegative().nullable(),
  deaths: z.number().int().nonnegative().nullable(),
  assists: z.number().int().nonnegative().nullable(),
});

const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, "ISO 8601 UTC datetime");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const tournamentSchema: z.ZodType<Tournament> = z.object({
  id: z.string().min(1),
  name: displayText,
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
      name: text(),
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
  name: displayText,
  short: displayText,
  page: z.string().min(1),
  region: displayText,
  location: optionalDisplayText,
  stages: z.array(z.enum(["playin", "main"])),
  roster: z.array(z.object({ playerId: z.string().min(1), role: roleSchema })),
  coaches: z.array(displayText),
  seed: z
    .object({
      league: z.string().min(1),
      seed: z.number().int().positive(),
      pool: z.number().int().positive().nullable(),
      stage: z.enum(["main", "playin"]),
      path: z.string(),
    })
    .nullable(),
});

/** data/seeds.json: hand-kept seeds per team. */
export const seedsFileSchema = z.object({
  source: z.string().optional(),
  seeds: z.array(
    z.object({
      teamId: z.string().min(1),
      league: z.string().min(1),
      seed: z.number().int().positive(),
      pool: z.number().int().positive().nullable(),
      stage: z.enum(["main", "playin"]),
      path: z.string(),
    }),
  ),
});

export const playerSchema: z.ZodType<Player> = z.object({
  id: z.string().min(1),
  name: displayText,
  page: z.string().min(1),
  teamId: z.string().min(1),
  role: roleSchema,
  country: optionalDisplayText,
  realName: optionalDisplayText,
  nativeName: optionalDisplayText,
  residency: optionalDisplayText,
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
  // Only https streams: the value is rendered as an anchor href and comes from the wiki.
  streamUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "streamUrl must be an https URL")
    .nullable(),
  mvp: optionalDisplayText,
  gameIds: z.array(z.string()),
  gamesPlayed: z.number().int().nonnegative(),
  source: dataSourceSchema,
  provisional: z.boolean(),
  lolesportsMatchId: z.string().nullable(),
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
  bans: z.array(text()),
  picks: z.array(text()),
  lineup: z.array(lineupEntrySchema).nullable(),
  firstBlood: z.boolean().optional(),
  goldAt15: z.number().nonnegative().optional(),
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
  source: dataSourceSchema,
  provisional: z.boolean(),
  statsComplete: z.boolean(),
});

const draftSideSchema = z.object({
  bans: z.array(optionalDisplayText).length(5),
  picks: z.array(optionalDisplayText).length(5),
  picksByRole: z.array(optionalDisplayText).length(5),
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
  champion: displayText,
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
  goldAt15: z.number().nonnegative().optional(),
  csAt15: z.number().int().nonnegative().optional(),
  goldDiffAt15: z.number().optional(),
  csDiffAt15: z.number().int().optional(),
});

export const championIndexSchema: z.ZodType<ChampionIndex> = z.object({
  version: z.string().min(1),
  champions: z.array(
    z.object({ id: text(80), key: text(80), name: displayText, title: text(160).optional() }),
  ),
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
  sources: z.object({
    lolesports: z.object({
      enabled: z.boolean(),
      fetchedAt: isoDateTime.nullable(),
      matchedSeries: z.number().int().nonnegative(),
      unmatchedEvents: z.number().int().nonnegative(),
      error: z.string().nullable(),
    }),
    manual: z.object({
      applied: z.array(z.string()),
      superseded: z.array(z.string()),
      invalid: z.array(z.object({ file: z.string(), error: z.string() })),
    }),
  }),
  provisional: z.object({ seriesIds: z.array(z.string()), gameIds: z.array(z.string()) }),
  conflicts: z.number().int().nonnegative(),
});

const earlyTeamSchema = z.object({
  gold: z.number().nonnegative(),
  kills: z.number().int().nonnegative(),
  towers: z.number().int().nonnegative(),
  dragons: z.number().int().nonnegative(),
});

export const earlyGameSchema: z.ZodType<EarlyGame> = z.object({
  esportsGameId: z.string().min(1).max(40),
  firstBlood: sideSchema.nullable(),
  at15: z
    .object({
      blue: earlyTeamSchema,
      red: earlyTeamSchema,
      players: z.array(
        z.object({
          side: sideSchema,
          role: roleSchema,
          gold: z.number().nonnegative(),
          cs: z.number().int().nonnegative(),
          level: z.number().int().nonnegative(),
          kills: z.number().int().nonnegative(),
          deaths: z.number().int().nonnegative(),
          assists: z.number().int().nonnegative(),
        }),
      ),
    })
    .nullable(),
  pausedSeconds: z.number().int().nonnegative(),
});

/** Game id → early game numbers from the lolesports live stats feed, or why there are none. */
export const earlyCacheSchema = z.record(
  z.string(),
  z.union([earlyGameSchema, z.object({ unavailable: text(200) })]),
);

export const SCHEMA_VERSION = 2;

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
  "early-game.json": earlyCacheSchema,
} as const;

export type DatasetFileName = keyof typeof datasetFiles;
