import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<Row> {
  key: string;
  header: string;
  /** Optional custom header content (e.g. a sort link); `header` stays the accessible text. */
  headerContent?: ReactNode;
  className?: string;
  render: (row: Row) => ReactNode;
  /**
   * With `groupKey` on the table, a spanning cell is drawn once for each group of
   * consecutive rows and spans them, so the group reads as one row.
   */
  spanGroup?: boolean;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  /** Rendered inside the card when there are no rows. */
  empty: ReactNode;
  rowKey: (row: Row) => string;
  /** Consecutive rows with the same key form one group (e.g. the items of one order). */
  groupKey?: (row: Row) => string;
}

export function DataTable<Row>({ columns, rows, empty, rowKey, groupKey }: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  // Index of the first row in each group, and how many rows that group has.
  const groupStart = rows.map((row, index) => !groupKey || index === 0 || groupKey(row) !== groupKey(rows[index - 1]));
  function groupSpan(index: number): number {
    let span = 1;
    while (index + span < rows.length && !groupStart[index + span]) span += 1;
    return span;
  }

  return (
    <div className="w-full">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-border bg-white/[0.02]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-2.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-3 xl:px-4",
                  column.className
                )}
              >
                {column.headerContent ?? column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => {
            const continuation = !groupStart[index];
            return (
              <tr
                key={rowKey(row)}
                className={cn(
                  "transition-colors hover:bg-white/[0.02]",
                  // Additional items of one order get a different background.
                  continuation && "bg-white/[0.05]"
                )}
              >
                {columns.map((column) => {
                  if (column.spanGroup && groupKey && continuation) return null;
                  const span = column.spanGroup && groupKey ? groupSpan(index) : 1;
                  return (
                    <td
                      key={column.key}
                      rowSpan={span > 1 ? span : undefined}
                      className={cn("break-words px-2.5 py-3 align-middle text-foreground sm:px-3 xl:px-4", column.className)}
                    >
                      {column.render(row)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
