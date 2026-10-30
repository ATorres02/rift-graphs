/**
 * Bracket layouts for the Swiss stage and the knockout stage, derived from the
 * schedule. Cargo has no Swiss record per series nor "feeds into" links, so the
 * group of a Swiss series is the record its teams had before that round, and the
 * knockout tree follows the standard order until the semifinal teams are known.
 */
import type { Series, StageId } from "./data/types";
import { SWISS_TARGET } from "./standings";

export interface BracketGroup {
  kind: "group";
  key: string;
  round: number;
  wins: number;
  losses: number;
  /** Series in display order; null marks a slot whose series is not on the schedule (or not placed) yet. */
  slots: (Series | null)[];
  bestOf: number | null;
  /** First start (ISO) of each broadcast day the group is played on, see `broadcastDays`. */
  days: string[];
}

export interface BracketOutcome {
  kind: "outcome";
  key: string;
  result: "qualified" | "eliminated";
  wins: number;
  losses: number;
  /** Teams that finished with this record, in the order they got there. */
  teamIds: string[];
  slots: number;
  /** Final places this record is worth, e.g. "1st–2nd". */
  places: string;
}

export type SwissBlock = BracketGroup | BracketOutcome;

export interface SwissColumn {
  /** Round played in this column; the last column only holds the records decided in the final round. */
  round: number;
  /** True for the last column (no series, only qualified and eliminated boxes). */
  outcomesOnly: boolean;
  blocks: SwissBlock[];
}

export interface SwissBracket {
  columns: SwissColumn[];
  rounds: number;
  /** First round with a series still to finish, null once the stage is over. */
  currentRound: number | null;
}

const ordinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

const places = (from: number, count: number): string =>
  count <= 1 ? ordinal(from) : `${ordinal(from)}–${ordinal(from + count - 1)}`;

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

const byDate = (a: Series, b: Series) => a.dateTimeUtc.localeCompare(b.dateTimeUtc) || a.id.localeCompare(b.id);

/**
 * Splits start times into broadcast days: a series that starts within `gapHours` of the previous one belongs to the
 * same day, so a midnight UTC series stays on the day its block began. Maps each start to the first start of its day.
 */
export function broadcastDays(isos: string[], gapHours = 6): Map<string, string> {
  const days = new Map<string, string>();
  let last = -Infinity;
  let day = "";
  for (const iso of [...isos].sort()) {
    const t = Date.parse(iso);
    if (t - last > gapHours * 3_600_000) day = iso;
    days.set(iso, day);
    last = t;
  }
  return days;
}

/**
 * Swiss bracket: one column per round with a group per record (1-0, 0-1...), then the qualified and eliminated boxes
 * in the column after the round that decides them, the way the official graphic draws it.
 */
export function swissBracket(series: Series[], teamIds: string[], target = SWISS_TARGET): SwissBracket {
  const rounds = target * 2 - 1;
  const teamCount = teamIds.length;
  const swiss = series.filter((s) => s.stage === "swiss" && s.round !== null).sort(byDate);
  const roundOf = (s: Series) => s.round as number;
  // Days are split over the whole stage: a group's lone late series still belongs to that evening's broadcast.
  const dayOf = broadcastDays(swiss.map((s) => s.dateTimeUtc));

  // Teams expected with a given record when nobody has stopped yet: N * C(w+l, w) / 2^(w+l).
  const expectedTeams = (w: number, l: number) => Math.round((teamCount * binomial(w + l, w)) / 2 ** (w + l));

  // Records before each round, and the order teams reached 3 wins or 3 losses.
  const record = new Map(teamIds.map((id) => [id, { wins: 0, losses: 0 }]));
  const before = new Map<number, Map<string, { wins: number; losses: number }>>();
  const finishedOrder = new Map<string, string[]>();
  for (let r = 1; r <= rounds; r++) {
    before.set(r, new Map(Array.from(record, ([id, rec]) => [id, { ...rec }])));
    for (const s of swiss.filter((x) => roundOf(x) === r && x.status === "finished" && x.winnerId)) {
      for (const id of [s.team1Id, s.team2Id]) {
        const rec = id ? record.get(id) : undefined;
        if (!id || !rec) continue;
        if (s.winnerId === id) rec.wins += 1;
        else rec.losses += 1;
        if (rec.wins === target || rec.losses === target) {
          const key = `${rec.wins}-${rec.losses}`;
          finishedOrder.set(key, [...(finishedOrder.get(key) ?? []), id]);
        }
      }
    }
  }

  // Places: qualified records from the fewest losses down, then eliminated ones from the most wins down.
  const placeOf = new Map<string, string>();
  let next = 1;
  for (let l = 0; l < target; l++) {
    const n = expectedTeams(target - 1, l) / 2;
    placeOf.set(`${target}-${l}`, places(next, n));
    next += n;
  }
  for (let w = target - 1; w >= 0; w--) {
    const n = expectedTeams(w, target - 1) / 2;
    placeOf.set(`${w}-${target}`, places(next, n));
    next += n;
  }

  const columns: SwissColumn[] = [];
  for (let c = 1; c <= rounds + 1; c++) {
    const played = c - 1;
    const blocks: SwissBlock[] = [];
    for (let w = Math.min(played, target); w >= 0; w--) {
      const l = played - w;
      if (l > target || (w === target && l === target)) continue;
      const key = `${w}-${l}`;
      if (w === target || l === target) {
        const from = w === target ? expectedTeams(target - 1, l) : expectedTeams(w, target - 1);
        blocks.push({
          kind: "outcome",
          key: `out-${key}`,
          result: w === target ? "qualified" : "eliminated",
          wins: w,
          losses: l,
          teamIds: finishedOrder.get(key) ?? [],
          slots: from / 2,
          places: placeOf.get(key) ?? "",
        });
      } else if (c <= rounds) {
        blocks.push({
          kind: "group",
          key: `r${c}-${key}`,
          round: c,
          wins: w,
          losses: l,
          slots: [],
          bestOf: null,
          days: [],
        });
      }
    }
    columns.push({ round: Math.min(c, rounds), outcomesOnly: c > rounds, blocks });
  }

  for (const col of columns) {
    if (col.outcomesOnly) continue;
    const r = col.round;
    const groups = col.blocks.filter((b): b is BracketGroup => b.kind === "group");
    const records = before.get(r)!;
    const capacity = (g: BracketGroup) => expectedTeams(g.wins, g.losses) / 2;
    const roundSeries = swiss.filter((s) => roundOf(s) === r);
    const unplaced: Series[] = [];
    for (const s of roundSeries) {
      const known = [s.team1Id, s.team2Id].find((id) => id && records.has(id));
      const rec = known ? records.get(known)! : null;
      const group = rec ? groups.find((g) => g.wins === rec.wins && g.losses === rec.losses) : undefined;
      if (group) group.slots.push(s);
      else unplaced.push(s);
    }
    // A series without teams can only be placed when a single group still has room (round 5, or late rounds).
    for (const s of unplaced) {
      const open = groups.filter((g) => g.slots.length < capacity(g));
      if (open.length === 1) open[0].slots.push(s);
    }
    const roundBestOf = new Set(roundSeries.map((s) => s.bestOf));
    for (const g of groups) {
      const placed = g.slots.filter((s): s is Series => s !== null);
      const bestOf = new Set(placed.map((s) => s.bestOf));
      g.bestOf = bestOf.size === 1 ? [...bestOf][0] : roundBestOf.size === 1 ? [...roundBestOf][0] : null;
      g.days = Array.from(new Set((placed.length ? placed : roundSeries).map((s) => dayOf.get(s.dateTimeUtc)!))).sort();
      while (g.slots.length < capacity(g)) g.slots.push(null);
    }
  }

  const unfinished = swiss.filter((s) => s.status !== "finished").map(roundOf);
  return { columns, rounds, currentRound: unfinished.length ? Math.min(...unfinished) : null };
}

export interface KnockoutColumn {
  stage: Extract<StageId, "quarterfinals" | "semifinals" | "final">;
  /** Series top to bottom: each pair of a column feeds the series at the same position in the next one. */
  slots: (Series | null)[];
}

export interface KnockoutBracket {
  columns: KnockoutColumn[];
  championId: string | null;
  /** First stage with a series still to finish, null once the final is over. */
  currentStage: KnockoutColumn["stage"] | null;
}

const KNOCKOUT_STAGES: KnockoutColumn["stage"][] = ["quarterfinals", "semifinals", "final"];

/** Orders `feeders` so that each pair produces the teams of the series at the same position in `targets`. */
function orderFeeders(feeders: Series[], targets: (Series | null)[]): (Series | null)[] {
  const pairs: Series[][] = targets.map(() => []);
  const used = new Set<string>();
  targets.forEach((t, i) => {
    for (const id of [t?.team1Id, t?.team2Id]) {
      const from = id ? feeders.find((f) => f.winnerId === id && !used.has(f.id)) : undefined;
      if (from) {
        pairs[i].push(from);
        used.add(from.id);
      }
    }
  });
  const rest = feeders.filter((f) => !used.has(f.id));
  for (const pair of pairs) while (pair.length < 2 && rest.length) pair.push(rest.shift()!);
  const ordered: (Series | null)[] = pairs.flatMap((p) => [...p.sort(byDate), ...Array(2 - p.length).fill(null)]);
  return [...ordered, ...rest];
}

/** Knockout bracket (quarterfinals, semifinals, final), or null when the schedule has no knockout series yet. */
export function knockoutBracket(series: Series[]): KnockoutBracket | null {
  const of = (stage: StageId) => series.filter((s) => s.stage === stage).sort(byDate);
  const qf = of("quarterfinals");
  const sf = of("semifinals");
  const final = of("final");
  if (!qf.length && !sf.length && !final.length) return null;

  const finals: (Series | null)[] = final.length ? final : [null];
  const semis = orderFeeders(sf, finals);
  const quarters = orderFeeders(qf, semis);
  const columns: KnockoutColumn[] = [
    { stage: "quarterfinals", slots: quarters },
    { stage: "semifinals", slots: semis },
    { stage: "final", slots: finals },
  ];
  const last = final[0];
  const unfinished = KNOCKOUT_STAGES.find((st) => of(st).some((s) => s.status !== "finished"));
  return {
    columns,
    championId: last?.status === "finished" ? last.winnerId : null,
    currentStage: unfinished ?? null,
  };
}

/** The homepage shows the Swiss bracket until every Swiss series is over and the knockout series exist. */
export function homeBracket(series: Series[]): "swiss" | "knockout" {
  const swiss = series.filter((s) => s.stage === "swiss");
  const knockout = series.some((s) => KNOCKOUT_STAGES.includes(s.stage as KnockoutColumn["stage"]));
  return knockout && swiss.length > 0 && swiss.every((s) => s.status === "finished") ? "knockout" : "swiss";
}
