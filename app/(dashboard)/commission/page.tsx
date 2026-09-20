import Link from "next/link";
import { CreditCard, ShieldCheck, ShoppingBag, Users, CheckCircle2, Clock } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { describeDbError, fetchCommissions, fetchOrders } from "@/lib/supabase/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { MonthYearFilter } from "@/components/filters/month-year-filter";
import { CommissionStatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { CommissionRecordForm } from "@/components/commission/commission-record-form";
import { CommissionActionMenu } from "@/components/commission/commission-action-menu";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Commission & Assistance" };

interface AssistedItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
}

interface CommissionRow {
  id: string;
  relatedOrderId: string | null;
  date: string;
  customerName: string;
  customerFbName: string | null;
  orderNumber: string | null;
  items: AssistedItem[];
  fallbackDescription: string | null;
  salePrice: number;
  assistedBy: string;
  commissionAmount: number;
  status: "paid" | "unpaid";
  notes: string | null;
}

const COLUMNS: Column<CommissionRow>[] = [
  {
    key: "customerName",
    header: "Customer",
    render: (row) => {
      const initials = (row.customerName || "U")
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

      return (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-pink-light ring-1 ring-primary/20">
            {initials || "C"}
          </div>
          <div>
            <p className="font-semibold text-foreground">{row.customerName}</p>
            {row.customerFbName && row.customerFbName !== row.customerName ? (
              <p className="text-xs text-muted">{row.customerFbName}</p>
            ) : null}
          </div>
        </div>
      );
    },
  },
  {
    key: "orderNumber",
    header: "Order #",
    render: (row) =>
      row.orderNumber ? (
        row.relatedOrderId ? (
          <Link
            href={`/orders/${row.relatedOrderId}/invoice`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
            title="View invoice"
          >
            {row.orderNumber}
          </Link>
        ) : (
          <span className="font-mono text-xs font-semibold text-pink-light">{row.orderNumber}</span>
        )
      ) : (
        <span className="text-xs text-muted italic">Unlinked</span>
      ),
  },
  {
    key: "items",
    header: "Assisted Items & Price",
    render: (row) =>
      row.items.length > 0 ? (
        <div className="min-w-[200px] space-y-1.5">
          {row.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
              <div>
                <p className="font-medium text-foreground">
                  {item.quantity > 1 ? `${item.quantity}x ` : ""}
                  {item.name}
                </p>
                {item.sku ? <p className="font-mono text-[11px] text-muted">{item.sku}</p> : null}
              </div>
              <span className="font-medium text-muted shrink-0">{formatCurrency(item.price)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs">
          <span className="text-muted">{row.fallbackDescription ?? "Custom assistance"}</span>
          {row.salePrice > 0 && (
            <span className="ml-2 font-medium text-foreground">({formatCurrency(row.salePrice)})</span>
          )}
        </div>
      ),
  },
  {
    key: "assistedBy",
    header: "Assisted By",
    render: (row) => (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-pink-light ring-1 ring-primary/20">
        {row.assistedBy}
      </span>
    ),
  },
  {
    key: "date",
    header: "Date",
    render: (row) => <span className="text-xs text-muted">{formatDate(row.date)}</span>,
  },
  {
    key: "commissionAmount",
    header: "Commission",
    className: "text-right",
    render: (row) => (
      <span className="font-bold text-foreground text-sm">
        {formatCurrency(row.commissionAmount)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <CommissionStatusBadge status={row.status} />,
  },
  {
    key: "action",
    header: "Actions",
    className: "text-right whitespace-nowrap",
    render: (row) => (
      <CommissionActionMenu
        id={row.id}
        status={row.status}
        relatedOrderId={row.relatedOrderId}
        customerName={row.customerName}
        workerName={row.assistedBy}
      />
    ),
  },
];

const CSV_HEADERS = [
  "Customer's Name",
  "Facebook Name",
  "Order Number",
  "Assisted Items",
  "Total Sale Price",
  "Assisted By",
  "Date",
  "Commission Amount",
  "Status",
  "Notes",
];

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await getCurrentProfile();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    notFound();
  }

  const params = await searchParams;
  const now = new Date();
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(
    params.year,
    now.getFullYear() - 10,
    now.getFullYear() + 1,
    now.getFullYear()
  );
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const statusFilter = typeof params.status === "string" ? params.status : "all";

  let rows: CommissionRow[] | null = null;
  let orderOptions: { id: string; label: string }[] = [];
  let dbError: { title: string; description: string } | null = null;
  let allMonthCommissions: CommissionRow[] = [];

  try {
    const [commissions, orders] = await Promise.all([
      fetchCommissions({
        month,
        year,
      }),
      fetchOrders({ month, year }),
    ]);

    orderOptions = orders
      .filter((order) => order.status !== "cancelled" && order.status !== "rto")
      .map((order) => ({
        id: order.id,
        label: `${order.order_number} - ${order.customer?.name ?? "Unknown"} (${formatCurrency(Number(order.total_amount))})`,
      }));

    allMonthCommissions = (commissions ?? []).map((commission) => {
      const order = commission.related_order;
      const items = (order?.items ?? []).map((item) => ({
        id: item.id,
        name: item.product?.name ?? "Unknown item",
        sku: item.product?.sku ?? null,
        quantity: item.quantity,
        price: Number(item.line_total ?? item.unit_price * item.quantity),
      }));

      return {
        id: commission.id,
        relatedOrderId: order?.id ?? null,
        date: commission.date,
        customerName: order?.customer?.name ?? "Unlinked customer",
        customerFbName: order?.customer?.fb_name ?? null,
        orderNumber: order?.order_number ?? null,
        items,
        fallbackDescription: commission.description,
        salePrice: Number(order?.total_amount ?? 0),
        assistedBy: commission.worker_name,
        commissionAmount: Number(commission.amount),
        status: commission.status,
        notes: commission.notes,
      };
    });

    let mappedRows = allMonthCommissions;

    if (statusFilter === "paid" || statusFilter === "unpaid") {
      mappedRows = mappedRows.filter((r) => r.status === statusFilter);
    }

    const needle = q.toLocaleLowerCase();
    rows = needle
      ? mappedRows.filter((row) =>
          [
            row.customerName,
            row.customerFbName,
            row.orderNumber,
            row.assistedBy,
            row.fallbackDescription,
            row.notes,
            ...row.items.flatMap((item) => [item.name, item.sku]),
          ].some((value) => value?.toLocaleLowerCase().includes(needle))
        )
      : mappedRows;
  } catch (error) {
    dbError = describeDbError(error);
  }

  const records = rows ?? [];
  const employeeCount = new Set(allMonthCommissions.map((row) => row.assistedBy.toLocaleLowerCase())).size;
  
  const orderSales = new Map<string, number>();
  for (const row of allMonthCommissions) {
    if (row.relatedOrderId && !orderSales.has(row.relatedOrderId)) {
      orderSales.set(row.relatedOrderId, row.salePrice);
    }
  }
  const trackedSales = [...orderSales.values()].reduce((sum, amount) => sum + amount, 0);
  const totalCommission = allMonthCommissions.reduce((sum, row) => sum + row.commissionAmount, 0);
  const paidCommission = allMonthCommissions
    .filter((r) => r.status === "paid")
    .reduce((sum, row) => sum + row.commissionAmount, 0);
  const unpaidCommission = allMonthCommissions
    .filter((r) => r.status === "unpaid")
    .reduce((sum, row) => sum + row.commissionAmount, 0);

  const csvRows = records.map((row) => [
    row.customerName,
    row.customerFbName ?? "",
    row.orderNumber ?? "",
    row.items.map((item) => `${item.quantity}x ${item.name}`).join(" | ") ||
      row.fallbackDescription ||
      "",
    row.salePrice,
    row.assistedBy,
    formatDate(row.date),
    row.commissionAmount,
    row.status,
    row.notes ?? "",
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="COMMISSION & ASSISTANCE"
        description="Track employee customer assistance records, order allocations, and commission settlements."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              filename={`commission-records-${year}-${String(month).padStart(2, "0")}.csv`}
              headers={CSV_HEADERS}
              rows={csvRows}
            />
            <CommissionRecordForm orders={orderOptions} />
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assistance Records"
          value={allMonthCommissions.length.toLocaleString()}
          icon={<ShieldCheck className="h-5 w-5 text-success" aria-hidden />}
        />
        <StatCard
          label="Active Employees"
          value={employeeCount.toLocaleString()}
          icon={<Users className="h-5 w-5 text-primary" aria-hidden />}
        />
        <StatCard
          label="Tracked Order Sales"
          value={formatCurrency(trackedSales)}
          icon={<ShoppingBag className="h-5 w-5 text-pink-light" aria-hidden />}
        />
        <StatCard
          label="Total Commission"
          value={formatCurrency(totalCommission)}
          icon={<CreditCard className="h-5 w-5 text-amber-400" aria-hidden />}
        />
      </div>

      {/* Filter and Control Bar */}
      <Card className="border-white/[0.08] bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <Link
                href={`/commission?month=${month}&year=${year}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0",
                  statusFilter === "all"
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                <span>All</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    statusFilter === "all" ? "bg-white/20 text-white" : "bg-elevated text-muted"
                  )}
                >
                  {allMonthCommissions.length}
                </span>
              </Link>

              <Link
                href={`/commission?month=${month}&year=${year}&status=unpaid${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0",
                  statusFilter === "unpaid"
                    ? "bg-warning text-black shadow-md shadow-warning/25"
                    : "text-muted hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Unpaid ({formatCurrency(unpaidCommission)})</span>
              </Link>

              <Link
                href={`/commission?month=${month}&year=${year}&status=paid${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0",
                  statusFilter === "paid"
                    ? "bg-success text-black shadow-md shadow-success/25"
                    : "text-muted hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Paid ({formatCurrency(paidCommission)})</span>
              </Link>
            </div>

            {/* Date and Search Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <MonthYearFilter month={month} year={year} />
              <div className="w-full sm:w-64">
                <SearchInput placeholder="Search customer, item, employee..." />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Assistance & Commission Ledger</CardTitle>
          <CardDescription>
            {q
              ? `Showing assistance records matching "${q}".`
              : "Review employee sales assistance, calculate commissions, and settle payments."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={records}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<CreditCard className="h-8 w-8 text-muted" aria-hidden />}
                  title={q ? "No matching assistance records" : "No commission records for this period"}
                  description={
                    q
                      ? "Try searching for a different customer name, employee, or item."
                      : "Use the 'Add Record' button to link an employee's assistance to a customer order."
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
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
