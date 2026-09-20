import Link from "next/link";
import { Eye, Package } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { describeDbError, fetchOrders, settledDownpayment } from "@/lib/supabase/queries";
import { formatCurrency, formatDate, formatReservationType } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { StatusManageMenu } from "@/components/orders/status-manage-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";

export type StatusViewKind = "paid" | "shipped" | "claimed" | "cancelled" | "rto";

export interface StatusOrdersViewProps {
  kind: StatusViewKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface StatusRow {
  id: string;
  /** Paid Date / Shipped Date / Claimed Date / Cancelled Date / RTO Date depending on the page. */
  date: string;
  invoiceNumber: string;
  fbName: string;
  customerName: string;
  phone: string;
  address: string;
  itemName: string;
  qty: number;
  amount: number;
  totalPaid: number;
  balance: number;
  dpPaid: number;
  type: string;
  cancellationReason: string;
  rtoReason: string;
  rtoNotes: string;
  status: OrderStatus;
}

const META: Record<
  StatusViewKind,
  {
    title: string;
    description: string;
    dateLabel: string;
    emptyTitle: string;
    emptyDescription: string;
  }
> = {
  paid: {
    title: "Paid Orders",
    description: "Fully paid orders finalized through the payment workflow.",
    dateLabel: "Paid Date",
    emptyTitle: "No paid orders",
    emptyDescription: "Reservations marked as Paid will appear here.",
  },
  shipped: {
    title: "Shipped Orders",
    description: "Completed orders on their way to customers.",
    dateLabel: "Shipped Date",
    emptyTitle: "No shipped orders",
    emptyDescription: "Paid orders marked as Shipped will appear here.",
  },
  claimed: {
    title: "Claimed Orders",
    description: "Orders received and confirmed by customers.",
    dateLabel: "Claimed Date",
    emptyTitle: "No claimed orders",
    emptyDescription: "Shipped orders marked as Claimed will appear here.",
  },
  cancelled: {
    title: "Cancelled Orders",
    description: "Cancelled order history for auditing and reporting.",
    dateLabel: "Cancelled Date",
    emptyTitle: "No cancelled orders",
    emptyDescription: "Cancelled orders will appear here for record keeping.",
  },
  rto: {
    title: "RTO Orders",
    description: "Return-to-Origin orders requiring attention.",
    dateLabel: "RTO Date",
    emptyTitle: "No RTO orders",
    emptyDescription: "Orders marked as Return to Origin will appear here.",
  },
};

function buildRow(order: Order, kind: StatusViewKind): StatusRow {
  const itemsList = order.items ?? [];
  const dpPaid = settledDownpayment(order);
  const totalPayments = (order.payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const orderTotal = Math.round(
    ((Number(order.total_amount) + Number(order.shipping_fee ?? 0)) + Number.EPSILON) * 100
  ) / 100;
  const balance = Math.max(0, Math.round((orderTotal - totalPayments + Number.EPSILON) * 100) / 100);

  const itemNameDisplay =
    itemsList.length === 0
      ? "—"
      : itemsList.length === 1
        ? (itemsList[0].product?.name ?? "—")
        : itemsList
            .map((item) => `${item.product?.name ?? "Item"} (x${item.quantity})`)
            .join(", ");

  // Fall back to the last update so legacy rows without a stamped
  // lifecycle timestamp still show a sensible date.
  const date =
    kind === "paid"
      ? (order.paid_at ?? order.updated_at)
      : kind === "shipped"
        ? (order.shipped_at ?? order.updated_at)
        : kind === "claimed"
          ? (order.claimed_at ?? order.updated_at)
          : kind === "rto"
            ? (order.rto_at ?? order.updated_at)
            : (order.cancelled_at ?? order.updated_at);

  return {
    id: order.id,
    date,
    invoiceNumber: order.order_number,
    fbName: order.customer?.fb_name || "—",
    customerName: order.customer?.name ?? "—",
    phone: order.customer?.phone || "—",
    address: order.customer?.address || "—",
    itemName: itemNameDisplay,
    qty: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    amount: orderTotal,
    totalPaid: totalPayments,
    balance,
    dpPaid,
    type: formatReservationType(order.reservation_type),
    cancellationReason: order.cancellation_reason || "—",
    rtoReason: order.rto_reason || "—",
    rtoNotes: order.rto_notes || "—",
    status: order.status,
  };
}

function buildColumns(kind: StatusViewKind, dateLabel: string): Column<StatusRow>[] {
  const invoiceColumn: Column<StatusRow> = {
    key: "invoiceNumber",
    header: "Invoice No.",
    render: (row) => <span className="whitespace-nowrap font-medium text-pink-light">{row.invoiceNumber}</span>,
  };
  const fbNameColumn: Column<StatusRow> = {
    key: "fbName",
    header: "FB Name",
    render: (row) => (
      <div className="max-w-[100px] lg:max-w-[130px] truncate text-muted" title={row.fbName}>
        {row.fbName}
      </div>
    ),
  };
  const customerColumn: Column<StatusRow> = {
    key: "customerName",
    header: "Customer",
    render: (row) => (
      <div className="max-w-[120px] lg:max-w-[160px] truncate font-medium" title={row.customerName}>
        {row.customerName}
      </div>
    ),
  };
  const itemColumn: Column<StatusRow> = {
    key: "itemName",
    header: "Item",
    render: (row) => (
      <div className="max-w-[150px] lg:max-w-[220px] truncate" title={row.itemName}>
        {row.itemName}
      </div>
    ),
  };
  const addressColumn: Column<StatusRow> = {
    key: "address",
    header: "Address",
    render: (row) => (
      <div className="max-w-[140px] lg:max-w-[200px] truncate text-muted" title={row.address}>
        {row.address}
      </div>
    ),
  };
  const qtyColumn: Column<StatusRow> = {
    key: "qty",
    header: "Qty",
    className: "text-right whitespace-nowrap",
    render: (row) => row.qty.toLocaleString("en-US"),
  };
  const amountColumn: Column<StatusRow> = {
    key: "amount",
    header: "Amount",
    className: "text-right whitespace-nowrap",
    render: (row) => formatCurrency(row.amount),
  };
  const typeColumn: Column<StatusRow> = {
    key: "type",
    header: "Type",
    render: (row) => row.type,
  };
  const statusColumn: Column<StatusRow> = {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  };

  const actionColumn: Column<StatusRow> = {
    key: "action",
    header: "Action",
    className: "text-right whitespace-nowrap",
    render: (row) => (
      <span className="inline-flex items-center justify-end gap-2">
        <Link
          href={`/orders/${row.id}/invoice`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Eye className="h-4 w-4" aria-hidden />
          View Invoice
        </Link>
        <StatusManageMenu row={row} kind={kind} />
      </span>
    ),
  };

  if (kind === "paid") {
    return [
      { key: "date", header: dateLabel, render: (row) => formatDate(row.date) },
      invoiceColumn,
      fbNameColumn,
      customerColumn,
      { key: "phone", header: "Phone", render: (row) => row.phone },
      itemColumn,
      qtyColumn,
      amountColumn,
      {
        key: "totalPaid",
        header: "Total Paid",
        className: "text-right whitespace-nowrap",
        render: (row) => formatCurrency(row.totalPaid),
      },
      typeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  if (kind === "shipped") {
    return [
      { key: "date", header: dateLabel, render: (row) => formatDate(row.date) },
      invoiceColumn,
      fbNameColumn,
      customerColumn,
      { key: "phone", header: "Phone", render: (row) => row.phone },
      addressColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      {
        key: "totalPaid",
        header: "Paid",
        className: "text-right whitespace-nowrap",
        render: (row) => (
          <div className="text-right">
            <span className="font-semibold text-foreground">{formatCurrency(row.totalPaid)}</span>
            {row.balance > 0 ? (
              <div className="text-[11px] font-medium text-amber-400">Not Fully Paid</div>
            ) : (
              <div className="text-[11px] font-medium text-emerald-400">Fully Paid</div>
            )}
          </div>
        ),
      },
      typeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  if (kind === "claimed") {
    return [
      { key: "date", header: dateLabel, render: (row) => formatDate(row.date) },
      invoiceColumn,
      fbNameColumn,
      customerColumn,
      { key: "phone", header: "Phone", render: (row) => row.phone },
      addressColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      typeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  if (kind === "rto") {
    return [
      { key: "date", header: dateLabel, render: (row) => formatDate(row.date) },
      invoiceColumn,
      fbNameColumn,
      customerColumn,
      { key: "phone", header: "Phone", render: (row) => row.phone },
      addressColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      {
        key: "rtoReason",
        header: "RTO Reason",
        render: (row) => row.rtoReason,
      },
      {
        key: "rtoNotes",
        header: "RTO Notes",
        render: (row) => row.rtoNotes,
      },
      statusColumn,
      actionColumn,
    ];
  }

  return [
    { key: "date", header: dateLabel, render: (row) => formatDate(row.date) },
    invoiceColumn,
    fbNameColumn,
    customerColumn,
    itemColumn,
    qtyColumn,
    amountColumn,
    {
      key: "dpPaid",
      header: "DP",
      className: "text-right whitespace-nowrap",
      render: (row) => formatCurrency(row.dpPaid),
    },
    typeColumn,
    { key: "cancellationReason", header: "Cancellation Reason", render: (row) => row.cancellationReason },
    statusColumn,
    actionColumn,
  ];
}

const CSV_BASE_HEADERS = [
  "Date",
  "Invoice No.",
  "FB Name",
  "Customer",
  "Phone",
  "Address",
  "Item",
  "Qty",
  "Amount",
  "Total Paid",
  "Balance",
  "DP",
  "Type",
  "Cancellation Reason",
  "RTO Reason",
  "RTO Notes",
  "Status",
];

function toCsvRow(row: StatusRow): (string | number)[] {
  return [
    formatDate(row.date),
    row.invoiceNumber,
    row.fbName,
    row.customerName,
    row.phone,
    row.address,
    row.itemName,
    row.qty,
    row.amount,
    row.totalPaid,
    row.balance,
    row.dpPaid,
    row.type,
    row.cancellationReason,
    row.rtoReason,
    row.rtoNotes,
    row.status,
  ];
}

/** Shared list view for the Paid, Shipped, Claimed, Cancelled, and RTO status pages. */
export async function StatusOrdersView({ kind, searchParams }: StatusOrdersViewProps) {
  const meta = META[kind];
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;

  let orders: Order[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    orders = await fetchOrders({ status: kind, q });
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = (orders ?? []).map((order) => buildRow(order, kind));
  const columns = buildColumns(kind, meta.dateLabel);

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title.toUpperCase()}
        description={meta.description}
        actions={
          <>
            <SearchInput placeholder="Search orders…" />
            <ExportButton
              filename={`${kind}-orders.csv`}
              headers={CSV_BASE_HEADERS}
              rows={rows.map(toCsvRow)}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{meta.title}</CardTitle>
          <CardDescription>{q ? `Filtered by “${q}”.` : meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<Package className="h-8 w-8" aria-hidden />}
                  title={meta.emptyTitle}
                  description={meta.emptyDescription}
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
