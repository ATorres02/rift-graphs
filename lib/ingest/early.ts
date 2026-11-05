/**
 * Early game numbers (first blood, gold and CS at 15:00) from the lolesports live stats feed. Fetching a game takes
 * about fifty feed requests, so results are kept in data/<tournament>/early-game.json and only games missing there
 * are read; the dataset then gets them through applyEarly. Fails soft: without the feed the dataset is unchanged.
 */
import type { Game, PlayerGame, Series, Team } from "../data/types";
import { readEarlyGame, type EarlyGame, type WindowReader } from "../sources/livestats";
import type { LolesportsClient } from "../sources/lolesports";
import { teamMatches } from "./merge";

/** Game id → what the feed gave, or why it gave nothing (kept so the game is not read again on every run). */
export type EarlyCache = Record<string, EarlyGame | { unavailable: string }>;

const isEarly = (v: EarlyGame | { unavailable: string } | undefined): v is EarlyGame => !!v && "esportsGameId" in v;

/** Pure: the dataset with the early game numbers of the cache filled in. Rows of other games are left as they are. */
export function applyEarly(
  games: Game[],
  playerGames: PlayerGame[],
  cache: EarlyCache,
): { games: Game[]; playerGames: PlayerGame[] } {
  const outGames = games.map((g) => {
    const e = cache[g.id];
    if (!isEarly(e)) return g;
    const side = (s: "blue" | "red") => ({
      ...g[s],
      ...(e.firstBlood ? { firstBlood: e.firstBlood === s } : {}),
      ...(e.at15 ? { goldAt15: e.at15[s].gold } : {}),
    });
    return { ...g, blue: side("blue"), red: side("red") };
  });
  const outRows = playerGames.map((r) => {
    const e = cache[r.gameId];
    if (!isEarly(e) || !e.at15) return r;
    const own = e.at15.players.find((p) => p.side === r.side && p.role === r.role);
    const opp = e.at15.players.find((p) => p.side !== r.side && p.role === r.role);
    if (!own) return r;
    return {
      ...r,
      goldAt15: own.gold,
      csAt15: own.cs,
      ...(opp ? { goldDiffAt15: own.gold - opp.gold, csDiffAt15: own.cs - opp.cs } : {}),
    };
  });
  return { games: outGames, playerGames: outRows };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);

interface FeedGame {
  id: string;
  number: number;
  blue: { name: string; code: string } | null;
  red: { name: string; code: string } | null;
}

/** Pure: game ids, numbers and side teams from a `getEventDetails` payload. */
export function parseEventGames(payload: unknown): FeedGame[] {
  const match = obj(obj(obj(obj(payload)?.data)?.event)?.match);
  const teams = new Map<string, { name: string; code: string }>();
  for (const t of Array.isArray(match?.teams) ? match.teams : []) {
    const o = obj(t);
    if (typeof o?.id === "string" && typeof o.code === "string")
      teams.set(o.id, { name: typeof o.name === "string" ? o.name : o.code, code: o.code });
  }
  const games: FeedGame[] = [];
  for (const g of Array.isArray(match?.games) ? match.games : []) {
    const o = obj(g);
    if (typeof o?.id !== "string" || typeof o.number !== "number") continue;
    const side = (s: string) => {
      const t = (Array.isArray(o.teams) ? o.teams : []).map(obj).find((x) => x?.side === s);
      return typeof t?.id === "string" ? (teams.get(t.id) ?? null) : null;
    };
    games.push({ id: o.id, number: o.number, blue: side("blue"), red: side("red") });
  }
  return games;
}

export interface FetchFeedOptions {
  client: LolesportsClient;
  reader: (esportsGameId: string) => WindowReader;
  log: (message: string) => void;
  /** Stop after this many games so one run stays short; the rest come on the next runs. */
  maxGames?: number;
  /** Games read at the same time (a backfill); one at a time by default. */
  concurrency?: number;
  /** How the log names this data, e.g. "early game". */
  label?: string;
}

/**
 * Reads, for every finished game missing from the cache, what `readGame` takes from the live stats feed. Finds the
 * feed's game through getEventDetails and checks both sides against the dataset first. Returns the new cache.
 */
export async function fetchFeedGames<T>(
  series: Series[],
  games: Game[],
  teams: Team[],
  cache: Record<string, T | { unavailable: string }>,
  readGame: (esportsGameId: string, reader: WindowReader, game: Game) => Promise<T | null>,
  { client, reader, log, maxGames = 25, concurrency = 1, label = "feed" }: FetchFeedOptions,
): Promise<{ cache: Record<string, T | { unavailable: string }>; read: number; failed: number }> {
  const next: Record<string, T | { unavailable: string }> = { ...cache };
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const events = new Map<string, Promise<FeedGame[]>>();
  let read = 0;
  let failed = 0;
  const todo = games
    .filter((g) => !g.provisional && !(g.id in cache) && seriesById.get(g.seriesId)?.lolesportsMatchId)
    .slice(0, maxGames);
  const one = async (g: Game) => {
    const s = seriesById.get(g.seriesId)!;
    try {
      if (!events.has(s.id)) {
        events.set(
          s.id,
          client.get("getEventDetails", { id: s.lolesportsMatchId! }).then((p) => parseEventGames(p)),
        );
      }
      const feedGame = (await events.get(s.id)!).find((x) => x.number === g.gameNumber);
      if (!feedGame) {
        next[g.id] = { unavailable: "no game with this number on lolesports" };
        return;
      }
      const blue = teamsById.get(g.blue.teamId);
      const red = teamsById.get(g.red.teamId);
      if (
        !blue ||
        !red ||
        !feedGame.blue ||
        !teamMatches(blue, feedGame.blue) ||
        !feedGame.red ||
        !teamMatches(red, feedGame.red)
      ) {
        next[g.id] = { unavailable: "sides do not match lolesports" };
        log(`${label}: ${g.id} sides do not match lolesports, skipped`);
        return;
      }
      const value = await readGame(feedGame.id, reader(feedGame.id), g);
      next[g.id] = value ?? { unavailable: "no frames in the live stats feed" };
      read += 1;
    } catch (err) {
      // Not cached: the next run tries again.
      failed += 1;
      log(`${label}: ${g.id} failed (${err instanceof Error ? err.message : String(err)})`);
    }
  };
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      for (let g = queue.shift(); g; g = queue.shift()) await one(g);
    }),
  );
  return { cache: next, read, failed };
}

/** Reads the games that are finished and missing from the cache; returns the new cache and how many were read. */
export async function fetchEarly(
  series: Series[],
  games: Game[],
  teams: Team[],
  cache: EarlyCache,
  options: FetchFeedOptions,
): Promise<{ cache: EarlyCache; read: number; failed: number }> {
  return fetchFeedGames(
    series,
    games,
    teams,
    cache,
    (id, reader, g) => readEarlyGame(id, reader, g.durationSeconds * 1000),
    { label: "early game", ...options },
  );
}
