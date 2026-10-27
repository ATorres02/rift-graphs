"use client";

import { useState } from "react";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import type { Role } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import { ROLES } from "@/lib/metrics";

export interface ChampionRow extends TableRowData {
  champion: { name: string; ddragonId: string | null; version: string };
  presence: number;
  picks: number;
  bans: number;
  wins: number;
  winRate: number | null;
  roles: string;
  byRole: Partial<Record<Role, { games: number; wins: number }>>;
}

const BASE_COLUMNS: TableColumn[] = [
  { key: "champion", header: "Champion", kind: "champion" },
  { key: "presence", header: "Presence", kind: "pct", title: "(Picks + bans) / games" },
  { key: "picks", header: "Picks", kind: "int" },
  { key: "bans", header: "Bans", kind: "int" },
  { key: "wins", header: "Wins", kind: "int" },
  { key: "winRate", header: "Win %", kind: "pct", title: "Wins / picks" },
  { key: "roles", header: "Roles", kind: "text", sortable: false },
];

const ROLE_COLUMNS: TableColumn[] = [
  { key: "champion", header: "Champion", kind: "champion" },
  { key: "roleGames", header: "Games in role", kind: "int" },
  { key: "roleWins", header: "Wins", kind: "int" },
  { key: "roleWinRate", header: "Win %", kind: "pct" },
  { key: "presence", header: "Presence (all roles)", kind: "pct" },
  { key: "bans", header: "Bans", kind: "int" },
];

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";

/** Champion table with an optional role filter (role numbers come from player rows). */
export function ChampionsTable({ rows }: { rows: ChampionRow[] }) {
  const [role, setRole] = useState<Role | "all">("all");
  const filtered =
    role === "all"
      ? rows
      : rows
          .filter((r) => r.byRole[role])
          .map((r) => {
            const s = r.byRole[role]!;
            return { ...r, roleGames: s.games, roleWins: s.wins, roleWinRate: s.games ? s.wins / s.games : null };
          });
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
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length} champions
        </span>
      </div>
      <DataTable
        columns={role === "all" ? BASE_COLUMNS : ROLE_COLUMNS}
        rows={filtered}
        defaultSort={role === "all" ? { key: "presence", desc: true } : { key: "roleGames", desc: true }}
        caption="Champion statistics"
        dense
      />
    </div>
  );
}
