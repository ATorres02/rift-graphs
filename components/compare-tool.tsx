"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart } from "@/components/charts/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RadarSpec, Unit } from "@/lib/charts/spec";
import { formatUnit } from "@/lib/charts/spec";
import { cn } from "@/lib/utils";

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
  /** Secondary line (team · role, or region). */
  detail: string;
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

export function CompareTool({ groups }: { groups: CompareGroup[] }) {
  const [type, setType] = useState<CompareGroup["type"]>("players");
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [ready, setReady] = useState(false);

  const group = groups.find((g) => g.type === type) ?? groups[0];

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("type") === "teams" ? "teams" : "players";
    const g = groups.find((x) => x.type === t) ?? groups[0];
    setType(g.type);
    setA(p.get("a") && g.entities.some((e) => e.id === p.get("a")) ? p.get("a")! : (g.entities[0]?.id ?? ""));
    setB(p.get("b") && g.entities.some((e) => e.id === p.get("b")) ? p.get("b")! : (g.entities[1]?.id ?? ""));
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
  };

  const ea = group.entities.find((e) => e.id === a) ?? null;
  const eb = group.entities.find((e) => e.id === b) ?? null;

  const radar = useMemo<RadarSpec | null>(() => {
    if (!ea || !eb) return null;
    const metrics = group.metrics.filter((m) => m.radar).slice(0, 8);
    return {
      type: "radar",
      indicators: metrics.map((m) => ({
        name: m.label,
        max: Math.max(...group.entities.map((e) => e.values[m.key] ?? 0), 0.0001),
      })),
      series: [ea, eb].map((e) => ({
        name: e.label,
        values: metrics.map((m) => e.values[m.key] ?? 0),
        color: e.color,
      })),
    };
  }, [ea, eb, group]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
        <div role="radiogroup" aria-label="Compare" className="flex gap-1 rounded-md border p-1">
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
        {[
          { value: a, set: setA, label: "First" },
          { value: b, set: setB, label: "Second" },
        ].map((s) => (
          <label key={s.label} className="text-xs text-muted-foreground">
            {s.label}
            <select className={selectClass} value={s.value} onChange={(e) => s.set(e.target.value)}>
              {group.entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label} · {e.detail}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {ea && eb && radar ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Chart
            spec={radar}
            table={{
              columns: ["Metric", ea.label, eb.label],
              rows: radar.indicators.map((ind, i) => [ind.name, radar.series[0].values[i], radar.series[1].values[i]]),
            }}
            height={380}
            title={`${ea.label} vs ${eb.label}`}
            description={`Radar comparing ${ea.label} and ${eb.label} on ${radar.indicators.map((i) => i.name).join(", ")}.`}
          />
          <div className="scroll-x rounded-xl border bg-card">
            <Table>
              <caption className="sr-only">Metric differences</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">{ea.label}</TableHead>
                  <TableHead className="text-right">{eb.label}</TableHead>
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
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="text-muted-foreground">{m.label}</TableCell>
                      <TableCell className={cn("text-right tabular", aBetter && "font-semibold text-brand")}>
                        {formatUnit(va, m.unit)}
                      </TableCell>
                      <TableCell className={cn("text-right tabular", bBetter && "font-semibold text-brand")}>
                        {formatUnit(vb, m.unit)}
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {diff === null ? "–" : `${diff > 0 ? "+" : ""}${formatUnit(diff, m.unit)}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Pick two {group.label.toLowerCase()} to compare.</p>
      )}
    </div>
  );
}
