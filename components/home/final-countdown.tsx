"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Days, hours, minutes and seconds to the final, as four large tiles. Empty until mounted, so hydration matches. */
export function FinalCountdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = now === null ? null : Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  const parts: [string, number | null][] = [
    ["Days", left === null ? null : Math.floor(left / 86400)],
    ["Hours", left === null ? null : Math.floor(left / 3600) % 24],
    ["Min", left === null ? null : Math.floor(left / 60) % 60],
    ["Sec", left === null ? null : left % 60],
  ];
  return (
    <div role="timer" aria-label="Time until the final" className="flex gap-2">
      {parts.map(([label, value]) => (
        <div key={label} className="w-16 border border-white/15 bg-white/5 py-2 text-center sm:w-20">
          <div className="display text-4xl leading-none font-extrabold text-white tabular-nums sm:text-5xl">
            {value === null ? "--" : pad(value)}
          </div>
          <div className="kicker mt-1 text-[10px] text-zinc-400">{label}</div>
        </div>
      ))}
    </div>
  );
}
