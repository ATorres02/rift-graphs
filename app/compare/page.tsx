import type { Metadata } from "next";
import type { CompareGroup } from "@/components/compare-tool";
import { CompareTool } from "@/components/compare-tool";
import { PageHeader } from "@/components/page-header";
import { getData } from "@/lib/data/load";
import { regionInfo } from "@/lib/data/regions";
import { ROLE_LABEL } from "@/lib/format";
import { aggregateByPlayer, aggregateByTeam, DEFAULT_MIN_GAMES } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Two teams or two players side by side: an overlaid radar and a table of differences across the main metrics.",
};

export default function ComparePage() {
  const data = getData();
  const byPlayer = aggregateByPlayer(data.playerGames);
  const byTeam = aggregateByTeam(
    data.confirmedGames,
    data.teams.map((t) => t.id),
  );

  const players: CompareGroup = {
    type: "players",
    label: "Players",
    metrics: [
      { key: "kda", label: "KDA", unit: "decimal1", radar: true },
      { key: "kp", label: "Kill participation", unit: "percent", radar: true },
      { key: "cspm", label: "CS per minute", unit: "decimal1", radar: true },
      { key: "dpm", label: "Damage per minute", unit: "number", radar: true },
      { key: "gpm", label: "Gold per minute", unit: "number", radar: true },
      { key: "damageShare", label: "Damage share", unit: "percent", radar: true },
      { key: "vspm", label: "Vision per minute", unit: "decimal2", radar: true },
      { key: "winRate", label: "Win rate", unit: "percent" },
      { key: "avgKills", label: "Kills per game", unit: "decimal1" },
      { key: "avgDeaths", label: "Deaths per game", unit: "decimal1", lowerIsBetter: true },
      { key: "avgAssists", label: "Assists per game", unit: "decimal1" },
      { key: "goldShare", label: "Gold share", unit: "percent" },
    ],
    entities: data.players
      .filter((p) => (byPlayer.get(p.id)?.games ?? 0) >= 1)
      .map((p) => {
        const a = byPlayer.get(p.id)!;
        const team = data.teamsById.get(p.teamId);
        return {
          id: p.id,
          label: p.name,
          detail: `${team?.short ?? ""}, ${ROLE_LABEL[p.role]}`,
          games: a.games,
          color: `var(${regionInfo(team?.region ?? "").cssVar})`,
          values: {
            kda: a.kda,
            kp: a.killParticipation,
            cspm: a.cspm,
            dpm: a.dpm,
            gpm: a.gpm,
            damageShare: a.damageShare,
            vspm: a.visionPerMinute,
            winRate: a.winRate,
            avgKills: a.avgKills,
            avgDeaths: a.avgDeaths,
            avgAssists: a.avgAssists,
            goldShare: a.goldShare,
          },
        };
      })
      .sort(
        (x, y) =>
          (y.games >= DEFAULT_MIN_GAMES ? 1 : 0) - (x.games >= DEFAULT_MIN_GAMES ? 1 : 0) ||
          x.label.localeCompare(y.label),
      ),
  };

  const teams: CompareGroup = {
    type: "teams",
    label: "Teams",
    metrics: [
      { key: "winRate", label: "Win rate", unit: "percent", radar: true },
      { key: "killsPerGame", label: "Kills per game", unit: "decimal1", radar: true },
      { key: "goldPerMinute", label: "Gold per minute", unit: "number", radar: true },
      { key: "towersPerGame", label: "Towers per game", unit: "decimal1", radar: true },
      { key: "dragonControl", label: "Dragon control", unit: "percent", radar: true },
      { key: "baronControl", label: "Baron control", unit: "percent", radar: true },
      { key: "deathsPerGame", label: "Deaths per game", unit: "decimal1", lowerIsBetter: true },
      { key: "dragonsPerGame", label: "Dragons per game", unit: "decimal1" },
      { key: "baronsPerGame", label: "Barons per game", unit: "decimal2" },
      { key: "heraldsPerGame", label: "Heralds per game", unit: "decimal2" },
      { key: "voidGrubsPerGame", label: "Void grubs per game", unit: "decimal1" },
      { key: "blueWinRate", label: "Blue side win rate", unit: "percent" },
      { key: "redWinRate", label: "Red side win rate", unit: "percent" },
      { key: "avgDurationSeconds", label: "Average game length", unit: "seconds", lowerIsBetter: true },
    ],
    entities: data.teams
      .filter((t) => (byTeam.get(t.id)?.games ?? 0) >= 1)
      .map((t) => {
        const a = byTeam.get(t.id)!;
        return {
          id: t.id,
          label: t.name,
          detail: regionInfo(t.region).code,
          games: a.games,
          color: `var(${regionInfo(t.region).cssVar})`,
          values: {
            winRate: a.winRate,
            killsPerGame: a.killsPerGame,
            goldPerMinute: a.goldPerMinute,
            towersPerGame: a.towersPerGame,
            dragonControl: a.dragonControl,
            baronControl: a.baronControl,
            deathsPerGame: a.deathsPerGame,
            dragonsPerGame: a.dragonsPerGame,
            baronsPerGame: a.baronsPerGame,
            heraldsPerGame: a.heraldsPerGame,
            voidGrubsPerGame: a.voidGrubsPerGame,
            blueWinRate: a.blue.games ? a.blue.winRate : null,
            redWinRate: a.red.games ? a.red.winRate : null,
            avgDurationSeconds: a.avgDurationSeconds,
          },
        };
      })
      .sort((x, y) => x.label.localeCompare(y.label)),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare"
        description="Two players or two teams side by side. The radar scales every axis to the best value in the tournament; the table marks who leads each metric."
      />
      <CompareTool groups={[players, teams]} />
    </div>
  );
}
