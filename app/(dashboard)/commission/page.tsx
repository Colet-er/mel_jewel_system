import { CreditCard, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { describeDbError } from "@/lib/supabase/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { MonthYearFilter } from "@/components/filters/month-year-filter";
import { CommissionStatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import type { Commission } from "@/types";
import { fetchCommissions, computeCommissionSummary } from "@/lib/supabase/queries";

export const metadata = { title: "Commission" };

interface CommissionRow {
  id: string;
  workerName: string;
  date: string;
  relatedOrderNumber: string | null;
  description: string | null;
  amount: number;
  status: "paid" | "unpaid";
  notes: string | null;
}

const COLUMNS: Column<CommissionRow>[] = [
  {
    key: "date",
    header: "Date",
    render: (row) => formatDate(row.date),
  },
  {
    key: "workerName",
    header: "Worker Name",
    render: (row) => <span className="font-medium text-foreground">{row.workerName}</span>,
  },
  {
    key: "relatedOrderNumber",
    header: "Related Order/Invoice",
    render: (row) => row.relatedOrderNumber ? (
      <span className="font-mono text-sm text-pink-light">{row.relatedOrderNumber}</span>
    ) : (
      <span className="text-muted">—</span>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (row) => row.description ? <span className="max-w-xs truncate block">{row.description}</span> : <span className="text-muted">—</span>,
  },
  {
    key: "amount",
    header: "Commission Amount",
    className: "text-right",
    render: (row) => <span className="font-medium text-pink-light">{formatCurrency(row.amount)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <CommissionStatusBadge status={row.status} />,
  },
  {
    key: "notes",
    header: "Notes",
    render: (row) => row.notes ? <span className="text-muted max-w-xs truncate block">{row.notes}</span> : <span className="text-muted">—</span>,
  },
];

const CSV_HEADERS = ["Date", "Worker Name", "Related Order/Invoice", "Description", "Commission Amount", "Status", "Notes"];

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(params.year, now.getFullYear() - 10, now.getFullYear() + 1, now.getFullYear());
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : undefined;

  let commissions: CommissionRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const data = await fetchCommissions({ month, year, q, status: status as "paid" | "unpaid" | undefined });
    commissions = (data ?? []).map((c) => ({
      id: c.id,
      workerName: c.worker_name,
      date: c.date,
      relatedOrderNumber: c.related_order?.order_number ?? null,
      description: c.description,
      amount: Number(c.amount),
      status: c.status,
      notes: c.notes,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  const summary = computeCommissionSummary(commissions as unknown as Commission[]);
  const csvRows = (commissions ?? []).map((row) => [
    formatDate(row.date),
    row.workerName,
    row.relatedOrderNumber ?? "",
    row.description ?? "",
    row.amount,
    row.status,
    row.notes ?? "",
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="COMMISSION"
        description="Manage worker commission details."
        actions={
          <>
            <MonthYearFilter month={month} year={year} />
            <SearchInput placeholder="Search worker, order, description…" />
            <ExportButton
              filename={`commission-${year}-${String(month).padStart(2, "0")}.csv`}
              headers={CSV_HEADERS}
              rows={csvRows}
            />
            <Button disabled title="Add commission functionality coming soon">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add Commission
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Commission"
          value={formatCurrency(summary.totalCommission)}
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Paid Commission"
          value={formatCurrency(summary.paidCommission)}
          icon={<CheckCircle className="h-5 w-5 text-success" aria-hidden />}
        />
        <StatCard
          label="Unpaid Commission"
          value={formatCurrency(summary.unpaidCommission)}
          icon={<AlertCircle className="h-5 w-5 text-warning" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Commission Records</CardTitle>
            <CardDescription>
              {q ? `Filtered by “${q}”.` : "All commission records for the selected period."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={commissions ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<CreditCard className="h-8 w-8" aria-hidden />}
                  title={q ? "No matching commissions" : "No commission records yet"}
                  description={
                    q
                      ? "Try a different search term or adjust the filters."
                      : "Manually added commission details for workers will appear here."
                  }
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function clampInt(
  raw: string | string[] | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (!raw) return fallback;
  const val = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(val, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}