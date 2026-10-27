"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ChartColumnIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUnit, type ChartSpec, type ChartTable } from "@/lib/charts/spec";
import { cn } from "@/lib/utils";

const EChart = dynamic(() => import("./echart").then((m) => m.EChart), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/50" aria-hidden />,
});

export interface ChartProps {
  spec: ChartSpec;
  /** Accessible, generated description ("Bars: top 10 players by DPM; max 812, by X"). */
  description: string;
  table: ChartTable;
  title?: string;
  height?: number;
  className?: string;
}

/** Every chart ships with a "View as table" alternative and a textual description. */
export function Chart({ spec, description, table, title, height = 320, className }: ChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { resolvedTheme } = useTheme();
  const [themeKey, setThemeKey] = useState("dark");
  useEffect(() => setThemeKey(resolvedTheme ?? "dark"), [resolvedTheme]);

  return (
    <figure className={cn("rounded-xl border bg-card p-3 sm:p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {title ? <figcaption className="text-sm font-medium">{title}</figcaption> : <span />}
        <Button variant="outline" size="sm" onClick={() => setView(view === "chart" ? "table" : "chart")} aria-pressed={view === "table"}>
          {view === "chart" ? <TableIcon className="size-4" aria-hidden /> : <ChartColumnIcon className="size-4" aria-hidden />}
          {view === "chart" ? "View as table" : "View as chart"}
        </Button>
      </div>
      {view === "chart" ? (
        <div style={{ height }} role="img" aria-label={description}>
          <EChart spec={spec} themeKey={themeKey} />
        </div>
      ) : (
        <div className="scroll-x max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {table.columns.map((c, i) => (
                  <TableHead key={c} className={cn(i > 0 && "text-right")}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci} className={cn("tabular", ci > 0 && "text-right")}>
                      {typeof cell === "number" ? formatUnit(cell, unitForColumn(spec, ci)) : (cell ?? "–")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="sr-only">{description}</p>
    </figure>
  );
}

function unitForColumn(spec: ChartSpec, columnIndex: number) {
  if (spec.type === "scatter") return columnIndex === 1 ? spec.xUnit : spec.yUnit;
  if (spec.type === "radar") return "decimal1";
  return spec.unit;
}
