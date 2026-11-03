"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { MiniBars, type MiniBarRow } from "@/components/charts/mini";
import { cn } from "@/lib/utils";

export interface LeaderBoard {
  key: string;
  label: string;
  /** Tab name on a phone, where three full labels do not fit on one line. */
  short: string;
  /** The leader's value as shown, and who it is. */
  value: string;
  detail: string;
  playerHref: string;
  rows: MiniBarRow[];
  chartHref: string;
}

/**
 * The player leaders of the tournament: one ranking at a time behind tabs on a phone, all of them side by side on a
 * wide screen. Every panel is in the page from the start, so it reads without JavaScript.
 */
export function Leaders({ boards }: { boards: LeaderBoard[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div role="tablist" aria-label="Rankings" className="mb-3 flex gap-1 rounded-lg border bg-card p-1 lg:hidden">
        {boards.map((b, i) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            id={`leaders-tab-${b.key}`}
            aria-selected={i === active}
            aria-controls={`leaders-panel-${b.key}`}
            onClick={() => setActive(i)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              i === active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {b.short}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {boards.map((b, i) => (
          <section
            key={b.key}
            id={`leaders-panel-${b.key}`}
            role="tabpanel"
            aria-labelledby={`leaders-tab-${b.key}`}
            className={cn("rounded-xl border bg-card p-4", i === active ? "block" : "hidden", "lg:block")}
          >
            <h3 className="kicker text-xs text-brand">{b.label}</h3>
            <Link href={b.playerHref} className="mt-1 block no-underline">
              <span className="display block text-4xl font-bold tabular">{b.value}</span>
              <span className="text-sm text-muted-foreground">{b.detail}</span>
            </Link>
            <MiniBars rows={b.rows} compact className="mt-4" />
            <Link
              href={b.chartHref}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand no-underline hover:underline"
            >
              Top 10 in Charts <ArrowUpRightIcon className="size-3.5" aria-hidden />
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
