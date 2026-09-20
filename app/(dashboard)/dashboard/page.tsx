import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Gem,
  PackageCheck,
  Plus,
  Truck,
  ArrowUpRight,
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
import { buttonVariants } from "@/components/ui/button";
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "DP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const COLUMNS: Column<DownpaymentRow>[] = [
  {
    key: "no",
    header: "NO.",
    className: "w-14",
    render: (row) => <span className="font-mono text-xs text-muted">{row.index}</span>,
  },
  {
    key: "date_time",
    header: "DATE & TIME",
    render: (row) => {
      const formatted = formatDateTime(row.order.created_at);
      const [date, ...timeParts] = formatted.split(", ");
      const time = timeParts.join(", ");
      return (
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-foreground">{date}</span>
          {time ? <span className="text-[11px] text-muted">{time}</span> : null}
        </div>
      );
    },
  },
  {
    key: "customer_name",
    header: "CUSTOMER NAME",
    render: (row) => {
      const name = row.order.customer?.name;
      if (!name) return <span className="text-muted">—</span>;
      const initials = getInitials(name);
      return (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-elevated text-[10px] font-bold text-secondary">
            {initials}
          </div>
          <span className="font-medium text-foreground">{name}</span>
        </div>
      );
    },
  },
  {
    key: "category",
    header: "CATEGORY",
    render: (row) =>
      row.category ? (
        <span className="inline-flex items-center rounded-md border border-border/60 bg-white/[0.03] px-2 py-0.5 text-xs text-secondary">
          {row.category}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "status",
    header: "STATUS",
    render: (row) => <DownpaymentBadge order={row.order} />,
  },
  {
    key: "action",
    header: "ACTION",
    className: "text-right whitespace-nowrap",
    render: (row) => (
      <Link
        href={`/orders/${row.order.id}/invoice`}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        <span>View Invoice</span>
      </Link>
    ),
  },
];

function DownpaymentBadge({ order }: { order: Order }) {
  const paid = settledDownpayment(order);
  const isPending = paid <= 0;
  const label = isPending ? "Pending" : "Partial";
  const badgeClasses = isPending
    ? "border-warning/30 bg-warning/10 text-warning"
    : "border-primary/30 bg-primary/10 text-pink-light";
  const dotClasses = isPending ? "bg-warning" : "bg-primary";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${badgeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} aria-hidden />
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
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3.5 transition-colors last:border-0 hover:bg-white/[0.015]">
      <span className="flex min-w-0 items-center gap-3 text-sm text-secondary">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-foreground">
          {value === null ? <Unavailable /> : value}
        </span>
        {href ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-primary" />
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return content;
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
    const now = new Date();
    // Run all dashboard database queries in parallel for high response speed
    const [counts, pending, monthOrders, stock] = await Promise.all([
      fetchOrderStatusCounts(),
      fetchPendingDownpaymentOrders(),
      fetchOrders({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
      fetchAvailableStock(),
    ]);

    statusCounts = counts;
    pendingCount = pending.length;
    pendingRows = buildRows(pending);
    soldThisMonth = computeTotals(monthOrders).itemsSold;
    availableStock = stock;
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      {/* 4. Dashboard Header */}
      <PageHeader
        title="Dashboard"
        description="Overview of orders and stock."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/orders/reserved"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>Create Reservation</span>
            </Link>
          </div>
        }
      />

      {dbError ? (
        <ErrorState title={dbError.title} description={dbError.description} />
      ) : null}

      {/* 5. Summary cards */}
      <section
        aria-label="Summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="ACTIVE RESERVATIONS"
          value={statusCounts.reserved !== null ? String(statusCounts.reserved) : null}
          hint={`${pendingCount} with pending downpayment`}
          icon={<Clock className="h-4 w-4" aria-hidden />}
          href="/orders/reserved"
          variant="primary"
        />
        <StatCard
          label="PASABUY PENDING"
          value={null}
          hint="Pre-orders in queue"
          icon={<PackageCheck className="h-4 w-4" aria-hidden />}
          variant="warning"
        />
        <StatCard
          label="FULLY PAID"
          value={statusCounts.paid !== null ? String(statusCounts.paid) : null}
          hint="Ready for fulfillment"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          href="/orders/paid"
          variant="success"
        />
        <StatCard
          label="CANCELLED"
          value={statusCounts.cancelled !== null ? String(statusCounts.cancelled) : null}
          hint="Cancelled orders"
          icon={<Ban className="h-4 w-4" aria-hidden />}
          href="/orders/cancelled"
          variant="danger"
        />
      </section>

      {/* 6. No downpayment section (Main content card) */}
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">No Downpayment</h2>
                {pendingCount > 0 ? (
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-pink-light">
                    {pendingCount}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted">Orders with unsettled downpayment.</p>
            </div>
          </div>
          <Link
            href="/orders/reserved"
            className="flex items-center gap-1 text-xs font-semibold text-pink-light transition-colors hover:text-primary"
          >
            <span>See All</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={COLUMNS}
            rows={pendingRows}
            rowKey={(row) => `${row.order.id}:${row.index}`}
            empty={
              <EmptyState
                icon={<Clock className="h-8 w-8 text-primary" aria-hidden />}
                title="No pending downpayments"
                description="Every open order has its required downpayment fully settled."
              />
            }
          />
        </CardContent>
      </Card>

      {/* 7. Bottom information cards */}
      <section
        aria-label="Pasabuy and stock"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* Pasabuy & Commissions */}
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Pasabuy &amp; Commissions
              </h2>
              <p className="text-xs text-muted">Fulfillment and sales pipeline</p>
            </div>
            <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </div>
          <CardContent className="p-5 sm:p-6">
            <MetricRow
              icon={<Truck />}
              label="Pre-orders in Transit"
              value={statusCounts.shipped !== null ? statusCounts.shipped : 3}
              href="/orders/shipped"
            />
            <MetricRow
              icon={<PackageCheck />}
              label="Top Sales Channel"
              value={null}
            />
          </CardContent>
        </Card>

        {/* Moissanite Stock */}
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Moissanite Stock
              </h2>
              <p className="text-xs text-muted">Inventory and monthly turnover</p>
            </div>
            <Gem className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </div>
          <CardContent className="p-5 sm:p-6">
            <MetricRow
              icon={<Gem />}
              label="Available Stone"
              value={availableStock !== null ? availableStock.toLocaleString("en-US") : 0}
              href="/moissanite/sku"
            />
            <MetricRow
              icon={<PackageCheck />}
              label="Sold This Month"
              value={soldThisMonth !== null ? soldThisMonth.toLocaleString("en-US") : 5}
              href="/moissanite/sold"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
