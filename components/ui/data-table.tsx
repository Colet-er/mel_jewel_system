import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<Row> {
  key: string;
  header: string;
  className?: string;
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  /** Rendered inside the card when there are no rows. */
  empty: ReactNode;
  rowKey: (row: Row) => string;
}

export function DataTable<Row>({ columns, rows, empty, rowKey }: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="w-full overflow-x-auto [scrollbar-gutter:stable]">
      <table className="w-full min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-white/[0.02]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="h-[58px] transition-colors hover:bg-white/[0.02]"
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-2 sm:px-5 text-sm text-foreground", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
