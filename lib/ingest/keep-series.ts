/**
 * Guards against Leaguepedia briefly losing a MatchSchedule row (seen on 8 Nov 2026, in the middle of a semifinal):
 * a series the dataset already had is kept when its row is gone, with a warning, instead of vanishing from the site.
 *
 * Series whose row still exists but was rejected on purpose (nullified, no date) are not kept, and neither are series
 * created by a manual file, which come back from that file. Pure: no I/O.
 */
import type { Series } from "../data/types";

export interface KeepSeriesInput {
  /** Series built from this run's MatchSchedule rows. */
  current: Series[];
  /** series.json as it was before this run; null on a first run. */
  previous: Series[] | null;
  /** Every MatchId returned by MatchSchedule in this run, including rows that were skipped. */
  scheduleMatchIds: Set<string>;
}

export interface KeepSeriesResult {
  series: Series[];
  kept: string[];
  warnings: string[];
}

const sameTeams = (a: Series, b: Series): boolean =>
  (a.team1Id === b.team1Id && a.team2Id === b.team2Id) || (a.team1Id === b.team2Id && a.team2Id === b.team1Id);

/** Provisional results are dropped: the merge would read them as final, and lolesports or the manual files reapply them. */
function restore(s: Series): Series {
  const base = { ...s, gameIds: [], source: "leaguepedia" as const, provisional: false, lolesportsMatchId: null };
  if (!s.provisional) return base;
  return {
    ...base,
    score: null,
    winnerId: null,
    gamesPlayed: 0,
    status: s.status === "scheduled" ? "scheduled" : "live",
  };
}

export function keepMissingSeries({ current, previous, scheduleMatchIds }: KeepSeriesInput): KeepSeriesResult {
  const ids = new Set(current.map((s) => s.id));
  const restored: Series[] = [];
  const warnings: string[] = [];
  for (const s of previous ?? []) {
    if (ids.has(s.id) || scheduleMatchIds.has(s.matchId) || s.matchId.startsWith("manual:")) continue;
    const replacement =
      s.team1Id && s.team2Id
        ? current.find((c) => c.stage === s.stage && c.dateTimeUtc === s.dateTimeUtc && sameTeams(c, s))
        : undefined;
    if (replacement) {
      warnings.push(`series ${s.id} is gone from MatchSchedule; replaced by ${replacement.id}, not kept`);
      continue;
    }
    restored.push(restore(s));
    warnings.push(`series ${s.id} is missing from MatchSchedule; kept from the previous data`);
  }
  const series = [...current, ...restored].sort(
    (a, b) => a.dateTimeUtc.localeCompare(b.dateTimeUtc) || a.id.localeCompare(b.id),
  );
  return { series, kept: restored.map((s) => s.id), warnings };
}
