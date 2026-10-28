import type { Draft, Game, Side } from "./data/types";

export interface DraftStep {
  /** 1-based position in the draft. */
  seq: number;
  side: Side;
  type: "ban" | "pick";
  phase: 1 | 2;
  champion: string | null;
}

/**
 * Standard tournament draft order (5 bans + 5 picks per side):
 * ban phase 1 B R B R B R, pick phase 1 B R R B B R, ban phase 2 R B R B, pick phase 2 R B B R.
 */
const ORDER: { side: Side; type: "ban" | "pick"; phase: 1 | 2; slot: number }[] = [
  { side: "blue", type: "ban", phase: 1, slot: 0 },
  { side: "red", type: "ban", phase: 1, slot: 0 },
  { side: "blue", type: "ban", phase: 1, slot: 1 },
  { side: "red", type: "ban", phase: 1, slot: 1 },
  { side: "blue", type: "ban", phase: 1, slot: 2 },
  { side: "red", type: "ban", phase: 1, slot: 2 },
  { side: "blue", type: "pick", phase: 1, slot: 0 },
  { side: "red", type: "pick", phase: 1, slot: 0 },
  { side: "red", type: "pick", phase: 1, slot: 1 },
  { side: "blue", type: "pick", phase: 1, slot: 1 },
  { side: "blue", type: "pick", phase: 1, slot: 2 },
  { side: "red", type: "pick", phase: 1, slot: 2 },
  { side: "red", type: "ban", phase: 2, slot: 3 },
  { side: "blue", type: "ban", phase: 2, slot: 3 },
  { side: "red", type: "ban", phase: 2, slot: 4 },
  { side: "blue", type: "ban", phase: 2, slot: 4 },
  { side: "red", type: "pick", phase: 2, slot: 3 },
  { side: "blue", type: "pick", phase: 2, slot: 3 },
  { side: "blue", type: "pick", phase: 2, slot: 4 },
  { side: "red", type: "pick", phase: 2, slot: 4 },
];

/** Expands a draft row into the 20 steps of the standard pick/ban sequence. */
export function draftSequence(draft: Draft): DraftStep[] {
  return ORDER.map((o, i) => ({
    seq: i + 1,
    side: o.side,
    type: o.type,
    phase: o.phase,
    champion: (o.type === "ban" ? draft[o.side].bans : draft[o.side].picks)[o.slot] ?? null,
  }));
}

/**
 * Fearless draft: champions picked (by either team) in earlier games of the same
 * series are unavailable for the rest of it. Returns the champions locked before
 * `gameNumber`, sorted alphabetically.
 */
export function lockedChampionsBefore(seriesGames: Game[], gameNumber: number): string[] {
  const locked = new Set<string>();
  for (const g of seriesGames) {
    if (g.gameNumber >= gameNumber) continue;
    for (const c of [...g.blue.picks, ...g.red.picks]) locked.add(c);
  }
  return Array.from(locked).sort((a, b) => a.localeCompare(b));
}
