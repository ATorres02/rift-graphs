import { ImageResponse } from "next/og";
import { getData, seriesTeams, type TeamRef } from "@/lib/data/load";
import { bestOfLabel, dateRange, roundLabel, utcDay } from "@/lib/format";
import { OG, ogFonts, ogLogo, ogWordmark } from "@/lib/og";
import {
  barShare,
  formatPreview,
  leader,
  previewRound,
  showsPreview,
  teamMatchup,
  type PreviewMetric,
} from "@/lib/preview";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getData().series.map((s) => ({ id: s.id }));
}

export const alt = "The two teams of the series";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const host = new URL(site.url).host;

/** The Tale of the tape numbers the card shows: a few that read at a glance. */
const CARD_METRICS = ["killsPerGame", "firstBloodRate", "goldDiffAt15"];

function Team({ team, width, nameSize }: { team: TeamRef | null; width: number; nameSize: number }) {
  const logo = team ? ogLogo(team) : null;
  const name = team?.name ?? "To be decided";
  return (
    // A fixed height with room for a two-line name keeps both logos on one line whatever the names.
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
        height: 138 + nameSize * 2,
        gap: 18,
      }}
    >
      {logo ? (
        <div
          style={{
            display: "flex",
            padding: logo.plate ? 10 : 0,
            borderRadius: 14,
            background: logo.plate ? "#f4f4f5" : "transparent",
          }}
        >
          {}
          <img src={logo.src} width={logo.plate ? 100 : 120} height={logo.plate ? 100 : 120} alt="" />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 18,
            border: `3px ${team ? "solid" : "dashed"} ${OG.border}`,
            background: team ? OG.muted : "transparent",
            color: team ? OG.foreground : OG.mutedForeground,
            fontSize: 40,
          }}
        >
          {team?.short ?? "TBD"}
        </div>
      )}
      <div
        style={{
          display: "flex",
          textAlign: "center",
          justifyContent: "center",
          fontSize: nameSize,
          lineHeight: 1,
          textTransform: "uppercase",
          color: team ? OG.foreground : OG.mutedForeground,
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** One row of the Tale of the tape: values at the ends, bars out of the centre, the leader in the brand colour. */
function Metric({ m, text }: { m: PreviewMetric; text?: { a: string; b: string } }) {
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
function Backdrop({ a, b }: { a: TeamRef | null; b: TeamRef | null }) {
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

/**
 * The card a link to the series shows when shared: both teams with their logos and, before the series starts, a few
 * Tale of the tape numbers as they stood before the series. Spoiler-safe: nothing from the series itself.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const s = data.seriesById.get(id);
  const { team1, team2 } = s ? seriesTeams(data, s) : { team1: null, team2: null };
  const preview = s && team1 && team2 && showsPreview(s, data.gamesBySeries.get(s.id)?.length ?? 0);
  // The numbers both teams brought into the series: every game before it, so a played series gives nothing away.
  const before = s
    ? data.confirmedGames.filter((g) => (data.seriesById.get(g.seriesId)?.dateTimeUtc ?? "") < s.dateTimeUtc)
    : [];
  const matchup = s && team1 && team2 ? teamMatchup(data, team1.id, team2.id, before) : null;
  // Games won and lost come first, as on DPM's cards: the series page hides them behind the spoiler switch, but
  // they are the stages already played, never this series.
  const winRate = matchup?.results.find((m) => m.key === "winRate");
  const record = (rate: number | null, games: number) => {
    const wins = Math.round((rate ?? 0) * games);
    return `${wins}W-${games - wins}L`;
  };
  const metrics: { m: PreviewMetric; text?: { a: string; b: string } }[] =
    matchup && winRate && matchup.games.a && matchup.games.b
      ? [
          {
            m: { ...winRate, label: "Wins" },
            text: { a: record(winRate.a, matchup.games.a), b: record(winRate.b, matchup.games.b) },
          },
          ...CARD_METRICS.flatMap((k) => matchup.metrics.filter((m) => m.key === k).map((m) => ({ m }))),
        ]
      : [];
  // Both names at one size, set by the longer; without the numbers the teams move in towards the centre.
  const longest = Math.max(...[team1, team2].map((t) => (t?.name ?? "To be decided").length));
  const team = { width: metrics.length ? 280 : 380, nameSize: longest > 14 ? 50 : 60 };
  const kicker = s
    ? ["Worlds 2026", bestOfLabel(s.bestOf), dateRange(utcDay(s.dateTimeUtc), null)].join(" / ")
    : "Worlds 2026";
  const title = !s
    ? "Series"
    : preview
      ? `${previewRound(s.stage, s.round)} preview`
      : roundLabel(s.stage, s.round, s.tab);

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
      <Backdrop a={team1} b={team2} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#9cc4ff" }}>
          {kicker}
        </div>
        <div style={{ display: "flex", fontSize: 68, lineHeight: 1, textTransform: "uppercase", letterSpacing: 1 }}>
          {title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: metrics.length ? "space-between" : "center",
          gap: 40,
        }}
      >
        <Team team={team1} {...team} />
        {metrics.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 500,
              gap: 22,
              padding: "24px 30px",
              borderRadius: 18,
              border: `2px solid ${OG.border}`,
              background: "rgba(8,11,16,0.86)",
            }}
          >
            {metrics.map((m) => (
              <Metric key={m.m.key} {...m} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 56, color: OG.mutedForeground }}>VS</div>
        )}
        <Team team={team2} {...team} />
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
          {}
          <img src={ogWordmark()} width={186} height={39} alt="" />
          <div style={{ display: "flex" }}>
            {preview ? `Lanes and champions at ${host}` : `Draft and scoreboards at ${host}`}
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {metrics.length ? "Data: Leaguepedia, lolesports" : "Data: Leaguepedia (CC BY-SA)"}
        </div>
      </div>
    </div>,
    { ...size, fonts: ogFonts() },
  );
}
