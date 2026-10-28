/**
 * Chart builder config ↔ URL query string. Short keys keep links shareable:
 * /charts?d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10
 */
import {
  DEFAULT_CONFIG,
  type Aggregation,
  type ChartType,
  type ColorBy,
  type DataSource,
  type QueryConfig,
  type QueryFilters,
  type SortMode,
} from "@/lib/query";
import type { Role, Side, StageId } from "@/lib/data/types";

const SOURCES: DataSource[] = ["players", "teams", "champions", "games"];
const CHARTS: ChartType[] = ["bar", "groupedBar", "stackedBar", "line", "scatter", "radar", "heatmap", "boxplot"];
const AGGS: Aggregation[] = ["mean", "median", "sum", "max", "min", "perGame", "perMinute"];
const SORTS: SortMode[] = ["desc", "asc", "label"];
const COLORS: ColorBy[] = ["none", "region", "team", "role"];
const STAGES: StageId[] = ["playin", "swiss", "quarterfinals", "semifinals", "final"];
const ROLES: Role[] = ["top", "jungle", "mid", "bot", "support"];

const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T): T =>
  v && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const list = (v: string | undefined) =>
  v
    ? v
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export function parseFilters(text: string | null): QueryFilters {
  const f: QueryFilters = {};
  if (!text) return f;
  for (const part of text.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i);
    const value = part.slice(i + 1);
    switch (key) {
      case "stage":
        f.stages = list(value).filter((s): s is StageId => (STAGES as string[]).includes(s));
        break;
      case "team":
        f.teams = list(value);
        break;
      case "region":
        f.regions = list(value);
        break;
      case "role":
        f.roles = list(value).filter((r): r is Role => (ROLES as string[]).includes(r));
        break;
      case "side":
        if (value === "blue" || value === "red") f.side = value as Side;
        break;
      case "res":
        if (value === "win" || value === "loss") f.result = value;
        break;
      case "champ":
        f.champions = list(value);
        break;
      case "min": {
        const n = Number(value);
        if (Number.isInteger(n) && n >= 0) f.minGames = n;
        break;
      }
      case "dur": {
        const [a, b] = value.split("-");
        const min = Number(a);
        const max = Number(b);
        if (a !== "" && Number.isFinite(min)) f.durationMin = min;
        if (b !== undefined && b !== "" && Number.isFinite(max)) f.durationMax = max;
        break;
      }
    }
  }
  for (const k of Object.keys(f) as (keyof QueryFilters)[]) {
    const v = f[k];
    if (Array.isArray(v) && v.length === 0) delete f[k];
  }
  return f;
}

export function serializeFilters(f: QueryFilters): string {
  const parts: string[] = [];
  if (f.stages?.length) parts.push(`stage:${f.stages.join("|")}`);
  if (f.teams?.length) parts.push(`team:${f.teams.join("|")}`);
  if (f.regions?.length) parts.push(`region:${f.regions.join("|")}`);
  if (f.roles?.length) parts.push(`role:${f.roles.join("|")}`);
  if (f.side) parts.push(`side:${f.side}`);
  if (f.result) parts.push(`res:${f.result}`);
  if (f.champions?.length) parts.push(`champ:${f.champions.join("|")}`);
  if (f.minGames !== undefined) parts.push(`min:${f.minGames}`);
  if (f.durationMin !== undefined || f.durationMax !== undefined)
    parts.push(`dur:${f.durationMin ?? ""}-${f.durationMax ?? ""}`);
  return parts.join(";");
}

export function parseConfig(params: URLSearchParams): QueryConfig {
  const source = oneOf(SOURCES, params.get("d"), DEFAULT_CONFIG.source);
  const measures = (params.get("y") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const topRaw = params.get("n");
  const topN =
    topRaw === null
      ? DEFAULT_CONFIG.topN
      : topRaw === "all" || topRaw === "0"
        ? null
        : Number.isInteger(Number(topRaw)) && Number(topRaw) > 0
          ? Number(topRaw)
          : DEFAULT_CONFIG.topN;
  const filters = params.has("f") ? parseFilters(params.get("f")) : { ...DEFAULT_CONFIG.filters };
  return {
    source,
    measures: measures.length ? measures : [...DEFAULT_CONFIG.measures],
    groupBy: params.get("x") ?? DEFAULT_CONFIG.groupBy,
    series: params.get("s") || null,
    aggregation: oneOf(AGGS, params.get("a"), DEFAULT_CONFIG.aggregation),
    filters,
    chart: oneOf(CHARTS, params.get("t"), DEFAULT_CONFIG.chart),
    sort: oneOf(SORTS, params.get("o"), DEFAULT_CONFIG.sort),
    topN,
    colorBy: oneOf(COLORS, params.get("c"), DEFAULT_CONFIG.colorBy),
    showAverage: params.get("avg") === null ? DEFAULT_CONFIG.showAverage : params.get("avg") === "1",
    title: params.get("ttl") || null,
  };
}

/** Serialises a config, omitting values equal to the defaults. Filters are always written so an empty filter set is explicit. */
export function serializeConfig(config: QueryConfig): string {
  const p = new URLSearchParams();
  p.set("d", config.source);
  p.set("y", config.measures.join(","));
  p.set("x", config.groupBy);
  if (config.series) p.set("s", config.series);
  if (config.aggregation !== DEFAULT_CONFIG.aggregation) p.set("a", config.aggregation);
  p.set("f", serializeFilters(config.filters));
  p.set("t", config.chart);
  p.set("n", config.topN === null ? "all" : String(config.topN));
  if (config.sort !== DEFAULT_CONFIG.sort) p.set("o", config.sort);
  if (config.colorBy !== DEFAULT_CONFIG.colorBy) p.set("c", config.colorBy);
  if (config.showAverage !== DEFAULT_CONFIG.showAverage) p.set("avg", config.showAverage ? "1" : "0");
  if (config.title) p.set("ttl", config.title);
  return p.toString();
}
