import Link from "next/link";
import type { ReactNode } from "react";
import { Spoiler } from "@/components/spoilers";
import { cn } from "@/lib/utils";

export interface Headline {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  /** Wrap the value in a spoiler (results). */
  spoiler?: boolean;
}

/** Two or three automatic "headline" tiles at the top of a page. */
export function Headlines({ items, className }: { items: Headline[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3", className)}>
      {items.map((h, i) => {
        const body = (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
              {h.label}
            </p>
            <p className="font-heading mt-1 text-xl font-semibold tabular sm:text-2xl">
              {h.spoiler ? <Spoiler label="Reveal">{h.value}</Spoiler> : h.value}
            </p>
            {h.detail ? <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{h.detail}</p> : null}
          </>
        );
        return (
          <li key={i} className="min-w-0 rounded-xl border bg-card p-3 transition-colors hover:border-brand/60 sm:p-4">
            {h.href ? (
              <Link href={h.href} className="block no-underline">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
