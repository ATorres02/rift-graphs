import Link from "next/link";
import { ChampionIcon, type ChampionIconRef } from "@/components/champion-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Player, PlayerGame } from "@/lib/data/types";
import { fmt, ROLE_LABEL } from "@/lib/format";
import { kda, killParticipation, perMinute } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface ScoreboardProps {
  rows: PlayerGame[];
  players: Map<string, Player>;
  icon: (name: string) => ChampionIconRef;
  side: "blue" | "red";
  teamName: string;
}

const ROLE_ORDER = { top: 0, jungle: 1, mid: 2, bot: 3, support: 4 };

/** Five-player scoreboard for one side of a game. */
export function Scoreboard({ rows, players, icon, side, teamName }: ScoreboardProps) {
  const sorted = [...rows].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const total = sorted.reduce(
    (acc, r) => ({
      kills: acc.kills + r.kills,
      deaths: acc.deaths + r.deaths,
      assists: acc.assists + r.assists,
      gold: acc.gold + r.gold,
      cs: acc.cs + r.cs,
      dmg: acc.dmg + r.damageToChampions,
      vision: acc.vision + r.visionScore,
    }),
    { kills: 0, deaths: 0, assists: 0, gold: 0, cs: 0, dmg: 0, vision: 0 },
  );
  return (
    <div className="scroll-x rounded-xl border bg-card">
      <Table className="text-xs sm:text-sm">
        <caption className="sr-only">
          {teamName} scoreboard ({side} side)
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn("sticky left-0 z-10 bg-card", side === "blue" ? "text-side-blue" : "text-side-red")}
            >
              {teamName}
            </TableHead>
            <TableHead className="text-right" title="Kills / Deaths / Assists">
              K / D / A
            </TableHead>
            <TableHead className="text-right" title="(Kills + Assists) / Deaths">
              KDA
            </TableHead>
            <TableHead className="text-right" title="Share of the team's kills the player took part in">
              KP
            </TableHead>
            <TableHead className="text-right" title="Creep score">
              CS
            </TableHead>
            <TableHead className="text-right" title="Creep score per minute">
              CSPM
            </TableHead>
            <TableHead className="text-right">Gold</TableHead>
            <TableHead className="text-right" title="Damage to champions">
              DMG
            </TableHead>
            <TableHead className="text-right" title="Damage to champions per minute">
              DPM
            </TableHead>
            <TableHead className="text-right" title="Vision score">
              Vision
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => {
            const p = players.get(r.playerId);
            const kp = killParticipation(r.kills, r.assists, r.teamKills);
            return (
              <TableRow key={r.playerId}>
                <TableCell className="sticky left-0 z-10 bg-card">
                  <span className="flex items-center gap-2">
                    <ChampionIcon champion={icon(r.champion)} size="sm" />
                    <span className="flex flex-col leading-tight">
                      <Link href={`/players/${r.playerId}`} className="font-medium hover:text-brand">
                        {p?.name ?? r.playerId}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">
                        {ROLE_LABEL[r.role]} · {r.champion}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular">
                  {r.kills} / {r.deaths} / {r.assists}
                </TableCell>
                <TableCell className="text-right tabular">{fmt.dec(kda(r.kills, r.deaths, r.assists), 1)}</TableCell>
                <TableCell className="text-right tabular">{fmt.pct(kp)}</TableCell>
                <TableCell className="text-right tabular">{r.cs}</TableCell>
                <TableCell className="text-right tabular">{fmt.dec(perMinute(r.cs, r.durationSeconds), 1)}</TableCell>
                <TableCell className="text-right tabular">{fmt.compact(r.gold)}</TableCell>
                <TableCell className="text-right tabular">{fmt.compact(r.damageToChampions)}</TableCell>
                <TableCell className="text-right tabular">
                  {fmt.int(perMinute(r.damageToChampions, r.durationSeconds))}
                </TableCell>
                <TableCell className="text-right tabular">{r.visionScore}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/40 font-medium">
            <TableCell className="sticky left-0 z-10 bg-muted/40 backdrop-blur">Total</TableCell>
            <TableCell className="text-right tabular">
              {total.kills} / {total.deaths} / {total.assists}
            </TableCell>
            <TableCell className="text-right tabular">
              {fmt.dec(kda(total.kills, total.deaths, total.assists), 1)}
            </TableCell>
            <TableCell />
            <TableCell className="text-right tabular">{total.cs}</TableCell>
            <TableCell />
            <TableCell className="text-right tabular">{fmt.compact(total.gold)}</TableCell>
            <TableCell className="text-right tabular">{fmt.compact(total.dmg)}</TableCell>
            <TableCell />
            <TableCell className="text-right tabular">{total.vision}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
