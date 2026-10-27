import type { Series, StageId, Team } from "./data/types";

export type SwissStatus = "qualified" | "eliminated" | "active";

export interface SwissResult {
  round: number;
  seriesId: string;
  opponentId: string | null;
  won: boolean;
}

export interface SwissRecord {
  teamId: string;
  wins: number;
  losses: number;
  status: SwissStatus;
  results: SwissResult[];
}

export const SWISS_TARGET = 3;

/** Win/loss record of every team in the Swiss stage, from finished Swiss series. */
export function swissStandings(series: Series[], teamIds: string[]): SwissRecord[] {
  const records = new Map<string, SwissRecord>(teamIds.map((id) => [id, { teamId: id, wins: 0, losses: 0, status: "active", results: [] }]));
  const swiss = series.filter((s) => s.stage === "swiss" && s.status === "finished" && s.winnerId).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  for (const s of swiss) {
    for (const [teamId, oppId] of [
      [s.team1Id, s.team2Id],
      [s.team2Id, s.team1Id],
    ] as const) {
      if (!teamId) continue;
      const rec = records.get(teamId);
      if (!rec) continue;
      const won = s.winnerId === teamId;
      if (won) rec.wins += 1;
      else rec.losses += 1;
      rec.results.push({ round: s.round ?? 0, seriesId: s.id, opponentId: oppId, won });
    }
  }
  for (const rec of records.values()) {
    if (rec.wins >= SWISS_TARGET) rec.status = "qualified";
    else if (rec.losses >= SWISS_TARGET) rec.status = "eliminated";
  }
  return Array.from(records.values()).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.teamId.localeCompare(b.teamId),
  );
}

/** Groups Swiss records by "W-L" label, best records first. */
export function swissGroups(records: SwissRecord[]): { label: string; wins: number; losses: number; teams: SwissRecord[] }[] {
  const groups = new Map<string, { label: string; wins: number; losses: number; teams: SwissRecord[] }>();
  for (const r of records) {
    const label = `${r.wins}-${r.losses}`;
    const g = groups.get(label) ?? { label, wins: r.wins, losses: r.losses, teams: [] };
    g.teams.push(r);
    groups.set(label, g);
  }
  return Array.from(groups.values()).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

export type TeamStatus = "champion" | "alive" | "eliminated";

const KNOCKOUT_STAGES: StageId[] = ["quarterfinals", "semifinals", "final"];

/** Whether a team is still in the tournament, derived from finished series. */
export function teamStatus(team: Team, series: Series[], swiss: SwissRecord[]): TeamStatus {
  const finished = series.filter((s) => s.status === "finished" && (s.team1Id === team.id || s.team2Id === team.id));
  const finalWin = finished.find((s) => s.stage === "final" && s.winnerId === team.id);
  if (finalWin) return "champion";
  if (finished.some((s) => KNOCKOUT_STAGES.includes(s.stage) && s.winnerId && s.winnerId !== team.id)) return "eliminated";
  if (!team.stages.includes("main")) return "eliminated";
  const rec = swiss.find((r) => r.teamId === team.id);
  if (rec?.status === "eliminated") return "eliminated";
  return "alive";
}
