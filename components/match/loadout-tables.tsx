import Link from "next/link";
import { ChampionIcon, type ChampionIconRef } from "@/components/champion-icon";
import { Inventory, RuneIcon, SpellIcon } from "@/components/loadout-icons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { spellPair } from "@/lib/builds";
import type { Player, PlayerGame } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import type { LoadoutIndex } from "@/lib/sources/loadout";
import { cn } from "@/lib/utils";

interface Props {
  rows: PlayerGame[];
  players: Map<string, Player>;
  icon: (name: string) => ChampionIconRef;
  loadout: LoadoutIndex;
  side: "blue" | "red";
  teamName: string;
}

const ROLE_ORDER = { top: 0, jungle: 1, mid: 2, bot: 3, support: 4 };

function byRole(rows: PlayerGame[]): PlayerGame[] {
  return [...rows].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

function PlayerCell({ r, players, icon }: { r: PlayerGame; players: Map<string, Player>; icon: Props["icon"] }) {
  const p = players.get(r.playerId);
  return (
    <TableCell className="sticky left-0 z-10 bg-card pr-1 sm:pr-2">
      <span className="flex items-center gap-2">
        <ChampionIcon champion={icon(r.champion)} size="sm" />
        {/* Narrow on a phone, so the whole row fits without scrolling. */}
        <span className="flex w-[72px] min-w-0 flex-col leading-tight sm:w-40">
          <Link href={`/players/${r.playerId}`} className="truncate font-medium hover:text-brand">
            {p?.name ?? r.playerId}
          </Link>
          <span className="truncate text-[10px] text-muted-foreground">
            {ROLE_LABEL[r.role]}, {r.champion}
          </span>
        </span>
      </span>
    </TableCell>
  );
}

function TeamHead({ side, teamName }: { side: Props["side"]; teamName: string }) {
  return (
    <TableHead className={cn("sticky left-0 z-10 bg-card", side === "blue" ? "text-side-blue" : "text-side-red")}>
      {teamName}
    </TableHead>
  );
}

/** Summoner spells, final items and trinket of one side, in the scoreboard's shape. */
export function BuildTable({ rows, players, icon, loadout, side, teamName }: Props) {
  return (
    <div className="scroll-x rounded-xl border bg-card">
      <Table className="text-xs sm:text-sm">
        <caption className="sr-only">
          {teamName} builds ({side} side)
        </caption>
        <TableHeader>
          <TableRow>
            <TeamHead side={side} teamName={teamName} />
            <TableHead title="Summoner spells" className="px-1 sm:px-2">
              Spells
            </TableHead>
            <TableHead title="Items at the end of the game, and the trinket" className="px-1 sm:px-2">
              Items
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {byRole(rows).map((r) => (
            <TableRow key={r.playerId}>
              <PlayerCell r={r} players={players} icon={icon} />
              <TableCell className="px-1 sm:px-2">
                {/* Stacked on a phone, side by side on a wider screen. */}
                <span className="inline-flex flex-col gap-0.5 sm:flex-row sm:gap-1">
                  {spellPair(r.summonerSpells).map((s) => (
                    <SpellIcon key={s} name={s} loadout={loadout} size="fluid-sm" className="sm:size-7" />
                  ))}
                </span>
              </TableCell>
              <TableCell className="px-1 pr-3 sm:px-2">
                <Inventory items={r.items} trinket={r.trinket} loadout={loadout} size="fluid" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Keystone, primary and secondary runes and stat shards of one side. */
export function RunesTable({ rows, players, icon, loadout, side, teamName }: Props) {
  return (
    <div className="scroll-x rounded-xl border bg-card">
      <Table className="text-xs sm:text-sm">
        <caption className="sr-only">
          {teamName} runes ({side} side)
        </caption>
        <TableHeader>
          <TableRow>
            <TeamHead side={side} teamName={teamName} />
            {/* On a phone the four groups speak for themselves; the labels would not fit. */}
            <TableHead className="px-1 sm:px-2">
              <span className="hidden sm:inline">Keystone</span>
            </TableHead>
            <TableHead className="px-1 sm:px-2">
              <span className="hidden sm:inline">Primary</span>
            </TableHead>
            <TableHead className="px-1 sm:px-2">
              <span className="hidden sm:inline">Secondary</span>
            </TableHead>
            <TableHead className="px-1 pr-3 sm:px-2">
              <span className="hidden sm:inline">Shards</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {byRole(rows).map((r) => {
            const [keystone, ...rest] = r.runes;
            const primary = rest.slice(0, 3);
            const secondary = rest.slice(3, 5);
            const shards = rest.slice(5, 8);
            return (
              <TableRow key={r.playerId}>
                <PlayerCell r={r} players={players} icon={icon} />
                <TableCell className="px-1 sm:px-2">
                  {keystone ? (
                    <span className="flex items-center gap-2">
                      <RuneIcon name={keystone} loadout={loadout} size="fluid-lg" />
                      <span className="hidden whitespace-nowrap sm:inline">{keystone}</span>
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="px-1 sm:px-2">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1">
                    {primary.map((n, i) => (
                      <RuneIcon key={i} name={n} loadout={loadout} size="fluid" />
                    ))}
                  </span>
                </TableCell>
                <TableCell className="px-1 sm:px-2">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1">
                    {r.secondaryTree ? (
                      <RuneIcon
                        name={r.secondaryTree}
                        loadout={loadout}
                        size="sm"
                        className="mr-0.5 hidden opacity-80 sm:inline-block"
                      />
                    ) : null}
                    {secondary.map((n, i) => (
                      <RuneIcon key={i} name={n} loadout={loadout} size="fluid" />
                    ))}
                  </span>
                </TableCell>
                <TableCell className="px-1 pr-3 sm:px-2">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1">
                    {shards.map((n, i) => (
                      <RuneIcon key={i} name={n} loadout={loadout} size="fluid-sm" shard />
                    ))}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
