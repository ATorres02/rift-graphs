"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Stats, builds and runes of one game, one panel at a time. Every panel is in the page from the start (only hidden),
 * so it reads without JavaScript and search engines see the item and rune names.
 */
export function GameTabs({ id, tabs }: { id: string; tabs: { key: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Game details" className="flex w-fit gap-1 rounded-lg border bg-card p-1">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel-${t.key}`}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              i === active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.key}
          id={`${id}-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${t.key}`}
          hidden={i !== active}
          className="space-y-3"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
