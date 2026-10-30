"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { Chart } from "@/components/charts/chart";
import type { EChartsInstance } from "@/components/charts/echart";
import { RoleGlyph } from "@/components/rift/role-glyph";
import { TeamPill } from "@/components/team-pill";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tableToCsv } from "@/lib/charts/build";
import { composeChartPng, downloadDataUrl, downloadText } from "@/lib/charts/export-png";
import type { RadarSpec, Unit } from "@/lib/charts/spec";
import { formatUnit } from "@/lib/charts/spec";
import type { TeamRef } from "@/lib/data/load";
import { slugify } from "@/lib/data/ids";
import type { Role } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import { DEFAULT_MIN_GAMES } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { chartHref, compareChart } from "@/lib/charts/page-charts";

export interface CompareMetric {
  key: string;
  label: string;
  unit: Unit;
  /** Lower is better (e.g. deaths). */
  lowerIsBetter?: boolean;
  /** Included in the radar (at most 8). */
  radar?: boolean;
}

export interface CompareEntity {
  id: string;
  label: string;
  /** Secondary line (team, role, or region). */
  detail: string;
  team?: TeamRef | null;
  role?: Role;
  games: number;
  color: string;
  values: Record<string, number | null>;
}

export interface CompareGroup {
  type: "players" | "teams";
  label: string;
  metrics: CompareMetric[];
  entities: CompareEntity[];
}

const selectClass =
  "h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";
const chipClass =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50";

function ordinal(n: number): string {
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function CompareTool({ groups }: { groups: CompareGroup[] }) {
  const [type, setType] = useState<CompareGroup["type"]>("players");
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [sameRole, setSameRole] = useState(false);
  const [sameTeam, setSameTeam] = useState(false);
  const [ready, setReady] = useState(false);
  const chartRef = useRef<EChartsInstance | null>(null);

  const group = groups.find((g) => g.type === type) ?? groups[0];

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("type") === "teams" ? "teams" : "players";
    const g = groups.find((x) => x.type === t) ?? groups[0];
    const first = p.get("a") && g.entities.some((e) => e.id === p.get("a")) ? p.get("a")! : (g.entities[0]?.id ?? "");
    const second =
      p.get("b") && g.entities.some((e) => e.id === p.get("b")) && p.get("b") !== first
        ? p.get("b")!
        : (g.entities.find((e) => e.id !== first)?.id ?? "");
    setType(g.type);
    setA(first);
    setB(second);
    setReady(true);
  }, [groups]);

  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams({ type, a, b });
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, [type, a, b, ready]);

  const switchType = (t: CompareGroup["type"]) => {
    const g = groups.find((x) => x.type === t) ?? groups[0];
    setType(g.type);
    setA(g.entities[0]?.id ?? "");
    setB(g.entities[1]?.id ?? "");
    setSameRole(false);
    setSameTeam(false);
  };

  const ea = group.entities.find((e) => e.id === a) ?? null;
  const eb = group.entities.find((e) => e.id === b) ?? null;

  /** Candidates for the second slot: narrowed to the first pick's role or team when asked. */
  const secondOptions = group.entities.filter(
    (e) =>
      e.id !== a &&
      (!sameRole || !ea?.role || e.role === ea.role) &&
      (!sameTeam || !ea?.team || e.team?.id === ea.team.id),
  );
  useEffect(() => {
    if (ready && eb && !secondOptions.some((e) => e.id === eb.id)) setB(secondOptions[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameRole, sameTeam, a]);

  /** Position of an entity on a metric among those with enough games (players) or everyone (teams). */
  const ranked = useMemo(() => {
    const eligible = group.entities.filter((e) => group.type === "teams" || e.games >= DEFAULT_MIN_GAMES);
    const byMetric = new Map<string, Map<string, number>>();
    for (const m of group.metrics) {
      const sorted = eligible
        .filter((e) => e.values[m.key] !== null)
        .sort((x, y) => (m.lowerIsBetter ? x.values[m.key]! - y.values[m.key]! : y.values[m.key]! - x.values[m.key]!));
      byMetric.set(m.key, new Map(sorted.map((e, i) => [e.id, i + 1])));
    }
    return { byMetric, of: eligible.length };
  }, [group]);
  const rankOf = (m: CompareMetric, e: CompareEntity) => ranked.byMetric.get(m.key)?.get(e.id) ?? null;

  const radar = useMemo<RadarSpec | null>(() => {
    if (!ea || !eb) return null;
    const metrics = group.metrics.filter((m) => m.radar).slice(0, 8);
    return {
      type: "radar",
      indicators: metrics.map((m) => ({
        name: m.label,
        max: Math.max(...group.entities.map((e) => e.values[m.key] ?? 0), 0.0001),
        unit: m.unit,
      })),
      // Two sides from the same region would share a colour: the second one takes the brand blue instead.
      series: [ea, eb].map((e, i) => ({
        name: e.label,
        values: metrics.map((m) => e.values[m.key] ?? 0),
        color: i === 1 && ea.color === eb.color ? "var(--brand)" : e.color,
      })),
    };
  }, [ea, eb, group]);

  const exportTable = () => {
    if (!ea || !eb) return null;
    const cell = (m: CompareMetric, e: CompareEntity) => {
      const r = rankOf(m, e);
      return `${formatUnit(e.values[m.key], m.unit)}${r ? ` (${ordinal(r)})` : ""}`;
    };
    return {
      columns: ["Metric", ea.label, eb.label, "Difference"],
      rows: [
        ["Games", ea.games, eb.games, null] as (string | number | null)[],
        ...group.metrics.map((m) => {
          const va = ea.values[m.key];
          const vb = eb.values[m.key];
          const diff = va !== null && vb !== null ? va - vb : null;
          return [
            m.label,
            cell(m, ea),
            cell(m, eb),
            diff === null ? null : `${diff > 0 ? "+" : ""}${formatUnit(diff, m.unit)}`,
          ];
        }),
      ],
    };
  };
  const fileName = () => slugify(`${ea?.label ?? "a"} vs ${eb?.label ?? "b"}`) || "compare";
  const exportPng = async () => {
    const instance = chartRef.current;
    const table = exportTable();
    if (!instance || !ea || !eb || !table) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#ffffff";
    const url = await composeChartPng({
      title: `${ea.label} vs ${eb.label}`,
      summary: `${ea.label} (${ea.detail}) and ${eb.label} (${eb.detail}) side by side. Positions in brackets are ranks among the ${ranked.of} ${group.label.toLowerCase()}${group.type === "players" ? ` with at least ${DEFAULT_MIN_GAMES} games` : ""}.`,
      chartDataUrl: instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg }),
      table,
    });
    downloadDataUrl(url, `${fileName()}.png`);
  };
  const exportCsv = () => {
    const table = exportTable();
    if (table) downloadText(tableToCsv(table), `${fileName()}.csv`);
  };

  const who = (e: CompareEntity) => (
    <span className="inline-flex items-center justify-end gap-1.5">
      {e.team ? <TeamPill team={e.team} size="sm" /> : null}
      <span>{e.label}</span>
      {e.role ? <RoleGlyph kind={e.role} className="size-4 text-muted-foreground" /> : null}
      {e.role ? <span className="sr-only">{ROLE_LABEL[e.role]}</span> : null}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <div role="radiogroup" aria-label="Compare" className="flex gap-1 self-start rounded-md border p-1">
          {groups.map((g) => (
            <button
              key={g.type}
              type="button"
              role="radio"
              aria-checked={type === g.type}
              onClick={() => switchType(g.type)}
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                type === g.type ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">
          First
          <select className={selectClass} value={a} onChange={(e) => setA(e.target.value)}>
            {group.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}, {e.detail}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1.5">
          <label className="block text-xs text-muted-foreground">
            Second
            <select className={selectClass} value={b} onChange={(e) => setB(e.target.value)}>
              {secondOptions.length === 0 ? <option value="">Nobody else matches these filters</option> : null}
              {secondOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}, {e.detail}
                </option>
              ))}
            </select>
          </label>
          {group.type === "players" && ea ? (
            <div role="group" aria-label="Narrow the second list" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={sameRole}
                onClick={() => setSameRole((v) => !v)}
                className={cn(
                  chipClass,
                  sameRole ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
                )}
              >
                Same role{ea.role ? ` (${ROLE_LABEL[ea.role]})` : ""}
              </button>
              <button
                type="button"
                aria-pressed={sameTeam}
                onClick={() => setSameTeam((v) => !v)}
                className={cn(
                  chipClass,
                  sameTeam ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
                )}
              >
                Same team{ea.team ? ` (${ea.team.short})` : ""}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {ea && eb && radar ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={exportPng}>
              <DownloadIcon className="size-4" aria-hidden />
              PNG with table
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileSpreadsheetIcon className="size-4" aria-hidden />
              CSV
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart
              builderHref={
                ea && eb
                  ? chartHref(
                      compareChart(
                        group.type,
                        ea.id,
                        eb.id,
                        group.metrics
                          .filter((m) => m.radar)
                          .slice(0, 8)
                          .map((m) => m.key),
                      ),
                    )
                  : undefined
              }
              spec={radar}
              table={{
                columns: ["Metric", ea.label, eb.label],
                rows: radar.indicators.map((ind, i) => [
                  ind.name,
                  radar.series[0].values[i],
                  radar.series[1].values[i],
                ]),
              }}
              height={380}
              title={`${ea.label} vs ${eb.label}`}
              description={`Radar comparing ${ea.label} and ${eb.label} on ${radar.indicators.map((i) => i.name).join(", ")}.`}
              onReady={(instance) => (chartRef.current = instance)}
            />
            <div className="scroll-x rounded-xl border bg-card">
              <Table>
                <caption className="sr-only">Metric differences</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">{who(ea)}</TableHead>
                    <TableHead className="text-right">{who(eb)}</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Games</TableCell>
                    <TableCell className="text-right tabular">{ea.games}</TableCell>
                    <TableCell className="text-right tabular">{eb.games}</TableCell>
                    <TableCell />
                  </TableRow>
                  {group.metrics.map((m) => {
                    const va = ea.values[m.key];
                    const vb = eb.values[m.key];
                    const diff = va !== null && vb !== null ? va - vb : null;
                    const aBetter = diff !== null && diff !== 0 && (m.lowerIsBetter ? diff < 0 : diff > 0);
                    const bBetter = diff !== null && diff !== 0 && !aBetter;
                    const ra = rankOf(m, ea);
                    const rb = rankOf(m, eb);
                    return (
                      <TableRow key={m.key}>
                        <TableCell className="text-muted-foreground">{m.label}</TableCell>
                        <TableCell className={cn("text-right tabular", aBetter && "font-semibold text-brand")}>
                          {formatUnit(va, m.unit)}
                          {ra ? (
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{ordinal(ra)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className={cn("text-right tabular", bBetter && "font-semibold text-brand")}>
                          {formatUnit(vb, m.unit)}
                          {rb ? (
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{ordinal(rb)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {diff === null ? "–" : `${diff > 0 ? "+" : ""}${formatUnit(diff, m.unit)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Small numbers are positions among the {ranked.of} {group.label.toLowerCase()}
                {group.type === "players" ? ` with at least ${DEFAULT_MIN_GAMES} games` : ""}.
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pick two {group.label.toLowerCase()} to compare.</p>
      )}
    </div>
  );
}
