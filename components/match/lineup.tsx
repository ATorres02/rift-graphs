import Link from "next/link";
import { ChampionIcon, type ChampionIconRef } from "@/components/champion-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LineupEntry } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_ORDER = { top: 0, jungle: 1, mid: 2, bot: 3, support: 4 };

/** Player lines of a provisional (manual) game: champion, player and, when typed, K/D/A. */
export function LineupTable({
  lineup,
  icon,
  side,
  teamName,
}: {
  lineup: LineupEntry[];
  icon: (name: string) => ChampionIconRef;
  side: "blue" | "red";
  teamName: string;
}) {
  const rows = [...lineup].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const hasKda = rows.some((r) => r.kills !== null || r.deaths !== null || r.assists !== null);
  return (
    <div className="scroll-x rounded-xl border bg-card">
      <Table className="text-xs sm:text-sm">
        <caption className="sr-only">
          {teamName} line-up ({side} side), provisional
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn("sticky left-0 z-10 bg-card", side === "blue" ? "text-side-blue" : "text-side-red")}
            >
              {teamName}
            </TableHead>
            <TableHead>Champion</TableHead>
            {hasKda ? (
              <TableHead className="text-right" title="Kills / Deaths / Assists">
                K / D / A
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.role}-${r.name}`}>
              <TableCell className="sticky left-0 z-10 bg-card font-medium">
                {r.playerId ? (
                  <Link href={`/players/${r.playerId}`} className="hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{ROLE_LABEL[r.role]}</span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  <ChampionIcon champion={icon(r.champion)} size="sm" />
                  {r.champion}
                </span>
              </TableCell>
              {hasKda ? (
                <TableCell className="text-right tabular">
                  {r.kills ?? "–"} / {r.deaths ?? "–"} / {r.assists ?? "–"}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
