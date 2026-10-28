import { CircleDashedIcon } from "lucide-react";
import type { DataSource, Meta } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const TITLES: Record<DataSource, string> = {
  leaguepedia: "Confirmed by Leaguepedia.",
  manual:
    "Provisional: typed by hand from the broadcast. Leaguepedia has not confirmed it yet, so it is not counted in rankings.",
  lolesports:
    "Provisional: result from lolesports.com. Leaguepedia has not confirmed it yet, so it is not counted in rankings.",
};

/** Small dashed tag for a series or game whose result Leaguepedia has not confirmed. */
export function ProvisionalBadge({ source = "lolesports", className }: { source?: DataSource; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-dashed border-amber-500/60 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400",
        className,
      )}
      title={TITLES[source]}
    >
      <CircleDashedIcon className="size-3" aria-hidden />
      Provisional
    </span>
  );
}

/** One-line note for list pages when the dataset holds provisional results. Renders nothing otherwise. */
export function ProvisionalNote({ meta, className }: { meta: Meta; className?: string }) {
  const s = meta.provisional.seriesIds.length;
  const g = meta.provisional.gameIds.length;
  if (!s && !g) return null;
  const what = [s ? `${s} series` : null, g ? `${g} game${g === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ");
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <ProvisionalBadge />
      <span>
        {what} {s + g === 1 ? "has" : "have"} a provisional result (from lolesports.com or typed by hand). Provisional
        results count for records, standings and the bracket; player and champion stats and the chart builder only use
        games confirmed by Leaguepedia.
      </span>
    </p>
  );
}
