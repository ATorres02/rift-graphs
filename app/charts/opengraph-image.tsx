import { ImageResponse } from "next/og";
import { getData } from "@/lib/data/load";
import { site } from "@/lib/site";

export const dynamic = "force-static";
export const alt = "Chart builder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fixed Open Graph preview for the chart builder (static export: no per-chart image). */
export default function Image() {
  const data = getData();
  const accent = "#5fd3b0";
  const bars = [100, 82, 74, 61, 55, 47, 38, 30];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1c1d22",
        color: "#f3f4f6",
        padding: 56,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#a1a1aa" }}>
        <div style={{ width: 14, height: 14, background: accent, borderRadius: 3 }} />
        <div>{`${site.name} · ${data.tournament.name}`}</div>
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, marginTop: 16, lineHeight: 1.1 }}>Chart builder</div>
      <div style={{ fontSize: 26, color: "#d4d4d8", marginTop: 12 }}>
        Pick a measure, group it, filter it, choose a chart type and share the link.
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 40, flexGrow: 1 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              width: 110,
              height: `${h}%`,
              background: i === 0 ? accent : "#2f3038",
              borderRadius: 8,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 20, color: "#a1a1aa", marginTop: 24 }}>
        Data: Leaguepedia (CC BY-SA) · not affiliated with Riot Games
      </div>
    </div>,
    { ...size },
  );
}
