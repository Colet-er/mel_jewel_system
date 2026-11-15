import { Package } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { describeDbError, fetchOrders, fetchPaidPageOrders, settledDownpayment } from "@/lib/supabase/queries";
import { readSortParams, sortRows, type SortDir } from "@/lib/utils/sort";
import { SortHeaderLink } from "@/components/ui/sort-header";
import { formatCurrency, formatDate, formatReservationType } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { StatusManageMenu } from "@/components/orders/status-manage-menu";
import { FbNameInvoiceLink } from "@/components/orders/invoice-modal";
import { DeliveryStatusChip, DeliveryStatusSelect } from "@/components/orders/delivery-status-select";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
  type BulkAction,
} from "@/components/orders/bulk-selection";
import { DELIVERY_STATUS_CONFIG, isDeliveryStatus, type DeliveryStatus } from "@/lib/utils/delivery-status";
import { TrackingNumberCell } from "@/components/orders/tracking-number-cell";

export type StatusViewKind = "paid" | "booked" | "shipped" | "claimed" | "cancelled" | "rto";

export interface StatusOrdersViewProps {
  kind: StatusViewKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface StatusRow {
  id: string;
  /** Paid Date / Shipped Date / Claimed Date / Cancelled Date / RTO Date depending on the page. */
  date: string;
  orderType: string;
  fbName: string;
  /** Item codes, comma-separated ("—" when none). */
  codes: string;
  /** Reference numbers of the recorded payments, comma-separated. */
  reference: string;
  trackingNumber: string | null;
  deliveryStatus: string | null;
  phone: string;
  address: string;
  itemName: string;
  qty: number;
  amount: number;
  totalPaid: number;
  balance: number;
  dpPaid: number;
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
    description: "Fully paid orders and reservations with a downpayment.",
    dateLabel: "Paid Date",
    emptyTitle: "No paid orders",
    emptyDescription: "Reservations with a downpayment or full payment will appear here.",
  },
  booked: {
    title: "Booking",
    description: "Booked orders waiting to ship. Add the tracking no., then mark as shipped.",
    dateLabel: "Booked Date",
    emptyTitle: "No booked orders",
    emptyDescription: "Paid orders you book for shipping will appear here.",
  },
  shipped: {
    title: "Shipped Orders",
    description: "Orders shipped with a tracking number.",
    dateLabel: "Shipped Date",
    emptyTitle: "No shipped orders",
    emptyDescription: "Booked orders marked as Shipped will appear here.",
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

function latestPaymentDate(order: Order): string | null {
  const dates = (order.payments ?? [])
    .map((payment) => payment.created_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

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
      ? (order.paid_at ?? latestPaymentDate(order) ?? order.updated_at)
      : kind === "booked"
        ? (order.booked_at ?? order.updated_at)
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
    orderType: formatReservationType(order.reservation_type),
    fbName: order.customer?.fb_name || "—",
    codes:
      itemsList
        .map((item) => item.product?.sku?.trim())
        .filter((code): code is string => Boolean(code))
        .join(", ") || "—",
    reference:
      (order.payments ?? [])
        .map((payment) => payment.reference_number?.trim())
        .filter((ref): ref is string => Boolean(ref))
        .join(", ") || "—",
    trackingNumber: order.tracking_number?.trim() || null,
    deliveryStatus: order.delivery_status ?? null,
    phone: order.customer?.phone || "—",
    address: order.customer?.address || "—",
    itemName: itemNameDisplay,
    qty: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    amount: orderTotal,
    totalPaid: totalPayments,
    balance,
    dpPaid,
    cancellationReason: order.cancellation_reason || "—",
    rtoReason: order.rto_reason || "—",
    rtoNotes: order.rto_notes || "—",
    status: order.status,
  };
}

/** Chip shown when an order has no delivery status saved yet. */
const DEFAULT_DELIVERY_STATUS: Partial<Record<StatusViewKind, DeliveryStatus>> = {
  shipped: "shipped",
  claimed: "delivered",
  rto: "rto",
};

/** Bulk actions offered (with row checkboxes) on each page. */
const BULK_ACTIONS: Record<StatusViewKind, BulkAction[]> = {
  paid: ["cancel"],
  booked: ["ship", "cancel"],
  shipped: ["claim", "cancel"],
  claimed: [],
  cancelled: [],
  rto: ["cancel"],
};

type StatusSortKey = "date" | "fbName" | "itemName";
const SORT_KEYS = ["date", "fbName", "itemName"] as const;

function buildColumns(
  kind: StatusViewKind,
  dateLabel: string,
  sort: { key: StatusSortKey; dir: SortDir }
): Column<StatusRow>[] {
  const sortHeader = (label: string, key: StatusSortKey) => (
    <SortHeaderLink label={label} sortKey={key} activeKey={sort.key} activeDir={sort.dir} />
  );
  const dateColumn: Column<StatusRow> = {
    key: "date",
    header: dateLabel,
    headerContent: sortHeader(dateLabel, "date"),
    className: "whitespace-nowrap",
    render: (row) => formatDate(row.date),
  };
  const orderTypeColumn: Column<StatusRow> = {
    key: "orderType",
    header: "Order Type",
    className: "whitespace-nowrap",
    render: (row) => row.orderType,
  };
  const fbNameColumn: Column<StatusRow> = {
    key: "fbName",
    header: "FB Name",
    headerContent: sortHeader("FB Name", "fbName"),
    render: (row) => <FbNameInvoiceLink orderId={row.id} fbName={row.fbName} />,
  };
  const itemColumn: Column<StatusRow> = {
    key: "itemName",
    header: "Item",
    headerContent: sortHeader("Item", "itemName"),
    render: (row) => (
      <div className="min-w-[6rem] break-words">{row.itemName}</div>
    ),
  };
  const addressColumn: Column<StatusRow> = {
    key: "address",
    header: "Address",
    render: (row) => (
      <div className="min-w-[6rem] break-words text-muted">{row.address}</div>
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
  // The page already says which stage the order is in, so the Status column
  // shows the courier/delivery chip instead (editable except on Cancelled).
  const statusColumn: Column<StatusRow> = {
    key: "status",
    header: "Status",
    className: "whitespace-nowrap",
    render: (row) =>
      kind === "cancelled" ? (
        <DeliveryStatusChip value={row.deliveryStatus} />
      ) : (
        <DeliveryStatusSelect orderId={row.id} value={row.deliveryStatus ?? DEFAULT_DELIVERY_STATUS[kind] ?? null} />
      ),
  };
  // On the Paid page show the payment state instead of the lifecycle status.
  const paymentStateColumn: Column<StatusRow> = {
    key: "paymentState",
    header: "Payment",
    className: "whitespace-nowrap",
    render: (row) =>
      row.balance > 0 ? (
        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
          With Downpayment
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
          Fully Paid
        </span>
      ),
  };

  const actionColumn: Column<StatusRow> = {
    key: "action",
    header: "Action",
    className: "text-right whitespace-nowrap",
    render: (row) => <StatusManageMenu row={row} kind={kind} />,
  };

  const phoneColumn: Column<StatusRow> = {
    key: "phone",
    header: "Phone",
    className: "whitespace-nowrap",
    render: (row) => row.phone,
  };

  if (kind === "paid") {
    return [
      dateColumn,
      fbNameColumn,
      phoneColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      {
        key: "totalPaid",
        header: "Total Paid",
        className: "text-right whitespace-nowrap",
        render: (row) => formatCurrency(row.totalPaid),
      },
      {
        key: "balance",
        header: "Balance",
        className: "text-right whitespace-nowrap",
        render: (row) => formatCurrency(row.balance),
      },
      orderTypeColumn,
      paymentStateColumn,
      actionColumn,
    ];
  }

  // Booking and Shipped share the tracking layout:
  // Date, Order Type, FB Name, Code, Item, Amount, DP, Balance, Reference, Tracking No., Status.
  if (kind === "booked" || kind === "shipped") {
    return [
      dateColumn,
      fbNameColumn,
      {
        key: "codes",
        header: "Code",
        render: (row) => <span className="break-words">{row.codes}</span>,
      },
      itemColumn,
      amountColumn,
      {
        key: "dpPaid",
        header: "DP",
        className: "text-right whitespace-nowrap",
        render: (row) => formatCurrency(row.dpPaid),
      },
      {
        key: "balance",
        header: "Balance",
        className: "text-right whitespace-nowrap",
        render: (row) => (
          <span className={row.balance > 0 ? "font-semibold text-amber-400" : undefined}>
            {formatCurrency(row.balance)}
          </span>
        ),
      },
      {
        key: "reference",
        header: "Reference",
        render: (row) => <span className="text-muted [overflow-wrap:anywhere]">{row.reference}</span>,
      },
      {
        key: "trackingNumber",
        header: "Tracking No.",
        render: (row) => (
          <TrackingNumberCell orderId={row.id} value={row.trackingNumber} editable={kind === "booked" || kind === "shipped"} />
        ),
      },
      orderTypeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  if (kind === "claimed") {
    return [
      dateColumn,
      fbNameColumn,
      phoneColumn,
      addressColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      orderTypeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  if (kind === "rto") {
    return [
      dateColumn,
      fbNameColumn,
      phoneColumn,
      addressColumn,
      itemColumn,
      qtyColumn,
      amountColumn,
      {
        key: "rtoReason",
        header: "RTO Reason",
        render: (row) => (
          <div className="break-words font-medium text-amber-400">{row.rtoReason}</div>
        ),
      },
      {
        key: "rtoNotes",
        header: "RTO Notes",
        render: (row) => (
          <div className="break-words text-muted">{row.rtoNotes}</div>
        ),
      },
      orderTypeColumn,
      statusColumn,
      actionColumn,
    ];
  }

  return [
    dateColumn,
    fbNameColumn,
    itemColumn,
    qtyColumn,
    amountColumn,
    {
      key: "dpPaid",
      header: "DP",
      className: "text-right whitespace-nowrap",
      render: (row) => formatCurrency(row.dpPaid),
    },
    {
      key: "cancellationReason",
      header: "Cancellation Reason",
      render: (row) => (
        <div className="break-words text-muted">{row.cancellationReason}</div>
      ),
    },
    orderTypeColumn,
    statusColumn,
    actionColumn,
  ];
}

const CSV_BASE_HEADERS = [
  "Date",
  "Order Type",
  "FB Name",
  "Code",
  "Phone",
  "Address",
  "Item",
  "Qty",
  "Amount",
  "Total Paid",
  "Balance",
  "DP",
  "Cancellation Reason",
  "RTO Reason",
  "RTO Notes",
  "Reference",
  "Tracking No.",
  "Status",
];

function toCsvRow(row: StatusRow): (string | number)[] {
  return [
    formatDate(row.date),
    row.orderType,
    row.fbName,
    row.codes,
    row.phone,
    row.address,
    row.itemName,
    row.qty,
    row.amount,
    row.totalPaid,
    row.balance,
    row.dpPaid,
    row.cancellationReason,
    row.rtoReason,
    row.rtoNotes,
    row.reference,
    row.trackingNumber ?? "",
    isDeliveryStatus(row.deliveryStatus) ? DELIVERY_STATUS_CONFIG[row.deliveryStatus].label : row.status,
  ];
}

/** Shared list view for the Paid, Shipped, Claimed, Cancelled, and RTO status pages. */
export async function StatusOrdersView({ kind, searchParams }: StatusOrdersViewProps) {
  const meta = META[kind];
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const sort = readSortParams<StatusSortKey>(params, SORT_KEYS, { key: "fbName", dir: "asc" });

  let orders: Order[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    orders = kind === "paid" ? await fetchPaidPageOrders({ q }) : await fetchOrders({ status: kind, q });
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = sortRows(
    (orders ?? []).map((order) => buildRow(order, kind)),
    (row) => (sort.key === "date" ? row.date : sort.key === "itemName" ? row.itemName : row.fbName),
    sort.dir
  );
  const bulkActions = BULK_ACTIONS[kind];
  const baseColumns = buildColumns(kind, meta.dateLabel, sort);
  const columns: Column<StatusRow>[] =
    bulkActions.length > 0
      ? [
          {
            key: "select",
            header: "Select",
            headerContent: <SelectAllCheckbox />,
            className: "w-10",
            render: (row) => <RowCheckbox id={row.id} label={`${row.fbName}'s order`} />,
          },
          ...baseColumns,
        ]
      : baseColumns;

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
            <SelectionProvider ids={rows.map((row) => row.id)}>
              {bulkActions.length > 0 ? <BulkActionBar actions={bulkActions} /> : null}
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
            </SelectionProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
