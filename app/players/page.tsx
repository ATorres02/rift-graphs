import type { Metadata } from "next";
import Link from "next/link";
import { Headlines, type Headline } from "@/components/headlines";
import { ProvisionalNote } from "@/components/provisional";
import { PageHeader, Section } from "@/components/page-header";
import { PlayersTable } from "@/components/players-table";
import { TeamPill } from "@/components/team-pill";
import { getData, teamRef } from "@/lib/data/load";
import { fmt, ROLE_LABEL } from "@/lib/format";
import { aggregateByPlayer, DEFAULT_MIN_GAMES, rankPlayers, ROLES } from "@/lib/metrics";
import { playerCell, playerLabel } from "@/lib/views";

export const metadata: Metadata = {
  title: "Worlds 2026 player stats and rankings",
  description:
    "Every player of the 2026 World Championship ranked by KDA, kill participation, CS, damage and gold per minute, with a role filter and a minimum-games threshold.",
};

export default function PlayersPage() {
  const data = getData();
  const byPlayer = aggregateByPlayer(data.playerGames);

  const rows = data.players
    .map((p) => {
      const a = byPlayer.get(p.id);
      const team = teamRef(data.teamsById.get(p.teamId));
      return {
        player: playerCell(p),
        href: `/players/${p.id}`,
        team,
        role: ROLE_LABEL[p.role],
        roleKey: p.role,
        games: a?.games ?? 0,
        winRate: a ? a.winRate : null,
        kdaLine: a ? { kills: a.kills, deaths: a.deaths, assists: a.assists } : null,
        kda: a ? a.kda : null,
        kp: a ? a.killParticipation : null,
        cspm: a ? a.cspm : null,
        dpm: a ? a.dpm : null,
        gpm: a ? a.gpm : null,
        damageShare: a ? a.damageShare : null,
        goldShare: a ? a.goldShare : null,
        vspm: a ? a.visionPerMinute : null,
      };
    })
    .filter((r) => r.games > 0);

  const leader = (metric: Parameters<typeof rankPlayers>[1]) => rankPlayers(byPlayer, metric, { limit: 1 })[0];
  const kda = leader((a) => a.kda);
  const dpm = leader((a) => a.dpm);
  const cspm = leader((a) => a.cspm);
  const kills = leader((a) => a.kills);
  const headlines: Headline[] = [
    kda
      ? {
          label: "Best KDA",
          value: fmt.dec(kda.value, 1),
          detail: `${playerLabel(data, kda.playerId)}, ${kda.aggregate.games} games`,
          href: `/players/${kda.playerId}`,
        }
      : { label: "Best KDA", value: "–" },
    dpm
      ? {
          label: "Most damage per minute",
          value: fmt.int(dpm.value),
          detail: `${playerLabel(data, dpm.playerId)}, ${dpm.aggregate.games} games`,
          href: `/players/${dpm.playerId}`,
        }
      : { label: "Most damage per minute", value: "–" },
    cspm
      ? {
          label: "Best CS per minute",
          value: fmt.dec(cspm.value, 1),
          detail: `${playerLabel(data, cspm.playerId)}, ${cspm.aggregate.games} games`,
          href: `/players/${cspm.playerId}`,
        }
      : { label: "Best CS per minute", value: "–" },
    kills
      ? {
          label: "Most kills",
          value: fmt.int(kills.value),
          detail: `${playerLabel(data, kills.playerId)}, ${kills.aggregate.games} games`,
          href: `/players/${kills.playerId}`,
        }
      : { label: "Most kills", value: "–" },
  ];

  const topByRole = ROLES.map((role) => {
    const subset = new Map(Array.from(byPlayer).filter(([id]) => data.playersById.get(id)?.role === role));
    return { role, top: rankPlayers(subset, (a) => a.kda, { limit: 5 }) };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Players"
        description={`Rankings use totals over all games, and leaders need at least ${DEFAULT_MIN_GAMES} games so a single good game does not top the table.`}
      />
      <Headlines items={headlines} className="lg:grid-cols-4" />
      <ProvisionalNote meta={data.meta} />

      <Section title="Top 5 by role" description={`Ranked by KDA, minimum ${DEFAULT_MIN_GAMES} games.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topByRole.map(({ role, top }) => (
            <div key={role} className="rounded-xl border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {ROLE_LABEL[role]}
              </h3>
              <ol className="space-y-1.5">
                {top.map((r, i) => {
                  const p = data.playersById.get(r.playerId)!;
                  return (
                    <li key={r.playerId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 text-xs tabular text-muted-foreground">{i + 1}</span>
                        <TeamPill team={teamRef(data.teamsById.get(p.teamId))} size="sm" />
                        <Link href={`/players/${p.id}`} className="truncate font-medium hover:text-brand">
                          {p.name}
                        </Link>
                      </span>
                      <span className="tabular text-muted-foreground">{fmt.dec(r.value, 1)}</span>
                    </li>
                  );
                })}
                {top.length === 0 ? <li className="text-xs text-muted-foreground">Not enough games yet.</li> : null}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="All players"
        description="Click a column to sort. Scroll sideways on small screens; the player column stays fixed."
      >
        <PlayersTable rows={rows} />
      </Section>
    </div>
  );
}
