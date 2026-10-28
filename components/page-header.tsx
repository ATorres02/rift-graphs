import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { ArtBackdrop, type ArtRef } from "@/components/art-backdrop";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  eyebrow,
  description,
  children,
  className,
  art,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Champion art shown blurred behind the header (team, player, series pages). */
  art?: ArtRef | null;
}) {
  return (
    <header
      className={cn("mb-6 space-y-2", art && "relative overflow-hidden rounded-3xl border p-5 sm:p-8", className)}
    >
      {art ? <ArtBackdrop art={art} /> : null}
      <div className={cn("space-y-2", art && "relative")}>
        {eyebrow ? <p className="kicker text-xs text-brand">{eyebrow}</p> : null}
        <h1 className="display text-4xl font-bold sm:text-6xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
        {children}
      </div>
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  className,
  action,
  collapsible = false,
  defaultOpen = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  /** Render as a native <details> whose summary is the heading. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const heading = (
    <div>
      <h2 className="display flex items-center gap-3 text-2xl font-bold sm:text-3xl">
        <span className="inline-block h-6 w-1 bg-brand sm:h-7" aria-hidden />
        <span>{title}</span>
        {collapsible ? (
          <ChevronDownIcon
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        ) : null}
      </h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
  if (collapsible) {
    return (
      <details open={defaultOpen} className={cn("group space-y-3", className)}>
        <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-2 [&::-webkit-details-marker]:hidden">
          {heading}
          {action}
        </summary>
        {children}
      </details>
    );
  }
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        {heading}
        {action}
      </div>
      {children}
    </section>
  );
}
