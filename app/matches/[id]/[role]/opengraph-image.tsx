import { existsSync, readFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { championRef, getData, teamRef, type TeamRef } from "@/lib/data/load";
import { CARD_METRICS, duelArtFile, duelSeries, DUEL_LABEL, isRole, laneDuel, type DuelSide } from "@/lib/duels";
import { bestOfLabel, dateRange, roundLabel, utcDay } from "@/lib/format";
import { ROLES } from "@/lib/metrics";
import { OG, ogFonts, ogLogo, ogWordmark } from "@/lib/og";
import { Backdrop, Metric } from "@/lib/og-card";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export function generateStaticParams() {
  return duelSeries(getData()).flatMap((s) => ROLES.map((role) => ({ id: s.id, role })));
}

export const alt = "The two players of the lane duel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const host = new URL(site.url).host;

/** Labels short enough for one line on the card. */
const CARD_LABEL: Record<string, string> = {
  kda: "KDA",
  dpm: "Damage/min",
  cspm: "CS/min",
  kills: "Kills/game",
  kp: "KP",
  vspm: "Vision/min",
  assists: "Assists/game",
};

/** The half-card crop of the champion's splash, when the build downloaded it. */
function art(champion: string | undefined): string | null {
  const ref = champion ? championRef(getData(), champion) : null;
  const file = ref ? duelArtFile(ref.id) : null;
  return file && existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString("base64")}` : null;
}

function Player({
  side,
  team,
  align,
  nameSize,
}: {
  side: DuelSide | null;
  team: TeamRef | null;
  align: "left" | "right";
  nameSize: number;
}) {
  const logo = team ? ogLogo(team) : null;
  const top = side?.player.champions[0];
  const items = align === "left" ? "flex-start" : "flex-end";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: items, width: 290, gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexDirection: align === "left" ? "row" : "row-reverse",
        }}
      >
        {logo ? (
          <div
            style={{
              display: "flex",
              padding: logo.plate ? 5 : 0,
              borderRadius: 8,
              background: logo.plate ? "#f4f4f5" : "transparent",
            }}
          >
            <img src={logo.src} width={logo.plate ? 46 : 56} height={logo.plate ? 46 : 56} alt="" />
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 34, color: OG.mutedForeground }}>{team?.short ?? "TBD"}</div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: nameSize,
          lineHeight: 0.95,
          textTransform: "uppercase",
          color: side ? OG.foreground : OG.mutedForeground,
          textAlign: align,
        }}
      >
        {side?.player.name ?? "To be decided"}
      </div>
      {top ? (
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 1, color: OG.mutedForeground }}>
          {`Most played: ${top.champion} (${top.count})`}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The card a link to a lane duel shows when shared (design B): both players with their team, the splash of each one's
 * most played champion behind them, and four numbers from the games before the series. Spoiler-safe.
 */
export default async function Image({ params }: { params: Promise<{ id: string; role: string }> }) {
  const { id, role } = await params;
  const data = getData();
  const s = data.seriesById.get(id);
  const duel = s && isRole(role) ? laneDuel(data, s, role) : null;
  const ta = teamRef(data.teamsById.get(s?.team1Id ?? ""));
  const tb = teamRef(data.teamsById.get(s?.team2Id ?? ""));
  const metrics =
    duel?.a?.stats && duel.b?.stats
      ? CARD_METRICS(duel.role).flatMap((k) =>
          duel.metrics.filter((m) => m.key === k).map((m) => ({ ...m, label: CARD_LABEL[k] ?? m.label })),
        )
      : [];
  const arts = [art(duel?.a?.player.champions[0]?.champion), art(duel?.b?.player.champions[0]?.champion)];
  const longest = Math.max(...[duel?.a, duel?.b].map((x) => (x?.player.name ?? "To be decided").length));
  const nameSize = longest > 10 ? 58 : longest > 7 ? 70 : 84;
  const kicker = s
    ? [
        "Worlds 2026",
        roundLabel(s.stage, s.round, s.tab),
        bestOfLabel(s.bestOf),
        dateRange(utcDay(s.dateTimeUtc), null),
      ].join(" / ")
    : "Worlds 2026";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "34px 56px 36px",
        background: OG.background,
        color: OG.foreground,
        fontFamily: "Barlow Condensed",
        position: "relative",
      }}
    >
      <Backdrop a={null} b={null} />
      {arts.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            width={600}
            height={630}
            alt=""
            style={{ position: "absolute", top: 0, left: i === 0 ? 0 : 600, opacity: 0.42 }}
          />
        ) : null,
      )}
      {/* Darker towards the centre and the bottom, so the numbers and the footer read over the art. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage:
            "linear-gradient(90deg, rgba(3,3,4,0.15) 0%, rgba(3,3,4,0.8) 38%, rgba(3,3,4,0.8) 62%, rgba(3,3,4,0.15) 100%)",
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
            "linear-gradient(180deg, rgba(11,22,80,0.55) 0%, rgba(3,3,4,0) 35%, rgba(3,3,4,0) 70%, rgba(3,3,4,0.92) 100%)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#9cc4ff" }}>
          {kicker}
        </div>
        <div style={{ display: "flex", fontSize: 68, lineHeight: 1, textTransform: "uppercase", letterSpacing: 1 }}>
          {duel ? `${DUEL_LABEL[duel.role]} duel` : "Lane duel"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <Player side={duel?.a ?? null} team={ta} align="left" nameSize={nameSize} />
        {metrics.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 470,
              gap: 20,
              padding: "22px 28px",
              borderRadius: 18,
              border: `2px solid ${OG.border}`,
              background: "rgba(8,11,16,0.88)",
            }}
          >
            {metrics.map((m) => (
              <Metric key={m.key} m={m} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 56, color: OG.mutedForeground }}>VS</div>
        )}
        <Player side={duel?.b ?? null} team={tb} align="right" nameSize={nameSize} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 24,
          color: OG.mutedForeground,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={ogWordmark()} width={186} height={39} alt="" />
          <div style={{ display: "flex" }}>{`Full duel at ${host}`}</div>
        </div>
        <div style={{ display: "flex" }}>Before the series. Data: Leaguepedia, lolesports</div>
      </div>
    </div>,
    { ...size, fonts: ogFonts() },
  );
}
