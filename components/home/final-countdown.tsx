"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** One split-flap digit: on a change the old top half falls and the new bottom half lands (CSS in globals.css). */
function Flap({ char }: { char: string }) {
  const [flip, setFlip] = useState({ cur: char, prev: char, n: 0 });
  // Derived during render, React's pattern for state that follows a prop: no extra paint with the stale digit.
  if (flip.cur !== char) setFlip({ cur: char, prev: flip.cur, n: flip.n + 1 });
  const flipping = flip.n > 0 && flip.prev !== flip.cur;
  return (
    <span className="flap block flex-1">
      <span className="flap-half flap-top">
        <span>{flip.cur}</span>
      </span>
      <span className="flap-half flap-bottom">
        <span>{flipping ? flip.prev : flip.cur}</span>
      </span>
      {flipping ? (
        <>
          <span key={`f${flip.n}`} aria-hidden className="flap-half flap-top flap-fall">
            <span>{flip.prev}</span>
          </span>
          <span key={`l${flip.n}`} aria-hidden className="flap-half flap-bottom flap-land">
            <span>{flip.cur}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Days, hours, minutes and seconds to the final. Empty until mounted, so hydration matches. `poster`: four white tiles
 * on the homepage poster. `page`: the final's own page, a full-width split-flap board in the page's colours.
 */
export function FinalCountdown({ iso, tone = "poster" }: { iso: string; tone?: "poster" | "page" }) {
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
  if (tone === "page") {
    const label = left === null ? undefined : parts.map(([l, v]) => `${v} ${l.toLowerCase()}`).join(", ");
    return (
      <div
        role="timer"
        aria-label={label ? `Time until the final: ${label}` : "Time until the final"}
        className="grid grid-cols-4 gap-3 sm:gap-10"
      >
        {parts.map(([unit, value]) => (
          <div key={unit} className="@container">
            <div
              aria-hidden
              className="display flex gap-1 text-[74cqw] leading-none font-extrabold text-foreground sm:gap-2"
            >
              {(value === null ? "--" : pad(value)).split("").map((c, i) => (
                <Flap key={i} char={c} />
              ))}
            </div>
            <div className="kicker mt-2 text-center text-[10px] text-muted-foreground sm:mt-4 sm:text-base">{unit}</div>
          </div>
        ))}
      </div>
    );
  }
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
