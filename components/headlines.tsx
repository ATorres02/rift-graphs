import Link from "next/link";
import type { ReactNode } from "react";
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
    <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((h, i) => {
        const body = (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{h.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{h.value}</p>
            {h.detail ? <p className="mt-1 text-sm text-muted-foreground">{h.detail}</p> : null}
          </>
        );
        return (
          <li key={i} className="rounded-xl border bg-card p-4 transition-colors hover:border-brand/60">
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
