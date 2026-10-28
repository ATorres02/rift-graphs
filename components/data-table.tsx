"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { ChampionIcon, type ChampionIconRef } from "@/components/champion-icon";
import { TeamPill } from "@/components/team-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamRef } from "@/lib/data/load";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CellKind =
  "text" | "int" | "dec1" | "dec2" | "pct" | "pct1" | "duration" | "player" | "team" | "champion" | "result" | "link";

export interface TableColumn {
  key: string;
  header: string;
  kind?: CellKind;
  /** Tooltip explaining the metric. */
  title?: string;
  sortable?: boolean;
  /** Lower is better (sort ascending first). */
  ascending?: boolean;
  className?: string;
}

export type TableRowData = Record<string, unknown>;

export interface PlayerCell {
  id: string;
  name: string;
}
export interface LinkCell {
  href: string;
  label: string;
}

interface DataTableProps {
  columns: TableColumn[];
  rows: TableRowData[];
  defaultSort?: { key: string; desc?: boolean };
  caption?: string;
  stickyFirst?: boolean;
  dense?: boolean;
  emptyMessage?: string;
  className?: string;
}

function renderCell(kind: CellKind | undefined, value: unknown) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">–</span>;
  switch (kind) {
    case "int":
      return fmt.int(value as number);
    case "dec1":
      return fmt.dec(value as number, 1);
    case "dec2":
      return fmt.dec(value as number, 2);
    case "pct":
      return fmt.pct(value as number);
    case "pct1":
      return fmt.pct(value as number, 1);
    case "duration":
      return fmt.duration(value as number);
    case "player": {
      const p = value as PlayerCell;
      return (
        <Link href={`/players/${p.id}`} className="font-medium hover:text-brand">
          {p.name}
        </Link>
      );
    }
    case "team":
      return <TeamPill team={value as TeamRef} size="sm" />;
    case "champion": {
      const c = value as ChampionIconRef;
      return <ChampionIcon champion={c} size="sm" showName />;
    }
    case "result": {
      const win = value === "W" || value === true;
      return <span className={cn("font-semibold", win ? "text-win" : "text-loss")}>{win ? "Win" : "Loss"}</span>;
    }
    case "link": {
      const l = value as LinkCell;
      return (
        <Link href={l.href} className="hover:text-brand">
          {l.label}
        </Link>
      );
    }
    default:
      return String(value);
  }
}

function sortValue(kind: CellKind | undefined, value: unknown): number | string {
  if (value === null || value === undefined)
    return kind === "text" || kind === "player" || kind === "team" || kind === "champion"
      ? ""
      : Number.NEGATIVE_INFINITY;
  if (kind === "player") return (value as PlayerCell).name.toLowerCase();
  if (kind === "team") return (value as TeamRef).short.toLowerCase();
  if (kind === "champion") return (value as ChampionIconRef).name.toLowerCase();
  if (kind === "link") return (value as LinkCell).label.toLowerCase();
  if (kind === "result") return value === "W" || value === true ? 1 : 0;
  return typeof value === "number" ? value : String(value).toLowerCase();
}

const NUMERIC: CellKind[] = ["int", "dec1", "dec2", "pct", "pct1", "duration"];

/** Sortable table (TanStack Table) with a sticky first column and horizontal scroll on small screens. */
export function DataTable({
  columns,
  rows,
  defaultSort,
  caption,
  stickyFirst = true,
  dense = false,
  emptyMessage = "No rows match the current filters.",
  className,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>(
    defaultSort ? [{ id: defaultSort.key, desc: defaultSort.desc ?? true }] : [],
  );

  const columnDefs = useMemo<ColumnDef<TableRowData>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        accessorFn: (row) => sortValue(c.kind, row[c.key]),
        header: c.header,
        enableSorting: c.sortable !== false,
        sortDescFirst: !c.ascending && (c.kind === undefined || NUMERIC.includes(c.kind) || c.kind === "result"),
        cell: (info) => renderCell(c.kind, info.row.original[c.key]),
        meta: c,
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn("scroll-x rounded-xl border bg-card", className)}>
      <Table className={cn(dense && "text-xs")}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header, i) => {
                const meta = header.column.columnDef.meta as TableColumn;
                const numeric = meta.kind !== undefined && NUMERIC.includes(meta.kind);
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    title={meta.title}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={cn(
                      "whitespace-nowrap",
                      numeric && "text-right",
                      stickyFirst && i === 0 && "sticky left-0 z-10 bg-card",
                      meta.className,
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 font-medium hover:text-foreground",
                          numeric && "flex-row-reverse",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUpIcon className="size-3" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon className="size-3" aria-hidden />
                        ) : (
                          <ArrowUpDownIcon className="size-3 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell, i) => {
                  const meta = cell.column.columnDef.meta as TableColumn;
                  const numeric = meta.kind !== undefined && NUMERIC.includes(meta.kind);
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap",
                        numeric && "text-right tabular",
                        stickyFirst && i === 0 && "sticky left-0 z-10 bg-card",
                        meta.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
