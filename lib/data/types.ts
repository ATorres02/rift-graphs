/**
 * Normalised dataset types for one tournament.
 *
 * Everything aggregated (averages, percentages) is computed in the client from
 * `PlayerGame` and `Game` rows via `lib/metrics.ts`. The pipeline only
 * normalises what Leaguepedia provides; it never invents values.
 */

export type StageId = "playin" | "swiss" | "quarterfinals" | "semifinals" | "final";

export type Role = "top" | "jungle" | "mid" | "bot" | "support";

export type Side = "blue" | "red";

export type SeriesStatus = "scheduled" | "live" | "finished";

export interface TournamentStage {
  id: StageId;
  name: string;
  /** Leaguepedia overview page that holds this stage. */
  overviewPage: string;
  /** Earliest and latest series date (UTC, YYYY-MM-DD) derived from the schedule. */
  dateStart: string | null;
  dateEnd: string | null;
  /** Distinct best-of formats observed in the schedule for this stage. */
  bestOf: number[];
  seriesCount: number;
}

export interface Tournament {
  id: string;
  name: string;
  overviewPage: string;
  dateStart: string;
  dateEnd: string;
  country: string | null;
  /** Game patch as a string, e.g. "26.20". */
  patch: string | null;
  /** Data Dragon version pinned by the pipeline, e.g. "16.20.1". */
  ddragonVersion: string;
  /** External link reported by Leaguepedia (tournament level). */
  officialUrl: string | null;
  stages: TournamentStage[];
}

export interface RosterEntry {
  playerId: string;
  role: Role;
}

export interface Team {
  id: string;
  /** Display name as shown by Leaguepedia (e.g. "LYON"). */
  name: string;
  /** Short name / tag (e.g. "GEN"). */
  short: string;
  /** Leaguepedia page name (unique key). */
  page: string;
  /** Region as reported by Leaguepedia's Teams table (e.g. "Korea"). */
  region: string;
  location: string | null;
  /** Stage pages the team is listed on (play-in and/or main event). */
  stages: ("playin" | "main")[];
  roster: RosterEntry[];
}

export interface Player {
  id: string;
  /** In-game alias. */
  name: string;
  /** Leaguepedia page name (unique key). */
  page: string;
  teamId: string;
  role: Role;
  country: string | null;
  realName: string | null;
  nativeName: string | null;
  residency: string | null;
  /** True when the player only appears in scoreboards and not on the listed roster. */
  fromScoreboardOnly: boolean;
}

export interface Series {
  id: string;
  /** Leaguepedia MatchId (unique key). */
  matchId: string;
  stage: StageId;
  /** Tab name on Leaguepedia (e.g. "Round 3"). */
  tab: string;
  /** Round number for play-in and swiss, null otherwise. */
  round: number | null;
  bestOf: number;
  team1Id: string | null;
  team2Id: string | null;
  /** ISO 8601 UTC datetime of the scheduled start. */
  dateTimeUtc: string;
  hasTime: boolean;
  score: { team1: number; team2: number } | null;
  winnerId: string | null;
  status: SeriesStatus;
  matchDay: number | null;
  patch: string | null;
  streamUrl: string | null;
  mvp: string | null;
  /** Games (ids) with scoreboard data, ordered by game number. */
  gameIds: string[];
  /** Number of games that Leaguepedia reports as played (winner known), with or without scoreboard. */
  gamesPlayed: number;
}

export interface GameTeamStats {
  teamId: string;
  kills: number;
  gold: number;
  towers: number;
  inhibitors: number;
  dragons: number;
  elders: number;
  barons: number;
  heralds: number;
  voidGrubs: number;
  bans: string[];
  picks: string[];
}

export interface Game {
  id: string;
  seriesId: string;
  stage: StageId;
  gameNumber: number;
  dateTimeUtc: string | null;
  durationSeconds: number;
  patch: string | null;
  winnerSide: Side;
  winnerTeamId: string;
  blue: GameTeamStats;
  red: GameTeamStats;
  riotGameId: string | null;
  vodUrl: string | null;
}

export interface DraftSide {
  bans: (string | null)[];
  picks: (string | null)[];
  /** Picks ordered Top, Jungle, Mid, Bot, Support. */
  picksByRole: (string | null)[];
}

export interface Draft {
  gameId: string;
  blue: DraftSide;
  red: DraftSide;
  complete: boolean;
}

export interface PlayerGame {
  gameId: string;
  seriesId: string;
  stage: StageId;
  playerId: string;
  teamId: string;
  opponentTeamId: string;
  role: Role;
  champion: string;
  side: Side;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  cs: number;
  damageToChampions: number;
  visionScore: number;
  teamKills: number;
  teamGold: number;
  /** Sum of damage to champions of the five team-mates in this game (derived). */
  teamDamage: number;
  durationSeconds: number;
  items: string[];
  trinket: string | null;
  keystone: string | null;
  primaryTree: string | null;
  secondaryTree: string | null;
  runes: string[];
  summonerSpells: string[];
  pentakills: number;
}

export interface ChampionRef {
  /** Data Dragon id (e.g. "LeeSin"). */
  id: string;
  key: string;
  name: string;
}

export interface ChampionIndex {
  version: string;
  champions: ChampionRef[];
}

export interface Meta {
  schemaVersion: number;
  updatedAt: string;
  tournamentId: string;
  source: { name: string; url: string; license: string; transport: string };
  ddragonVersion: string;
  counts: {
    teams: number;
    players: number;
    series: number;
    games: number;
    playerGames: number;
    drafts: number;
  };
  /** Games that exist on Leaguepedia but failed validation and were left out. */
  pendingGameIds: string[];
  warnings: string[];
}

export interface Dataset {
  meta: Meta;
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  series: Series[];
  games: Game[];
  drafts: Draft[];
  playerGames: PlayerGame[];
  champions: ChampionIndex;
}
