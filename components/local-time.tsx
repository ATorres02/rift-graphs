"use client";

import { useEffect, useState } from "react";

type Mode = "datetime" | "time" | "date" | "weekday" | "day";

const OPTIONS: Record<Mode, Intl.DateTimeFormatOptions> = {
  datetime: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  time: { hour: "2-digit", minute: "2-digit" },
  date: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
  day: { weekday: "short", day: "numeric", month: "short" },
};

/**
 * Renders a UTC instant in the visitor's time zone. The server (and the first
 * client render) print UTC so hydration matches; the effect switches to local time.
 */
export function LocalTime({
  iso,
  mode = "datetime",
  hasTime = true,
  className,
}: {
  iso: string;
  mode?: Mode;
  hasTime?: boolean;
  className?: string;
}) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    const opts: Intl.DateTimeFormatOptions = { ...OPTIONS[mode] };
    if (!hasTime) {
      delete opts.hour;
      delete opts.minute;
    }
    setLocal(new Intl.DateTimeFormat("en-GB", { ...opts, hourCycle: "h23" }).format(new Date(iso)));
  }, [iso, mode, hasTime]);
  const utc = new Intl.DateTimeFormat("en-GB", { ...OPTIONS[mode], timeZone: "UTC", hour12: false }).format(
    new Date(iso),
  );
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {local ?? `${utc}${mode === "date" || mode === "day" || !hasTime ? "" : " UTC"}`}
    </time>
  );
}
