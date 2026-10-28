import type { ReactNode } from "react";
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
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="display flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <span className="inline-block h-6 w-1 bg-brand sm:h-7" aria-hidden />
            <span>{title}</span>
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
