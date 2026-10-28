import { cn } from "@/lib/utils";

export interface CompareMetric {
  label: string;
  blue: number;
  red: number;
  format?: (n: number) => string;
}

/** Two-sided bars comparing blue and red team totals for one game. */
export function CompareBars({
  metrics,
  blueName,
  redName,
}: {
  metrics: CompareMetric[];
  blueName: string;
  redName: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-2 flex justify-between text-xs font-medium">
        <span className="text-side-blue">{blueName}</span>
        <span className="text-side-red">{redName}</span>
      </div>
      <ul className="space-y-2">
        {metrics.map((m) => {
          const total = m.blue + m.red;
          const even = !(total > 0);
          const bluePct = even ? 50 : (m.blue / total) * 100;
          const f = m.format ?? ((n: number) => String(n));
          return (
            <li key={m.label}>
              <div className="flex items-center justify-between text-xs tabular">
                <span className={cn(m.blue > m.red && "font-semibold")}>{f(m.blue)}</span>
                <span className="text-muted-foreground">{m.label}</span>
                <span className={cn(m.red > m.blue && "font-semibold")}>{f(m.red)}</span>
              </div>
              <div
                className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${m.label}: ${blueName} ${f(m.blue)}, ${redName} ${f(m.red)}`}
              >
                <span
                  className={cn(
                    "h-full shrink-0 transition-[width] duration-200",
                    even ? "bg-muted-foreground/25" : "bg-side-blue",
                  )}
                  style={{ width: `${bluePct}%` }}
                />
                <span className={cn("h-full flex-1", even ? "bg-muted-foreground/25" : "bg-side-red")} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
