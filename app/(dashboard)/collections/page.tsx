import { DollarSign, CreditCard } from "lucide-react";
import { describeDbError } from "@/lib/supabase/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { MonthYearFilter } from "@/components/filters/month-year-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { fetchCollections } from "@/lib/supabase/queries";

export const metadata = { title: "Collections" };

interface CollectionRow {
  id: string;
  collectedAt: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  fbName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
}

const COLUMNS: Column<CollectionRow>[] = [
  {
    key: "collectedAt",
    header: "Collected Date",
    render: (row) => formatDate(row.collectedAt),
  },
  {
    key: "orderNumber",
    header: "Invoice No.",
    render: (row) => <span className="font-medium text-pink-light">{row.orderNumber}</span>,
  },
  {
    key: "orderStatus",
    header: "Order Status",
    render: (row) => <StatusBadge status={row.orderStatus as "reserved" | "paid" | "shipped" | "claimed" | "cancelled" | "rto"} />,
  },
  {
    key: "customerName",
    header: "Customer",
    render: (row) => (
      <div>
        <span className="font-medium">{row.customerName}</span>
        {row.fbName && row.fbName !== "—" && (
          <span className="text-muted text-xs ml-2">(@{row.fbName})</span>
        )}
      </div>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    className: "text-right",
    render: (row) => <span className="font-medium text-pink-light">{formatCurrency(row.amount)}</span>,
  },
  {
    key: "paymentMethod",
    header: "Payment Method",
    render: (row) => <span className="text-muted">{row.paymentMethod}</span>,
  },
  {
    key: "referenceNumber",
    header: "Reference No.",
    render: (row) => row.referenceNumber ? <span className="font-mono text-sm">{row.referenceNumber}</span> : <span className="text-muted">—</span>,
  },
  {
    key: "notes",
    header: "Notes",
    render: (row) => row.notes ? <span className="text-muted max-w-xs truncate block">{row.notes}</span> : <span className="text-muted">—</span>,
  },
];

const CSV_HEADERS = ["Collected Date", "Invoice No.", "Order Status", "Customer", "Amount", "Payment Method", "Reference No.", "Notes"];

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(params.year, now.getFullYear() - 10, now.getFullYear() + 1, now.getFullYear());
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let collections: CollectionRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const data = await fetchCollections({ month, year, q });
    collections = (data ?? []).map((c) => ({
      id: c.id,
      collectedAt: c.collected_at,
      orderNumber: c.order?.order_number ?? "—",
      orderStatus: c.order?.status ?? "reserved",
      customerName: c.customer?.name ?? "—",
      fbName: c.customer?.fb_name ?? "—",
      amount: Number(c.amount),
      paymentMethod: c.payment_method,
      referenceNumber: c.reference_number,
      notes: c.notes,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  const totalCollected = (collections ?? []).reduce((sum, c) => sum + c.amount, 0);
  const csvRows = (collections ?? []).map((row) => [
    formatDate(row.collectedAt),
    row.orderNumber,
    row.orderStatus,
    row.customerName,
    row.amount,
    row.paymentMethod,
    row.referenceNumber ?? "",
    row.notes ?? "",
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="COLLECTIONS"
        description="Monitor collection-related records and payments."
        actions={
          <>
            <MonthYearFilter month={month} year={year} />
            <SearchInput placeholder="Search invoice, customer, reference…" />
            <ExportButton
              filename={`collections-${year}-${String(month).padStart(2, "0")}.csv`}
              headers={CSV_HEADERS}
              rows={csvRows}
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Collected"
          value={formatCurrency(totalCollected)}
          icon={<DollarSign className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Total Records"
          value={collections?.length.toLocaleString() ?? "0"}
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Collection Records</CardTitle>
            <CardDescription>
              {q ? `Filtered by “${q}”.` : "Collection records separate from the normal Paid page."}
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
              rows={collections ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<DollarSign className="h-8 w-8" aria-hidden />}
                  title={q ? "No matching collections" : "No collection records yet"}
                  description={
                    q
                      ? "Try a different search term or adjust the date filter."
                      : "Collection records for monitoring payments will appear here."
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