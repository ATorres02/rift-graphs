import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUnit, type ChartSpec, type ChartTable, type Unit } from "@/lib/charts/spec";
import { cn } from "@/lib/utils";

function unitForColumn(spec: ChartSpec, columnIndex: number, units?: (Unit | undefined)[]): Unit | undefined {
  if (units) return units[columnIndex];
  if (spec.type === "scatter") return columnIndex === 1 ? spec.xUnit : spec.yUnit;
  if (spec.type === "radar") return "decimal1";
  return spec.unit;
}

/** Accessible table alternative of a chart. */
export function SpecTable({
  spec,
  table,
  units,
  className,
}: {
  spec: ChartSpec;
  table: ChartTable;
  units?: (Unit | undefined)[];
  className?: string;
}) {
  return (
    <div className={cn("scroll-x max-h-[480px] overflow-y-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {table.columns.map((c, i) => (
              <TableHead key={`${c}-${i}`} className={cn(i > 0 && "text-right")}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, ri) => (
            <TableRow key={ri}>
              {row.map((cell, ci) => (
                <TableCell key={ci} className={cn("tabular", ci > 0 && "text-right")}>
                  {typeof cell === "number" ? formatUnit(cell, unitForColumn(spec, ci, units)) : (cell ?? "–")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
