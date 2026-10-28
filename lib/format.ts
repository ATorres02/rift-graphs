import type { Role, StageId } from "./data/types";

const intFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = {
  int: (n: number): string => intFormat.format(Math.round(n)),
  dec: (n: number, digits = 1): string => n.toFixed(digits),
  /** Fraction (0–1) → "63%" */
  pct: (f: number | null, digits = 0): string =>
    f === null || Number.isNaN(f) ? "–" : `${(f * 100).toFixed(digits)}%`,
  compact: (n: number): string => compactFormat.format(n),
  /** Seconds → "32:05" */
  duration: (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  },
  /** Seconds → "32m 05s" for prose */
  durationLong: (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  },
  signed: (n: number, digits = 0): string => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`,
  record: (wins: number, losses: number): string => `${wins}–${losses}`,
};

export const ROLE_LABEL: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  bot: "Bot",
  support: "Support",
};

export const STAGE_LABEL: Record<StageId, string> = {
  playin: "Play-In",
  swiss: "Swiss Stage",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

export const STAGE_SHORT: Record<StageId, string> = {
  playin: "Play-In",
  swiss: "Swiss",
  quarterfinals: "QF",
  semifinals: "SF",
  final: "Final",
};

export function roundLabel(stage: StageId, round: number | null, tab: string): string {
  if (stage === "swiss" && round) return `Swiss, Round ${round}`;
  if (stage === "playin" && round) return `Play-In, Round ${round}`;
  if (stage === "playin") return `Play-In, ${tab}`;
  return STAGE_LABEL[stage];
}

/** Day key (YYYY-MM-DD) in UTC, used to group the schedule server-side. */
export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

export const bestOfLabel = (bestOf: number): string => `Bo${bestOf}`;

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** YYYY-MM-DD dates → "15 to 18 Oct", "28 Oct to 3 Nov" or "14 Nov". */
export function dateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const a = new Date(`${start}T00:00:00Z`);
  if (!end || end === start) return dayMonth.format(a);
  const b = new Date(`${end}T00:00:00Z`);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return sameMonth ? `${a.getUTCDate()} to ${dayMonth.format(b)}` : `${dayMonth.format(a)} to ${dayMonth.format(b)}`;
}
