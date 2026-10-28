import { ImageResponse } from "next/og";
import { getData } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import { ROLE_LABEL } from "@/lib/format";
import { OgMark } from "@/lib/og-mark";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getData().teams.map((t) => ({ id: t.id }));
}

export const alt = "Team preview";
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

/** Team preview without logos: tag on a region-coloured pill, name, region and roster. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const t = data.teamsById.get(id);
  const region = regionInfo(t?.region ?? "");
  const roster = (t?.roster ?? [])
    .map((r) => ({ name: data.playersById.get(r.playerId)?.name ?? r.playerId, role: ROLE_LABEL[r.role] }))
    .slice(0, 7);
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
        <OgMark />
        {site.name} / {data.tournament.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div
          style={{
            display: "flex",
            padding: "16px 36px",
            borderRadius: 18,
            fontSize: 72,
            fontWeight: 800,
            color: "#1a1a1a",
            background: REGION_HEX[region.cssVar] ?? "#cfcfcf",
            letterSpacing: 2,
          }}
        >
          {t?.short ?? "?"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 56, fontWeight: 700 }}>{t?.name ?? "Team"}</div>
          <div style={{ fontSize: 28, color: "#a1a1aa" }}>{`${region.code} / ${t?.location ?? region.name}`}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 24 }}>
        {roster.map((p) => (
          <div
            key={p.name}
            style={{ display: "flex", gap: 8, padding: "8px 16px", borderRadius: 10, background: "#2a2b31" }}
          >
            <span style={{ color: "#a1a1aa" }}>{p.role}</span>
            <span>{p.name}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 22, color: "#a1a1aa" }}>Data: Leaguepedia (CC BY-SA) / no logos, no photos</div>
    </div>,
    size,
  );
}
