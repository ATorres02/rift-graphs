"use client";

import { useEffect, useState } from "react";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { Switch } from "@/components/ui/switch";
import type { TeamRef } from "@/lib/data/load";
import type { Role } from "@/lib/data/types";
import { ROLE_LABEL } from "@/lib/format";
import { DEFAULT_MIN_GAMES, ROLES } from "@/lib/metrics";

const COLUMNS: TableColumn[] = [
  { key: "player", header: "Player", kind: "player" },
  { key: "team", header: "Team", kind: "team" },
  { key: "role", header: "Role", kind: "text" },
  { key: "games", header: "G", kind: "int", title: "Games played" },
  { key: "kdaLine", header: "K / D / A", kind: "kda", title: "Kills, deaths and assists over all games" },
  { key: "kda", header: "KDA", kind: "dec1", title: "(Kills + Assists) / Deaths over all games" },
  {
    key: "kp",
    header: "KP",
    kind: "pct",
    title: "Kill participation: share of the team's kills the player took part in",
  },
  { key: "cspm", header: "CSPM", kind: "dec1", title: "Creep score per minute" },
  { key: "dpm", header: "DPM", kind: "int", title: "Damage to champions per minute" },
  { key: "gpm", header: "GPM", kind: "int", title: "Gold per minute" },
  { key: "damageShare", header: "DMG %", kind: "pct", title: "Share of the team's damage to champions" },
  { key: "goldShare", header: "Gold %", kind: "pct", title: "Share of the team's gold" },
  { key: "vspm", header: "Vision/min", kind: "dec2", title: "Vision score per minute" },
];

const selectClass =
  "h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";

/** Sortable player table with a role filter and the minimum-games threshold. */
export function PlayersTable({ rows }: { rows: TableRowData[] }) {
  const [role, setRole] = useState<Role | "all">("all");
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r === "top" || r === "jungle" || r === "mid" || r === "bot" || r === "support") setRole(r);
  }, []);
  const [threshold, setThreshold] = useState(true);
  const [team, setTeam] = useState("all");
  const teams = Array.from(
    new Map(
      rows
        .map((r) => r.team as TeamRef | null)
        .filter((t): t is TeamRef => Boolean(t))
        .map((t) => [t.id, t]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = rows.filter(
    (r) =>
      (role === "all" || r.roleKey === role) &&
      (team === "all" || (r.team as TeamRef | null)?.id === team) &&
      (!threshold || (r.games as number) >= DEFAULT_MIN_GAMES),
  );

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
          <span className="text-muted-foreground">Team</span>
          <select className={selectClass} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={threshold}
            onCheckedChange={(checked) => setThreshold(Boolean(checked))}
            aria-label={`Only players with at least ${DEFAULT_MIN_GAMES} games`}
          />
          <span className="text-muted-foreground">At least {DEFAULT_MIN_GAMES} games</span>
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length} players
        </span>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={filtered}
        defaultSort={{ key: "kda", desc: true }}
        caption="Player statistics for the tournament"
        dense
        pageSize={20}
        rowNoun="players"
        rowLinkKey="href"
      />
    </div>
  );
}
