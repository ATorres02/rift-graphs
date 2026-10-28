"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ChartColumnIcon, TableIcon } from "lucide-react";
import { SpecTable } from "@/components/charts/chart-table";
import { Button } from "@/components/ui/button";
import type { ChartSpec, ChartTable } from "@/lib/charts/spec";
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

/** Hook that re-reads the CSS palette when the theme flips. */
export function useThemeKey(): string {
  const { resolvedTheme } = useTheme();
  const [themeKey, setThemeKey] = useState("dark");
  useEffect(() => setThemeKey(resolvedTheme ?? "dark"), [resolvedTheme]);
  return themeKey;
}

/** Every chart ships with a "View as table" alternative and a textual description. */
export function Chart({ spec, description, table, title, height = 320, className }: ChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const themeKey = useThemeKey();

  return (
    <figure className={cn("rounded-xl border bg-card p-3 sm:p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {title ? <figcaption className="text-sm font-medium">{title}</figcaption> : <span />}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          aria-pressed={view === "table"}
        >
          {view === "chart" ? (
            <TableIcon className="size-4" aria-hidden />
          ) : (
            <ChartColumnIcon className="size-4" aria-hidden />
          )}
          {view === "chart" ? "View as table" : "View as chart"}
        </Button>
      </div>
      {view === "chart" ? (
        <div style={{ height }} role="img" aria-label={description}>
          <EChart spec={spec} themeKey={themeKey} />
        </div>
      ) : (
        <SpecTable spec={spec} table={table} />
      )}
      <p className="sr-only">{description}</p>
    </figure>
  );
}
