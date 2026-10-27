"use client";

import { useEffect, useState } from "react";

function describe(ms: number): string {
  if (ms <= 0) return "Starting now";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `Starts in ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return `Starts in ${h} h ${String(m).padStart(2, "0")} min`;
  const d = Math.floor(h / 24);
  return `Starts in ${d} day${d === 1 ? "" : "s"} ${h % 24} h`;
}

/** Live countdown to a UTC instant; shows "In progress" once the time has passed. */
export function Countdown({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return <span className={className}>Scheduled</span>;
  const diff = Date.parse(iso) - now;
  return <span className={className}>{diff < -60_000 ? "In progress" : describe(diff)}</span>;
}
