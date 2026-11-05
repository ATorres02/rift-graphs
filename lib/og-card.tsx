/**
 * Parts shared by the generated share cards (series and lane duels): the Tale of the tape row and the backdrop, as
 * the author approved them on the series card (3 Nov 2026).
 */
import type { TeamRef } from "@/lib/data/load";
import { OG, ogLogo } from "@/lib/og";
import { barShare, formatPreview, leader, type PreviewMetric } from "@/lib/preview";

/** One row of the Tale of the tape: values at the ends, bars out of the centre, the leader in the brand colour. */
export function Metric({ m, text }: { m: PreviewMetric; text?: { a: string; b: string } }) {
  const lead = leader(m);
  const width = (v: number | null) => `${barShare(m, v) * 100}%`;
  const value = (side: "a" | "b") => (
    <div style={{ display: "flex", width: 120, justifyContent: side === "a" ? "flex-start" : "flex-end" }}>
      <span style={{ color: lead === side ? OG.foreground : OG.mutedForeground }}>
        {text ? text[side] : formatPreview(side === "a" ? m.a : m.b, m.format)}
      </span>
    </div>
  );
  const bar = (side: "a" | "b") => (
    <div
      style={{
        display: "flex",
        flex: 1,
        height: 12,
        background: OG.muted,
        justifyContent: side === "a" ? "flex-end" : "flex-start",
        borderRadius: side === "a" ? "6px 0 0 6px" : "0 6px 6px 0",
      }}
    >
      <div
        style={{
          width: width(side === "a" ? m.a : m.b),
          height: 12,
          background: lead === side ? OG.brand : OG.trailing,
          borderRadius: side === "a" ? "6px 0 0 6px" : "0 6px 6px 0",
        }}
      />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 40, lineHeight: 1 }}>
        {value("a")}
        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "center",
            fontSize: 24,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: OG.mutedForeground,
          }}
        >
          {m.label}
        </div>
        {value("b")}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {bar("a")}
        {bar("b")}
      </div>
    </div>
  );
}

/** Behind the card: a blue glow from the top with a few rays, and each team's logo very large and faint. */
export function Backdrop({ a, b }: { a: TeamRef | null; b: TeamRef | null }) {
  const la = a ? ogLogo(a) : null;
  const lb = b ? ogLogo(b) : null;
  const rays = [-62, -38, -16, 16, 38, 62];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage: "linear-gradient(180deg, #0b1650 0%, #070b24 42%, #030304 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage:
            "radial-gradient(ellipse 60% 55% at 50% 0%, rgba(76,150,255,0.55) 0%, rgba(76,150,255,0) 100%)",
        }}
      />
      {rays.map((deg) => (
        <div
          key={deg}
          style={{
            position: "absolute",
            top: -60,
            left: 545,
            width: 110,
            height: 820,
            transformOrigin: "top center",
            transform: `rotate(${deg}deg)`,
            backgroundImage: "linear-gradient(180deg, rgba(120,170,255,0.14) 0%, rgba(120,170,255,0) 75%)",
          }}
        />
      ))}
      {[la, lb].map((logo, i) =>
        logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- drawn by next/og at build time, not a page image
          <img
            key={i}
            src={logo.src}
            width={420}
            height={420}
            alt=""
            style={{ position: "absolute", top: 150, [i === 0 ? "left" : "right"]: -110, opacity: 0.09 }}
          />
        ) : null,
      )}
    </div>
  );
}
