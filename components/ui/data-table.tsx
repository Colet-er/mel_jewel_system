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
    <div className="w-full overflow-x-auto rounded-b-2xl [scrollbar-gutter:stable]">
      <table className="w-max min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.025]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted xl:px-5",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-white/[0.055] transition-colors last:border-0 even:bg-white/[0.012] hover:bg-primary/[0.045]"
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-4 xl:px-5", column.className)}>
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
