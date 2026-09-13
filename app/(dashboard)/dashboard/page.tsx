import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Clock,
  Gem,
  PackageCheck,
  Truck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Order } from "@/types";
import {
  computeTotals,
  describeDbError,
  fetchAvailableStock,
  fetchOrderStatusCounts,
  fetchOrders,
  fetchPendingDownpaymentOrders,
  settledDownpayment,
} from "@/lib/supabase/queries";
import { formatDateTime } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatCard } from "@/components/ui/stat-card";

const MAX_TABLE_ROWS = 8;

interface DownpaymentRow {
  order: Order;
  index: number;
  category: string | null;
}

const COLUMNS: Column<DownpaymentRow>[] = [
  {
    key: "no",
    header: "No.",
    className: "w-14",
    render: (row) => <span className="text-muted">{row.index}</span>,
  },
  {
    key: "date_time",
    header: "Date & Time",
    render: (row) => formatDateTime(row.order.created_at),
  },
  {
    key: "customer_name",
    header: "Customer Name",
    render: (row) => row.order.customer?.name ?? <span className="text-muted">—</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (row) => row.category ?? <span className="text-muted">—</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <DownpaymentBadge order={row.order} />,
  },
  {
    key: "action",
    header: "Action",
    render: (row) => (
      <Link
        href={`/orders/${row.order.id}`}
        className="text-sm font-medium text-pink-light hover:underline"
      >
        View Order
      </Link>
    ),
  },
];

function DownpaymentBadge({ order }: { order: Order }) {
  const paid = settledDownpayment(order);
  const label = paid <= 0 ? "Pending" : "Partial";
  const className =
    paid <= 0
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-primary/30 bg-primary/10 text-pink-light";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function buildRows(orders: Order[]): DownpaymentRow[] {
  return orders.slice(0, MAX_TABLE_ROWS).map((order, i) => ({
    order,
    index: i + 1,
    category: order.items?.[0]?.product?.category?.name ?? null,
  }));
}

function Unavailable() {
  return <span className="text-muted">—</span>;
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-3 last:border-0">
      <span className="flex min-w-0 items-center gap-2.5 text-sm text-muted">
        <span className="shrink-0 text-primary [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-foreground">
        {value === null ? <Unavailable /> : value}
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  let dbError: { title: string; description: string } | null = null;

  let statusCounts: {
    reserved: number | null;
    paid: number | null;
    shipped: number | null;
    cancelled: number | null;
  } = { reserved: null, paid: null, shipped: null, cancelled: null };
  let pendingRows: DownpaymentRow[] = [];
  let pendingCount = 0;
  let soldThisMonth: number | null = null;
  let availableStock: number | null = null;

  try {
    const [counts, pending] = await Promise.all([
      fetchOrderStatusCounts(),
      fetchPendingDownpaymentOrders(),
    ]);
    statusCounts = counts;
    pendingCount = pending.length;
    pendingRows = buildRows(pending);

    const now = new Date();
    const monthOrders = await fetchOrders({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    soldThisMonth = computeTotals(monthOrders).itemsSold;

    availableStock = await fetchAvailableStock();
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of orders and stock." />

      {dbError ? (
        <ErrorState title={dbError.title} description={dbError.description} />
      ) : null}

      {/* Summary cards */}
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Reservations"
          value={statusCounts.reserved?.toLocaleString("en-US") ?? null}
          hint={`${pendingCount} with pending downpayment`}
          icon={<Clock className="h-5 w-5" aria-hidden />}
          href="/orders/reserved"
        />
        <StatCard
          label="Pasabuy Pending"
          value={null}
          icon={<PackageCheck className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Fully Paid"
          value={statusCounts.paid?.toLocaleString("en-US") ?? null}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          href="/orders/paid"
        />
        <StatCard
          label="Cancelled"
          value={statusCounts.cancelled?.toLocaleString("en-US") ?? null}
          icon={<Ban className="h-5 w-5" aria-hidden />}
          href="/orders/cancelled"
        />
      </section>

      {/* No downpayment table */}
      <Card>
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">No Downpayment</h2>
            <p className="text-sm text-muted">Orders with unsettled downpayment.</p>
          </div>
          <Link
            href="/orders/reserved"
            className="shrink-0 text-sm font-medium text-pink-light hover:underline"
          >
            See All
          </Link>
        </div>
        <CardContent className="px-0 pb-0">
          <DataTable
            columns={COLUMNS}
            rows={pendingRows}
            rowKey={(row) => `${row.order.id}:${row.index}`}
            empty={
              <EmptyState
                icon={<Clock className="h-8 w-8" aria-hidden />}
                title="No pending downpayments."
                description="Every open order has its required downpayment fully settled."
              />
            }
          />
        </CardContent>
      </Card>

      {/* Bottom sections */}
      <section
        aria-label="Pasabuy and stock"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <Card>
          <div className="px-5 pt-5 pb-1">
            <h2 className="text-sm font-semibold text-foreground">Pasabuy &amp; Commissions</h2>
          </div>
          <CardContent className="pt-2">
            <MetricRow
              icon={<Truck />}
              label="Pre-orders in Transit"
              value={statusCounts.shipped}
            />
            <MetricRow icon={<PackageCheck />} label="Top Sales Channel" value={null} />
            <MetricRow icon={<Wallet />} label="Unpaid Commissions" value={null} />
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
            <h2 className="text-sm font-semibold text-foreground">Moissanite Stock</h2>
            <Gem className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </div>
          <CardContent className="pt-2">
            <MetricRow
              icon={<Gem />}
              label="Available Stone"
              value={availableStock === null ? null : availableStock.toLocaleString("en-US")}
            />
            <MetricRow
              icon={<PackageCheck />}
              label="Sold This Month"
              value={soldThisMonth === null ? null : soldThisMonth.toLocaleString("en-US")}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
