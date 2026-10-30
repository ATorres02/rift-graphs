import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { MiniBars, type MiniBarRow } from "@/components/charts/mini";
import { Spoiler } from "@/components/spoilers";
import { cn } from "@/lib/utils";

export interface Headline {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  /** Wrap the value in a spoiler (results). */
  spoiler?: boolean;
  /** A short ranking under the value, with a link to the full one in the chart builder. */
  ranking?: { rows: MiniBarRow[]; href: string };
}

/** Two or three automatic "headline" tiles at the top of a page. */
export function Headlines({ items, className }: { items: Headline[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul
      className={cn(
        "grid grid-cols-2 divide-border overflow-hidden rounded-md border bg-card sm:divide-x lg:grid-cols-3",
        className,
      )}
    >
      {items.map((h, i) => {
        const body = (
          <>
            <p className="kicker text-[11px] text-brand sm:text-xs">{h.label}</p>
            <p className="display mt-1 text-3xl font-bold tabular sm:text-4xl">
              {h.spoiler ? <Spoiler label="Reveal">{h.value}</Spoiler> : h.value}
            </p>
            {h.detail ? <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{h.detail}</p> : null}
          </>
        );
        return (
          <li key={i} className="min-w-0 border-b p-3 transition-colors hover:bg-accent/40 sm:border-b-0 sm:p-4">
            {h.href ? (
              <Link href={h.href} className="block no-underline">
                {body}
              </Link>
            ) : (
              body
            )}
            {h.ranking ? (
              <>
                <MiniBars rows={h.ranking.rows} compact className="mt-3" />
                <Link
                  href={h.ranking.href}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand no-underline hover:underline"
                >
                  Top 10 in Charts <ArrowUpRightIcon className="size-3.5" aria-hidden />
                </Link>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
