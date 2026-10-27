import { HourglassIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown where a played game has no scoreboard yet, instead of zeros. */
export function PendingData({ className, text = "Data on the way" }: { className?: string; text?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-foreground", className)}
      title="Leaguepedia volunteers add scoreboards minutes to hours after each game. This page refreshes automatically."
    >
      <HourglassIcon className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}
