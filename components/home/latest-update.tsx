import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { dateRange } from "@/lib/format";
import { UPDATE_KIND_LABEL, type SiteUpdate } from "@/lib/updates";

/**
 * The newest site update as a lower third under the homepage hero: black in both themes like the hero, the kind of
 * change in the brand colour, then the day and the title. Links to the entry on /updates.
 */
export function LatestUpdate({ update }: { update: SiteUpdate }) {
  return (
    <Link
      href={`/updates#${update.id}`}
      className="dark group -mx-4 flex items-stretch overflow-hidden bg-zinc-950 no-underline sm:mx-0 sm:rounded-b-md"
    >
      {/* No top border here: the label carries on the hero's blue stripe, which runs straight into it. */}
      <span className="kicker flex shrink-0 items-center bg-brand px-3 text-[11px] text-white sm:px-4 sm:text-xs">
        {UPDATE_KIND_LABEL[update.kind]}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3 border-t border-white/10 px-3 py-2.5 sm:px-4">
        <time dateTime={update.date} className="kicker shrink-0 text-[11px] text-zinc-500 sm:text-xs">
          {dateRange(update.date, null)}
        </time>
        <span className="flex min-w-0 items-baseline gap-2.5 text-sm">
          <span className="shrink-0 font-semibold text-zinc-50">{update.title}</span>
          <span className="hidden truncate text-zinc-400 md:inline">{update.summary}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 border-t border-white/10 pr-3 text-xs text-zinc-400 group-hover:text-white sm:pr-4">
        <span className="hidden sm:inline">All updates</span>
        <ArrowRightIcon aria-hidden className="size-4 motion-safe:transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
