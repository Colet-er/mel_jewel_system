import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<Row> {
  key: string;
  header: string;
  /** Optional custom header content (e.g. a sort link); `header` stays the accessible text. */
  headerContent?: ReactNode;
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
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="transition-colors hover:bg-white/[0.02]"
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("break-words px-2.5 py-3 align-middle text-foreground sm:px-3 xl:px-4", column.className)}>
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
