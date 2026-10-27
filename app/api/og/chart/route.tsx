import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { buildChart } from "@/lib/charts/build";
import { formatUnit } from "@/lib/charts/spec";
import { parseConfig } from "@/lib/charts/url";
import { getData } from "@/lib/data/load";
import { runQuery } from "@/lib/query";
import { site } from "@/lib/site";

/** Open Graph preview for a chart builder link: title plus the first bars of the result. */
export function GET(request: NextRequest) {
  const data = getData();
  const config = parseConfig(request.nextUrl.searchParams);
  const result = runQuery(config, data);
  const built = buildChart(result);
  const first = result.measures[0];
  const rows = result.rows.filter((r, i, all) => all.findIndex((x) => x.key === r.key) === i).slice(0, 8);
  const values = rows.map((r) => (first ? (r.values[first.key] ?? 0) : 0));
  const max = Math.max(...values, 0.0001);
  const accent = "#5fd3b0";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1c1d22", color: "#f3f4f6", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#a1a1aa" }}>
          <div style={{ width: 14, height: 14, background: accent, borderRadius: 3 }} />
          {site.name} · {data.tournament.name}
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 16, lineHeight: 1.15 }}>{built.title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, flexGrow: 1 }}>
          {rows.length ? (
            rows.map((r, i) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22 }}>
                <div style={{ width: 200, textAlign: "right", color: "#d4d4d8", overflow: "hidden", whiteSpace: "nowrap" }}>{r.label}</div>
                <div style={{ display: "flex", flexGrow: 1, height: 26, background: "#2a2b31", borderRadius: 6 }}>
                  <div style={{ width: `${Math.max(2, (values[i] / max) * 100)}%`, background: accent, borderRadius: 6 }} />
                </div>
                <div style={{ width: 110, color: "#f3f4f6" }}>{formatUnit(values[i], first?.unit)}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 26, color: "#a1a1aa" }}>{result.problems[0] ?? result.emptyReason ?? "No data"}</div>
          )}
        </div>
        <div style={{ fontSize: 20, color: "#a1a1aa" }}>Data: Leaguepedia (CC BY-SA) · not affiliated with Riot Games</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
