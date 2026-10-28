/**
 * Manual game files: one JSON per game in data/manual/, written by hand (even
 * from a phone on github.com) when a game has been played but Leaguepedia has
 * not published it yet. They are provisional: a validated Leaguepedia game with
 * the same id replaces them. A file that does not validate is ignored and
 * reported in meta.json; it never breaks the build.
 *
 * File name: `<series>-g<n>.json` (series id as in the site URL, game number).
 * Keys starting with "_" are ignored (used for help text in the template).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { roleSchema, stageIdSchema } from "../data/schema";

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, "ISO 8601 UTC datetime, e.g. 2026-10-28T20:00:00Z");
const champion = z.string().trim().min(1);
const counter = z.number().int().nonnegative();

const objectivesSchema = z.object({
  kills: counter.optional(),
  gold: z.number().nonnegative().optional(),
  towers: counter.optional(),
  inhibitors: counter.optional(),
  dragons: counter.optional(),
  elders: counter.optional(),
  barons: counter.optional(),
  heralds: counter.optional(),
  voidGrubs: counter.optional(),
});

const lineSchema = z.object({
  player: z.string().trim().min(1),
  role: roleSchema,
  kills: counter.optional(),
  deaths: counter.optional(),
  assists: counter.optional(),
});

export const manualGameSchema = z.object({
  series: z.string().trim().min(1),
  game: z.number().int().positive(),
  // Only needed when the series is not in the dataset yet (e.g. a knockout series just paired).
  stage: stageIdSchema.optional(),
  date: isoDateTime.optional(),
  bestOf: z.number().int().positive().optional(),
  teams: z.object({ team1: z.string().trim().min(1), team2: z.string().trim().min(1) }).optional(),
  blue: z.string().trim().min(1),
  red: z.string().trim().min(1),
  winner: z.string().trim().min(1),
  /** "mm:ss" or seconds. */
  duration: z.union([
    z.string().regex(/^\d{1,3}:[0-5]\d$/, 'duration must be "mm:ss" or a number of seconds'),
    z.number().int().positive(),
  ]),
  /** Five champions per side in role order: top, jungle, mid, bot, support. */
  picks: z.object({ blue: z.array(champion).length(5), red: z.array(champion).length(5) }),
  /** Bans in the order they were taken, up to five per side. */
  bans: z.object({ blue: z.array(champion).max(5), red: z.array(champion).max(5) }).optional(),
  objectives: z.object({ blue: objectivesSchema, red: objectivesSchema }).optional(),
  players: z.object({ blue: z.array(lineSchema).length(5), red: z.array(lineSchema).length(5) }).optional(),
  patch: z.string().trim().min(1).optional(),
  vod: z.string().url().optional(),
});

export type ManualGame = z.infer<typeof manualGameSchema>;
export type ManualObjectives = z.infer<typeof objectivesSchema>;

export interface ManualEntry {
  file: string;
  data: ManualGame;
}

export interface ManualLoad {
  entries: ManualEntry[];
  invalid: { file: string; error: string }[];
}

export const MANUAL_FILE_PATTERN = /^(.+)-g(\d+)\.json$/;

export function parseDuration(value: string | number): number {
  if (typeof value === "number") return value;
  const [m, s] = value.split(":").map(Number);
  return m * 60 + s;
}

/** Validates one file's parsed JSON. `file` is the base name, used to check the naming convention. */
export function validateManualFile(
  file: string,
  raw: unknown,
): { ok: true; data: ManualGame } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, error: "the file must contain a JSON object" };
  const known = new Set(Object.keys(manualGameSchema.shape));
  const unknown = Object.keys(raw).filter((k) => !k.startsWith("_") && !known.has(k));
  if (unknown.length) return { ok: false, error: `unknown field(s): ${unknown.join(", ")}` };
  const parsed = manualGameSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
    };
  }
  const d = parsed.data;
  const m = MANUAL_FILE_PATTERN.exec(file);
  if (!m) return { ok: false, error: `file name must be <series>-g<n>.json` };
  if (m[1] !== d.series || Number(m[2]) !== d.game) {
    return {
      ok: false,
      error: `file name says series "${m[1]}" game ${m[2]} but the content says "${d.series}" game ${d.game}`,
    };
  }
  if (d.blue === d.red) return { ok: false, error: "blue and red must be different teams" };
  if (d.winner !== d.blue && d.winner !== d.red)
    return { ok: false, error: `winner "${d.winner}" must be the blue or the red team` };
  if (d.teams && new Set([d.teams.team1, d.teams.team2]).size !== 2)
    return { ok: false, error: "teams.team1 and teams.team2 must be different" };
  return { ok: true, data: d };
}

/** Reads every `*.json` in `dir` except files starting with "_". A missing directory yields nothing. */
export async function loadManualDir(dir: string): Promise<ManualLoad> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json") && !n.startsWith("_")).sort();
  } catch {
    return { entries: [], invalid: [] };
  }
  const out: ManualLoad = { entries: [], invalid: [] };
  for (const file of names) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    } catch (err) {
      out.invalid.push({ file, error: `not valid JSON: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    const result = validateManualFile(file, raw);
    if (result.ok) out.entries.push({ file, data: result.data });
    else out.invalid.push({ file, error: result.error });
  }
  out.entries.sort((a, b) => a.data.series.localeCompare(b.data.series) || a.data.game - b.data.game);
  return out;
}
