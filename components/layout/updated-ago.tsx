"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function relative(iso: string, now: number): string {
  const diffMin = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "Updated 12 min ago", recomputed every minute from meta.json's timestamp. */
export function UpdatedAgo({ updatedAt, className }: { updatedAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const label = now === null ? "Updated " + updatedAt.slice(0, 16).replace("T", " ") + " UTC" : `Updated ${relative(updatedAt, now)}`;
  return (
    <span className={cn("text-xs text-muted-foreground", className)} title={`Data last updated ${updatedAt.replace("T", " ").replace("Z", " UTC")}`}>
      <span className="mr-1 inline-block size-1.5 rounded-full bg-brand align-middle" aria-hidden />
      {label}
    </span>
  );
}
