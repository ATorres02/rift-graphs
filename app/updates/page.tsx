import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";
import { UPDATE_KIND_LABEL, updatesByDay, type SiteUpdate, type UpdateKind } from "@/lib/updates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Updates",
  description: `What's new on ${site.name}: the features added to the Worlds 2026 stats site, newest first.`,
};

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const KIND_CLASS: Record<UpdateKind, string> = {
  new: "bg-brand text-white",
  improved: "border border-brand text-brand",
  fixed: "bg-muted text-muted-foreground",
};

function UpdateCard({ update: u }: { update: SiteUpdate }) {
  return (
    <article id={u.id} className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn("kicker rounded-sm px-1.5 py-0.5 text-[10px] leading-none", KIND_CLASS[u.kind])}>
          {UPDATE_KIND_LABEL[u.kind]}
        </span>
        <h2 className="display text-2xl font-bold sm:text-3xl">{u.title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{u.summary}</p>
      {u.items?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {u.items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 bg-brand" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {u.link ? (
        <Link
          href={u.link.href}
          className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          {u.link.label}
          <ArrowRightIcon aria-hidden className="size-4 motion-safe:transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </article>
  );
}

export default function UpdatesPage() {
  const days = updatesByDay();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={site.name}
        title="Updates"
        description="New features and improvements, newest first. Results and stats refresh after every game on their own, so they are not listed here."
      />
      <ol className="relative space-y-10 sm:before:absolute sm:before:top-2 sm:before:bottom-2 sm:before:left-[3.5px] sm:before:w-px sm:before:bg-border">
        {days.map((day) => (
          <li key={day.date} className="relative grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
            <time
              dateTime={day.date}
              className="kicker flex items-center gap-2.5 self-start text-xs text-muted-foreground sm:pt-6 sm:text-sm"
            >
              <span aria-hidden className="relative size-2 shrink-0 bg-brand" />
              {dayLabel.format(new Date(`${day.date}T12:00:00Z`))}
            </time>
            <div className="space-y-3">
              {day.updates.map((u) => (
                <UpdateCard key={u.id} update={u} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
