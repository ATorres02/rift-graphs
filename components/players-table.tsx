"use client";

import { useState } from "react";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import { DEFAULT_MIN_GAMES, ROLES } from "@/lib/metrics";

const COLUMNS: TableColumn[] = [
  { key: "player", header: "Player", kind: "player" },
  { key: "team", header: "Team", kind: "team" },
  { key: "role", header: "Role", kind: "text" },
  { key: "games", header: "G", kind: "int", title: "Games played" },
  { key: "winRate", header: "Win %", kind: "pct", title: "Game win rate" },
  { key: "kda", header: "KDA", kind: "dec1", title: "(Kills + Assists) / Deaths over all games" },
  { key: "kp", header: "KP", kind: "pct", title: "Kill participation: share of the team's kills the player took part in" },
  { key: "cspm", header: "CSPM", kind: "dec1", title: "Creep score per minute" },
  { key: "dpm", header: "DPM", kind: "int", title: "Damage to champions per minute" },
  { key: "gpm", header: "GPM", kind: "int", title: "Gold per minute" },
  { key: "damageShare", header: "DMG %", kind: "pct", title: "Share of the team's damage to champions" },
  { key: "goldShare", header: "Gold %", kind: "pct", title: "Share of the team's gold" },
  { key: "vspm", header: "Vision/min", kind: "dec2", title: "Vision score per minute" },
];

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";

/** Sortable player table with a role filter and the minimum-games threshold. */
export function PlayersTable({ rows }: { rows: TableRowData[] }) {
  const [role, setRole] = useState<Role | "all">("all");
  const [threshold, setThreshold] = useState(true);

  const filtered = rows.filter((r) => (role === "all" || r.roleKey === role) && (!threshold || (r.games as number) >= DEFAULT_MIN_GAMES));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Role</span>
          <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role | "all")}>
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={threshold} onCheckedChange={(checked) => setThreshold(Boolean(checked))} aria-label={`Only players with at least ${DEFAULT_MIN_GAMES} games`} />
          <span className="text-muted-foreground">At least {DEFAULT_MIN_GAMES} games</span>
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length} players
        </span>
      </div>
      <DataTable columns={COLUMNS} rows={filtered} defaultSort={{ key: "kda", desc: true }} caption="Player statistics for the tournament" dense />
    </div>
  );
}
