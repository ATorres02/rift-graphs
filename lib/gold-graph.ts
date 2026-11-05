/**
 * The gold graph of a game: blue side's gold minus red side's, every 30 seconds of game time, with the dragons and
 * barons each side took. Pure, from a timeline of the lolesports live stats feed (lib/sources/livestats.ts).
 */
import type { Side } from "@/lib/data/types";
import type { GameTimeline } from "@/lib/sources/livestats";

export interface GoldPoint {
  /** Seconds of game time. */
  t: number;
  /** Blue side's gold minus red side's. */
  diff: number;
}

export interface GoldEvent {
  t: number;
  side: Side;
  kind: "dragon" | "baron";
  label: string;
}

export interface GoldLead {
  value: number;
  t: number;
}

export interface GoldGraph {
  points: GoldPoint[];
  events: GoldEvent[];
  /** Largest lead of each side, null when it never led. */
  lead: Record<Side, GoldLead | null>;
  /** Game time of the last point, in seconds. */
  end: number;
  /** Top of the scale, the same both ways: a round number above the largest lead. */
  scale: number;
}

const SCALES = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000, 40000];

const DRAGON_NAME: Record<string, string> = {
  ocean: "Ocean drake",
  infernal: "Infernal drake",
  mountain: "Mountain drake",
  cloud: "Cloud drake",
  hextech: "Hextech drake",
  chemtech: "Chemtech drake",
  elder: "Elder dragon",
};

export function goldGraph(tl: GameTimeline): GoldGraph {
  const n = tl.blue.gold.length;
  const at = (i: number) => tl.t[i];
  const points = tl.blue.gold.map((g, i) => ({ t: at(i), diff: g - tl.red.gold[i] }));

  const events: GoldEvent[] = [];
  for (const side of ["blue", "red"] as const) {
    const team = tl[side];
    for (let i = 1; i < n; i++) {
      for (let k = team.dragons[i - 1]; k < team.dragons[i]; k++) {
        const type = team.dragonTypes[k] ?? "";
        events.push({ t: at(i), side, kind: "dragon", label: DRAGON_NAME[type] ?? "Dragon" });
      }
      for (let k = team.barons[i - 1]; k < team.barons[i]; k++) {
        events.push({ t: at(i), side, kind: "baron", label: "Baron Nashor" });
      }
    }
  }
  events.sort((a, b) => a.t - b.t);

  const best = (side: Side): GoldLead | null => {
    const sign = side === "blue" ? 1 : -1;
    let top: GoldLead | null = null;
    for (const p of points)
      if (p.diff * sign > 0 && (!top || p.diff * sign > top.value)) top = { value: p.diff * sign, t: p.t };
    return top;
  };
  const lead = { blue: best("blue"), red: best("red") };
  const largest = Math.max(lead.blue?.value ?? 0, lead.red?.value ?? 0);
  const scale = SCALES.find((s) => s >= largest * 1.08) ?? Math.ceil((largest * 1.08) / 10000) * 10000;
  return { points, events, lead, end: tl.end, scale };
}

/** "12:30" from seconds. */
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "+6.2k", "-850", "+12k": gold for a label. */
export function goldLabel(value: number, signed = true): string {
  const sign = signed && value > 0 ? "+" : value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v < 1000) return `${sign}${Math.round(v)}`;
  const k = v / 1000;
  return `${sign}${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}
