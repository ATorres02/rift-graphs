import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  eyebrow,
  description,
  children,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 space-y-2", className)}>
      {eyebrow ? <p className="text-xs font-medium uppercase tracking-wider text-brand">{eyebrow}</p> : null}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description ? <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      {children}
    </header>
  );
}

export function Section({ title, description, children, className, action }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
