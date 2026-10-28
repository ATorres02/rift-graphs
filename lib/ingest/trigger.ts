/**
 * When the Cloudflare cron (worker/index.ts) starts the GitHub ingest workflow. GitHub's own
 * schedule runs late or not at all, and no source moves the start time of a match that begins
 * early, so the cron compares the published series with the lolesports state every few minutes.
 *
 * Pure: the Worker does the I/O, this module only decides, so it is unit-tested.
 */
import type { Series } from "../data/types";
import type { LolesportsMatch } from "../sources/lolesports";

/** One series as published in /api/schedule.json (a few KB, cheap to parse in the Worker). */
export interface ScheduleEntry {
  id: string;
  dateTimeUtc: string;
  status: Series["status"];
  score: Series["score"];
  provisional: boolean;
  gamesPlayed: number;
  /** Games with a Leaguepedia scoreboard. */
  scoreboards: number;
  lolesportsMatchId: string | null;
}

export interface LastRun {
  createdAt: string;
  /** Queued or running. */
  active: boolean;
}

/**
 * lolesports is checked from 3 h before a slot (a follow-on match can start well before it,
 * and only its lolesports state says so)...
 */
export const LOOKAHEAD_MS = 3 * 60 * 60_000;
/** ...Leaguepedia is refreshed every PERIODIC_MS from 15 min before it... */
export const LEAD_MS = 15 * 60_000;
export const PERIODIC_MS = 15 * 60_000;
/** ...and both stop 12 h after it, or as soon as the series is settled. */
export const TRAIL_MS = 12 * 60 * 60_000;
/** Minimum gap between two runs started because lolesports is ahead. */
export const COOLDOWN_MS = 4 * 60_000;

export function toScheduleEntries(series: Series[]): ScheduleEntry[] {
  return series.map((s) => ({
    id: s.id,
    dateTimeUtc: s.dateTimeUtc,
    status: s.status,
    score: s.score,
    provisional: s.provisional,
    gamesPlayed: s.gamesPlayed,
    scoreboards: s.gameIds.length,
    lolesportsMatchId: s.lolesportsMatchId,
  }));
}

/** Not final yet: no confirmed result, or scoreboards still missing. */
const unsettled = (s: ScheduleEntry): boolean =>
  s.status !== "finished" || s.provisional || s.scoreboards < s.gamesPlayed;

/** Unsettled series whose slot is between `lead` ms ahead and TRAIL_MS behind. */
function around(schedule: ScheduleEntry[], now: number, lead: number): ScheduleEntry[] {
  return schedule.filter((s) => {
    const start = Date.parse(s.dateTimeUtc);
    return unsettled(s) && start - lead <= now && now - start <= TRAIL_MS;
  });
}

/** Series worth a lolesports check. */
export const watched = (schedule: ScheduleEntry[], now: number) => around(schedule, now, LOOKAHEAD_MS);

/** Series in play or about to start, which also get the periodic Leaguepedia refresh. */
export const inPlay = (schedule: ScheduleEntry[], now: number) => around(schedule, now, LEAD_MS);

/** Why lolesports is ahead of the published data (a match started, a game or a series ended), or null. */
export function lolesportsAhead(schedule: ScheduleEntry[], matches: LolesportsMatch[]): string | null {
  const byMatchId = new Map(schedule.filter((s) => s.lolesportsMatchId).map((s) => [s.lolesportsMatchId!, s]));
  for (const m of matches) {
    if (m.state === "unstarted") continue;
    const label = m.teams.map((t) => t.code).join(" vs ");
    const s = byMatchId.get(m.id);
    if (!s) {
      // A live match the site does not know yet (pairing still TBD); old unmatched results are ignored.
      if (m.state === "inProgress") return `${label} is live but not on the site`;
      continue;
    }
    if (s.status === "finished") continue;
    if (m.state === "completed") return `${label} finished`;
    if (s.status === "scheduled") return `${label} started`;
    const played = s.score ? s.score.team1 + s.score.team2 : 0;
    const lolPlayed = m.teams[0].gameWins + m.teams[1].gameWins;
    if (lolPlayed > played) return `${label}: game ${lolPlayed} finished`;
  }
  return null;
}

export function decide(input: { ahead: string | null; inPlay: boolean; lastRun: LastRun | null; now: number }): {
  dispatch: boolean;
  reason: string;
} {
  const { ahead, inPlay, lastRun, now } = input;
  if (lastRun?.active) return { dispatch: false, reason: "an ingest run is already queued or running" };
  const sinceLast = lastRun ? now - Date.parse(lastRun.createdAt) : Number.POSITIVE_INFINITY;
  if (ahead && sinceLast >= COOLDOWN_MS) return { dispatch: true, reason: ahead };
  if (inPlay && sinceLast >= PERIODIC_MS)
    return { dispatch: true, reason: "periodic refresh while a series is in play" };
  return { dispatch: false, reason: ahead ? `${ahead}; last run too recent` : "nothing new" };
}
