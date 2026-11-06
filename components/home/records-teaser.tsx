import Link from "next/link";
import { ArrowRightIcon, MedalIcon } from "lucide-react";

export interface TeaserFact {
  value: string;
  label: string;
  /** Who holds it: a player, a champion or two teams. */
  who: string;
}

/**
 * A slim strip under the homepage leaders pointing to /records: one line and two or three facts that give nothing away
 * (no winners). The whole strip is the link.
 */
export function RecordsTeaser({ facts }: { facts: TeaserFact[] }) {
  return (
    <Link
      href="/records"
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 no-underline transition-colors hover:border-brand sm:flex-row sm:items-center sm:gap-6 sm:p-5"
    >
      <span className="flex min-w-0 items-start gap-3 sm:flex-1">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
          <MedalIcon aria-hidden className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="display block text-xl font-bold sm:text-2xl">Tournament records</span>
          <span className="block text-sm text-muted-foreground">
            The longest games, the biggest single-game numbers, every pentakill and the most picked and banned
            champions.
          </span>
        </span>
      </span>
      {facts.length ? (
        <span className="grid grid-cols-3 gap-3 sm:flex sm:gap-8">
          {facts.map((f) => (
            <span key={f.label} className="flex min-w-0 flex-col">
              <span className="display text-2xl font-bold tabular sm:text-3xl">{f.value}</span>
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="truncate text-xs font-medium">{f.who}</span>
            </span>
          ))}
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
        See all records
        <ArrowRightIcon aria-hidden className="size-4 motion-safe:transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
