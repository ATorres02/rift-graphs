import { ImageResponse } from "next/og";
import { getData, seriesTeams } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import { bestOfLabel, roundLabel } from "@/lib/format";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getData().series.map((s) => ({ id: s.id }));
}

export const alt = "Series preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const REGION_HEX: Record<string, string> = {
  "--region-lck": "#7ee3c0",
  "--region-lpl": "#f3b64f",
  "--region-lec": "#c4a7f5",
  "--region-lcs": "#f6a57a",
  "--region-lcp": "#86d4ec",
  "--region-cblol": "#c7e36a",
  "--region-other": "#cfcfcf",
};

/** Spoiler-safe preview: teams, stage and date, never the score. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const s = data.seriesById.get(id);
  const { team1, team2 } = s ? seriesTeams(data, s) : { team1: null, team2: null };
  const pill = (t: typeof team1) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        style={{
          display: "flex",
          padding: "14px 34px",
          borderRadius: 16,
          fontSize: 64,
          fontWeight: 800,
          color: "#1a1a1a",
          background: t ? REGION_HEX[regionInfo(t.region).cssVar] : "#3a3b41",
          letterSpacing: 2,
        }}
      >
        {t?.short ?? "TBD"}
      </div>
      <div style={{ fontSize: 30, color: "#d4d4d8" }}>{t?.name ?? "To be decided"}</div>
    </div>
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1c1d22",
        color: "#f3f4f6",
        padding: 56,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#a1a1aa" }}>
        <div style={{ width: 14, height: 14, background: "#5fd3b0", borderRadius: 3 }} />
        {site.name} / {data.tournament.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 72 }}>
        {pill(team1)}
        <div style={{ fontSize: 40, color: "#71717a" }}>vs</div>
        {pill(team2)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#a1a1aa" }}>
        <div>
          {s
            ? `${roundLabel(s.stage, s.round, s.tab)} / ${bestOfLabel(s.bestOf)} / ${s.dateTimeUtc.slice(0, 10)}`
            : "Series"}
        </div>
        <div>Data: Leaguepedia (CC BY-SA)</div>
      </div>
    </div>,
    size,
  );
}
