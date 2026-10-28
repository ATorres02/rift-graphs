/**
 * Derived metrics, defined once and shared by pages and (later) the chart builder.
 *
 * All functions are pure and operate on the normalised dataset rows. Ratios are
 * computed over totals (sum of numerators / sum of denominators), not as
 * averages of per-game ratios, so a 40-minute game weighs more than a 25-minute one.
 */
import type { Game, PlayerGame, Role, Series, Side } from "./data/types";

/** Minimum games before a player shows up in rankings (SPEC: default 3). */
export const DEFAULT_MIN_GAMES = 3;

export const ROLES: Role[] = ["top", "jungle", "mid", "bot", "support"];

/* ------------------------------------------------------------------ primitives */

export function kda(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(deaths, 1);
}

/** Kill participation as a fraction (0–1); null when the team made no kills. */
export function killParticipation(kills: number, assists: number, teamKills: number): number | null {
  return teamKills > 0 ? (kills + assists) / teamKills : null;
}

export function perMinute(value: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return value / (durationSeconds / 60);
}

/** Fraction of `total` that `part` represents; null when total is zero. */
export function share(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function minutes(durationSeconds: number): number {
  return durationSeconds / 60;
}

/* ------------------------------------------------------------------ players */

export interface ChampionUsage {
  champion: string;
  games: number;
  wins: number;
}

export interface PlayerAggregate {
  games: number;
  wins: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  /** 0–1, null when no team kills in the sample. */
  killParticipation: number | null;
  cspm: number;
  gpm: number;
  dpm: number;
  visionPerMinute: number;
  /** 0–1 share of the team's gold / damage, null when the denominator is zero. */
  goldShare: number | null;
  damageShare: number | null;
  totalMinutes: number;
  champions: ChampionUsage[];
  pentakills: number;
}

export function aggregatePlayerGames(rows: PlayerGame[]): PlayerAggregate {
  const games = rows.length;
  const sum = (f: (r: PlayerGame) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  const wins = rows.filter((r) => r.win).length;
  const kills = sum((r) => r.kills);
  const deaths = sum((r) => r.deaths);
  const assists = sum((r) => r.assists);
  const teamKills = sum((r) => r.teamKills);
  const totalMinutes = sum((r) => minutes(r.durationSeconds));
  const gold = sum((r) => r.gold);
  const damage = sum((r) => r.damageToChampions);
  const champMap = new Map<string, ChampionUsage>();
  for (const r of rows) {
    const c = champMap.get(r.champion) ?? { champion: r.champion, games: 0, wins: 0 };
    c.games += 1;
    if (r.win) c.wins += 1;
    champMap.set(r.champion, c);
  }
  const div = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    games,
    wins,
    winRate: div(wins, games),
    kills,
    deaths,
    assists,
    avgKills: div(kills, games),
    avgDeaths: div(deaths, games),
    avgAssists: div(assists, games),
    kda: games ? kda(kills, deaths, assists) : 0,
    killParticipation: games ? killParticipation(kills, assists, teamKills) : null,
    cspm: div(
      sum((r) => r.cs),
      totalMinutes,
    ),
    gpm: div(gold, totalMinutes),
    dpm: div(damage, totalMinutes),
    visionPerMinute: div(
      sum((r) => r.visionScore),
      totalMinutes,
    ),
    goldShare: games
      ? share(
          gold,
          sum((r) => r.teamGold),
        )
      : null,
    damageShare: games
      ? share(
          damage,
          sum((r) => r.teamDamage),
        )
      : null,
    totalMinutes,
    champions: Array.from(champMap.values()).sort((a, b) => b.games - a.games || a.champion.localeCompare(b.champion)),
    pentakills: sum((r) => r.pentakills),
  };
}

export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

export function aggregateByPlayer(rows: PlayerGame[]): Map<string, PlayerAggregate> {
  return new Map(
    Array.from(
      groupBy(rows, (r) => r.playerId),
      ([id, list]) => [id, aggregatePlayerGames(list)],
    ),
  );
}

export function aggregateByRole(rows: PlayerGame[]): Map<Role, PlayerAggregate> {
  return new Map(
    Array.from(
      groupBy(rows, (r) => r.role),
      ([role, list]) => [role, aggregatePlayerGames(list)],
    ),
  );
}

/* ------------------------------------------------------------------ teams */

export interface SideRecord {
  games: number;
  wins: number;
  winRate: number;
}

export interface TeamAggregate {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  blue: SideRecord;
  red: SideRecord;
  avgDurationSeconds: number;
  killsPerGame: number;
  deathsPerGame: number;
  goldPerMinute: number;
  towersPerGame: number;
  dragonsPerGame: number;
  baronsPerGame: number;
  heraldsPerGame: number;
  voidGrubsPerGame: number;
  /** Share (0–1) of all dragons / barons taken in the team's games; null when none were taken. */
  dragonControl: number | null;
  baronControl: number | null;
  totalMinutes: number;
}

function sideOf(game: Game, teamId: string): Side | null {
  if (game.blue.teamId === teamId) return "blue";
  if (game.red.teamId === teamId) return "red";
  return null;
}

export function aggregateTeamGames(games: Game[], teamId: string): TeamAggregate {
  const rows = games.flatMap((g) => {
    const side = sideOf(g, teamId);
    return side ? [{ game: g, side, own: g[side], opp: g[side === "blue" ? "red" : "blue"] }] : [];
  });
  const n = rows.length;
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  const wins = rows.filter((r) => r.game.winnerSide === r.side).length;
  const sideRecord = (side: Side): SideRecord => {
    const list = rows.filter((r) => r.side === side);
    const w = list.filter((r) => r.game.winnerSide === side).length;
    return { games: list.length, wins: w, winRate: list.length ? w / list.length : 0 };
  };
  const totalMinutes = sum((r) => minutes(r.game.durationSeconds));
  const div = (a: number, b: number) => (b > 0 ? a / b : 0);
  const dragonsAll = sum((r) => r.own.dragons + r.opp.dragons);
  const baronsAll = sum((r) => r.own.barons + r.opp.barons);
  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: div(wins, n),
    blue: sideRecord("blue"),
    red: sideRecord("red"),
    avgDurationSeconds: div(
      sum((r) => r.game.durationSeconds),
      n,
    ),
    killsPerGame: div(
      sum((r) => r.own.kills),
      n,
    ),
    deathsPerGame: div(
      sum((r) => r.opp.kills),
      n,
    ),
    goldPerMinute: div(
      sum((r) => r.own.gold),
      totalMinutes,
    ),
    towersPerGame: div(
      sum((r) => r.own.towers),
      n,
    ),
    dragonsPerGame: div(
      sum((r) => r.own.dragons),
      n,
    ),
    baronsPerGame: div(
      sum((r) => r.own.barons),
      n,
    ),
    heraldsPerGame: div(
      sum((r) => r.own.heralds),
      n,
    ),
    voidGrubsPerGame: div(
      sum((r) => r.own.voidGrubs),
      n,
    ),
    dragonControl: n
      ? share(
          sum((r) => r.own.dragons),
          dragonsAll,
        )
      : null,
    baronControl: n
      ? share(
          sum((r) => r.own.barons),
          baronsAll,
        )
      : null,
    totalMinutes,
  };
}

export function aggregateByTeam(games: Game[], teamIds: string[]): Map<string, TeamAggregate> {
  return new Map(teamIds.map((id) => [id, aggregateTeamGames(games, id)]));
}

/** Series wins/losses for a team (finished series only). */
export function seriesRecord(series: Series[], teamId: string): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const s of series) {
    if (s.status !== "finished" || !s.winnerId) continue;
    if (s.team1Id !== teamId && s.team2Id !== teamId) continue;
    if (s.winnerId === teamId) wins += 1;
    else losses += 1;
  }
  return { wins, losses };
}

/* ------------------------------------------------------------------ champions */

export interface ChampionAggregate {
  champion: string;
  picks: number;
  bans: number;
  /** (picks + bans) / games, 0–1. */
  presence: number;
  pickRate: number;
  banRate: number;
  wins: number;
  /** null when never picked. */
  winRate: number | null;
  byRole: Partial<Record<Role, { games: number; wins: number }>>;
}

export function aggregateChampions(games: Game[], playerGames: PlayerGame[]): ChampionAggregate[] {
  const map = new Map<string, ChampionAggregate>();
  const get = (name: string) => {
    let c = map.get(name);
    if (!c) {
      c = {
        champion: name,
        picks: 0,
        bans: 0,
        presence: 0,
        pickRate: 0,
        banRate: 0,
        wins: 0,
        winRate: null,
        byRole: {},
      };
      map.set(name, c);
    }
    return c;
  };
  const gameIds = new Set(games.map((g) => g.id));
  for (const g of games) {
    for (const side of ["blue", "red"] as const) {
      for (const name of new Set(g[side].bans)) get(name).bans += 1;
      for (const name of g[side].picks) {
        const c = get(name);
        c.picks += 1;
        if (g.winnerSide === side) c.wins += 1;
      }
    }
  }
  for (const pg of playerGames) {
    if (!gameIds.has(pg.gameId)) continue;
    const c = get(pg.champion);
    const r = c.byRole[pg.role] ?? { games: 0, wins: 0 };
    r.games += 1;
    if (pg.win) r.wins += 1;
    c.byRole[pg.role] = r;
  }
  const n = games.length;
  for (const c of map.values()) {
    c.presence = n ? (c.picks + c.bans) / n : 0;
    c.pickRate = n ? c.picks / n : 0;
    c.banRate = n ? c.bans / n : 0;
    c.winRate = c.picks ? c.wins / c.picks : null;
  }
  return Array.from(map.values()).sort(
    (a, b) => b.presence - a.presence || b.picks - a.picks || a.champion.localeCompare(b.champion),
  );
}

/* ------------------------------------------------------------------ ranking helpers */

export interface RankedPlayer<T> {
  playerId: string;
  value: T;
  aggregate: PlayerAggregate;
}

/** Players with at least `minGames` games, sorted by a metric (descending by default). */
export function rankPlayers(
  byPlayer: Map<string, PlayerAggregate>,
  metric: (a: PlayerAggregate) => number | null,
  {
    minGames = DEFAULT_MIN_GAMES,
    descending = true,
    limit,
  }: { minGames?: number; descending?: boolean; limit?: number } = {},
): RankedPlayer<number>[] {
  const list: RankedPlayer<number>[] = [];
  for (const [playerId, aggregate] of byPlayer) {
    if (aggregate.games < minGames) continue;
    const value = metric(aggregate);
    if (value === null || Number.isNaN(value)) continue;
    list.push({ playerId, value, aggregate });
  }
  list.sort((a, b) => (descending ? b.value - a.value : a.value - b.value) || b.aggregate.games - a.aggregate.games);
  return limit ? list.slice(0, limit) : list;
}
