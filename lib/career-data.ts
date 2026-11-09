import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CareerEntry } from "@/lib/career";
import type { IndexedDataset } from "@/lib/data/load";

interface CareerFile {
  players: Record<string, CareerEntry[]>;
  teams: Record<string, CareerEntry[]>;
}

let memo: CareerFile | null = null;

/** data/career.json, written by scripts/career.ts; pages show no history when it is missing. */
export function getCareer(): CareerFile {
  if (memo) return memo;
  const file = path.join(process.cwd(), "data/career.json");
  memo = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as CareerFile) : { players: {}, teams: {} };
  return memo;
}

export type WorldsResult = "champion" | "runner-up" | null;

/** How a finalist ended Worlds 2026, once the final is over. A player counts if they played in it. */
export function worldsResult(data: IndexedDataset, teamId: string, playerId?: string): WorldsResult {
  const final = data.series.find((s) => s.stage === "final");
  if (final?.status !== "finished" || !final.winnerId || (teamId !== final.team1Id && teamId !== final.team2Id))
    return null;
  const lineup = new Set(data.playerGames.filter((p) => p.seriesId === final.id).map((p) => p.playerId));
  if (playerId && lineup.size && !lineup.has(playerId)) return null;
  return teamId === final.winnerId ? "champion" : "runner-up";
}
