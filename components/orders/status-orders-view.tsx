import Link from "next/link";
import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
import { ClaimCodeCell, OrderSourceSelect, OrderSourceTag, PasabuyCodToggle } from "@/components/orders/order-field-cells";
import { OrderDetailsPopover, type DetailsSection } from "@/components/orders/order-details-popover";
import { StatCard } from "@/components/ui/stat-card";

export type StatusViewKind = "paid" | "booked" | "shipped" | "claimed" | "cancelled" | "rto" | "branch_collect";

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
  /** Date Shipped (shipped_at). Shown on the Branch Collect page. */
  shippedDate: string | null;
  /** Raw reservation type ("regular" | "pasabuy" | "cod") for filtering and sorting. */
  reservationType: string | null;
  isCod: boolean;
  source: "live" | "chat" | null;
  pasabuyCod: boolean;
  claimCode: string | null;
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
  /** One entry per order item. The table shows one item per row. */
  items: { code: string; name: string; qty: number }[];
  /** Every item code joined, for the Details panel. */
  allCodes: string;
  /** Unique table key; one order can span several rows. */
  rowKey: string;
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
    description: "Orders received and confirmed by customers. Sort or filter by Regular / Pasabuy and date.",
    dateLabel: "Claimed Date",
    emptyTitle: "No claimed orders",
    emptyDescription: "Shipped orders marked as Claimed will appear here.",
  },
  branch_collect: {
    title: "Branch Collect",
    description: "COD orders for branch collection. Enter the claim code to release the COD money.",
    dateLabel: "Date",
    emptyTitle: "No branch collect orders",
    emptyDescription: "COD orders with the Branch Collect status will appear here.",
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
      : kind === "booked" || kind === "branch_collect"
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
    shippedDate: order.shipped_at ?? null,
    reservationType: order.reservation_type ?? null,
    isCod: order.reservation_type === "cod",
    source: order.order_source ?? null,
    pasabuyCod: Boolean(order.is_pasabuy_cod),
    claimCode: order.claim_code?.trim() || null,
    phone: order.customer?.phone || "—",
    address: order.customer?.address || "—",
    itemName: itemNameDisplay,
    qty: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    items: itemsList.map((item) => ({
      code: item.product?.sku?.trim() || "—",
      name: item.product?.name ?? "Item",
      qty: item.quantity,
    })),
    allCodes:
      itemsList
        .map((item) => item.product?.sku?.trim())
        .filter((code): code is string => Boolean(code))
        .join(", ") || "—",
    rowKey: order.id,
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
  branch_collect: "branch_collect",
};

/** Bulk actions offered (with row checkboxes) on each page. */
const BULK_ACTIONS: Record<StatusViewKind, BulkAction[]> = {
  paid: ["cancel"],
  booked: ["ship", "cancel"],
  shipped: ["claim", "cancel"],
  claimed: [],
  cancelled: [],
  rto: ["cancel"],
  branch_collect: [],
};

type StatusSortKey = "date" | "fbName" | "itemName" | "orderType";
const SORT_KEYS = ["date", "fbName", "itemName", "orderType"] as const;

/** Claimed-page filters, read from the URL (?type=&from=&to=). */
const TYPE_FILTERS = ["all", "regular", "pasabuy"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

/** Calendar day (YYYY-MM-DD) in Manila time, so date filters match what staff see. */
function manilaDay(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

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
    headerContent: sortHeader("Order Type", "orderType"),
    className: "whitespace-nowrap",
    render: (row) => row.orderType,
  };
  const fbNameColumn: Column<StatusRow> = {
    key: "fbName",
    header: "FB Name",
    headerContent: sortHeader("FB Name", "fbName"),
    className: "min-w-[11rem] whitespace-nowrap",
    render: (row) => (
      <div className="flex items-center gap-2">
        <FbNameInvoiceLink orderId={row.id} fbName={row.fbName} />
        <OrderSourceTag orderId={row.id} source={row.source} />
      </div>
    ),
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
  const codeColumn: Column<StatusRow> = {
    key: "codes",
    header: "Code",
    render: (row) => <span className="break-words">{row.codes}</span>,
  };
  const dpColumn: Column<StatusRow> = {
    key: "dpPaid",
    header: "DP",
    className: "text-right whitespace-nowrap",
    render: (row) => formatCurrency(row.dpPaid),
  };
  const balanceColumn: Column<StatusRow> = {
    key: "balance",
    header: "Balance",
    className: "text-right whitespace-nowrap",
    render: (row) => (
      <span className={row.balance > 0 ? "font-semibold text-amber-400" : undefined}>
        {formatCurrency(row.balance)}
      </span>
    ),
  };
  const trackingColumn: Column<StatusRow> = {
    key: "trackingNumber",
    header: "Tracking No.",
    render: (row) => (
      <TrackingNumberCell
        orderId={row.id}
        value={row.trackingNumber}
        editable={kind === "booked" || kind === "shipped" || kind === "branch_collect"}
      />
    ),
  };
  const shippedDateColumn: Column<StatusRow> = {
    key: "shippedDate",
    header: "Date Shipped",
    className: "whitespace-nowrap",
    render: (row) => (row.shippedDate ? formatDate(row.shippedDate) : "—"),
  };
  const claimCodeColumn: Column<StatusRow> = {
    key: "claimCode",
    header: "Claim Code",
    render: (row) => <ClaimCodeCell orderId={row.id} value={row.claimCode} isCod={row.isCod} />,
  };

  // Compact layouts (Shipped, Branch Collect) fit one screen: the money goes under the
  // Amount, and secondary fields move into a Details panel.
  const amountSummaryColumn: Column<StatusRow> = {
    key: "amount",
    header: "Amount",
    className: "text-right whitespace-nowrap",
    render: (row) => (
      <div className="flex flex-col items-end leading-tight">
        <span>{formatCurrency(row.amount)}</span>
        <span className="text-[11px] text-muted">DP {formatCurrency(row.dpPaid)}</span>
        <span className={row.balance > 0 ? "text-[11px] font-semibold text-amber-400" : "text-[11px] text-muted"}>
          Bal {formatCurrency(row.balance)}
        </span>
      </div>
    ),
  };
  const detailsColumn = (sections: (row: StatusRow) => DetailsSection[]): Column<StatusRow> => ({
    key: "details",
    header: "Details",
    className: "whitespace-nowrap",
    render: (row) => <OrderDetailsPopover title={row.fbName} sections={sections(row)} />,
  });

  if (kind === "shipped") {
    return [
      dateColumn,
      fbNameColumn,
      itemColumn,
      amountSummaryColumn,
      trackingColumn,
      statusColumn,
      detailsColumn((row) => [
        {
          heading: "Order info",
          body: (
            <>
              <DetailRow label="Code">
                <span className="break-words">{row.allCodes}</span>
              </DetailRow>
              <DetailRow label="Order type">{row.orderType}</DetailRow>
              <DetailRow label="Reference">
                <span className="text-muted [overflow-wrap:anywhere]">{row.reference}</span>
              </DetailRow>
            </>
          ),
        },
        {
          heading: "Staff settings",
          body: (
            <>
              <DetailRow label="Source">
                <OrderSourceSelect orderId={row.id} value={row.source} />
              </DetailRow>
              <DetailRow label="Pasabuy COD">
                <PasabuyCodToggle orderId={row.id} value={row.pasabuyCod} isCod={row.isCod} />
              </DetailRow>
              <DetailRow label="Claim code">
                <ClaimCodeCell orderId={row.id} value={row.claimCode} isCod={row.isCod} />
              </DetailRow>
            </>
          ),
        },
      ]),
      actionColumn,
    ];
  }

  // Booking: Date, FB Name, Code, Item, Amount, DP, Balance, Reference, Tracking No., Order Type.
  if (kind === "booked") {
    return [
      dateColumn,
      fbNameColumn,
      codeColumn,
      itemColumn,
      amountColumn,
      dpColumn,
      balanceColumn,
      trackingColumn,
      orderTypeColumn,
      actionColumn,
    ];
  }

  // Branch Collect (COD only): the claim code stays on the row; Code and Reference go in Details.
  if (kind === "branch_collect") {
    return [
      dateColumn,
      fbNameColumn,
      itemColumn,
      amountSummaryColumn,
      shippedDateColumn,
      trackingColumn,
      statusColumn,
      claimCodeColumn,
      detailsColumn((row) => [
        {
          heading: "Order info",
          body: (
            <>
              <DetailRow label="Code">
                <span className="break-words">{row.allCodes}</span>
              </DetailRow>
              <DetailRow label="Reference">
                <span className="text-muted [overflow-wrap:anywhere]">{row.reference}</span>
              </DetailRow>
            </>
          ),
        },
      ]),
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
  "Source",
  "Pasabuy COD",
  "Claim Code",
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
    row.source === "live" ? "Live" : row.source === "chat" ? "Chat" : "",
    row.isCod ? (row.pasabuyCod ? "Yes" : "No") : "",
    row.claimCode ?? "",
    isDeliveryStatus(row.deliveryStatus) ? DELIVERY_STATUS_CONFIG[row.deliveryStatus].label : row.status,
  ];
}

/** One labelled line inside an order's Details panel. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Splits an order into one table row per item. The first row keeps the order's
 * own cells; the later rows only fill the item columns (see the table below).
 */
function expandItemRows(row: StatusRow): StatusRow[] {
  if (row.items.length <= 1) return [row];
  return row.items.map((item, index) => ({
    ...row,
    rowKey: `${row.id}-${index}`,
    codes: item.code,
    itemName: item.name,
    qty: item.qty,
  }));
}

/** Totals for the Claimed summary cards: all rows, Regular, Pasabuy, and fully paid (balance 0). */
function summarizeClaimed(rows: StatusRow[]) {
  const sumOf = (list: StatusRow[]) => list.reduce((total, row) => total + row.amount, 0);
  const regular = rows.filter((row) => row.reservationType === "regular");
  const pasabuy = rows.filter((row) => row.reservationType === "pasabuy");
  return {
    count: rows.length,
    amount: sumOf(rows),
    regular: { count: regular.length, amount: sumOf(regular) },
    pasabuy: { count: pasabuy.length, amount: sumOf(pasabuy) },
    fullyPaid: rows.filter((row) => row.balance === 0).length,
  };
}

/** Shared list view for the Paid, Shipped, Claimed, Cancelled, RTO, and Branch Collect pages. */
export async function StatusOrdersView({ kind, searchParams }: StatusOrdersViewProps) {
  const meta = META[kind];
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const sort = readSortParams<StatusSortKey>(params, SORT_KEYS, { key: "fbName", dir: "asc" });

  let orders: Order[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    if (kind === "paid") {
      orders = await fetchPaidPageOrders({ q });
    } else if (kind === "branch_collect") {
      // COD orders carrying the Branch Collect label. Cancelled ones are not collected.
      const codOrders = await fetchOrders({ cod: true, deliveryStatus: "branch_collect", q });
      orders = codOrders.filter((order) => order.status !== "cancelled");
    } else {
      orders = await fetchOrders({ status: kind, q });
    }
  } catch (error) {
    dbError = describeDbError(error);
  }

  // Claimed page filters (Regular / Pasabuy, and a date range). Other pages ignore them.
  const rawType = typeof params.type === "string" ? params.type : "";
  const typeFilter: TypeFilter = (TYPE_FILTERS as readonly string[]).includes(rawType)
    ? (rawType as TypeFilter)
    : "all";
  const from = typeof params.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : "";
  const to = typeof params.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : "";

  const allRows = (orders ?? []).map((order) => buildRow(order, kind));
  const visibleRows =
    kind !== "claimed"
      ? allRows
      : allRows.filter((row) => {
          if (typeFilter !== "all" && row.reservationType !== typeFilter) return false;
          const day = manilaDay(row.date);
          if (from && day < from) return false;
          if (to && day > to) return false;
          return true;
        });

  const rows = sortRows(
    visibleRows,
    (row) =>
      sort.key === "date"
        ? row.date
        : sort.key === "itemName"
          ? row.itemName
          : sort.key === "orderType"
            ? row.orderType
            : row.fbName,
    sort.dir
  );
  const summary = kind === "claimed" ? summarizeClaimed(rows) : null;
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

  // Item columns fill every row; every other column spans the order's item rows,
  // so one order reads as one row.
  const ITEM_COLUMN_KEYS = ["codes", "itemName", "qty"];
  const tableColumns: Column<StatusRow>[] = columns.map((column) =>
    ITEM_COLUMN_KEYS.includes(column.key) ? column : { ...column, spanGroup: true }
  );
  const tableRows = rows.flatMap(expandItemRows);

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

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Claimed orders"
            value={summary.count.toLocaleString("en-US")}
            hint={`${formatCurrency(summary.amount)} total`}
          />
          <StatCard
            label="Regular"
            value={summary.regular.count.toLocaleString("en-US")}
            hint={formatCurrency(summary.regular.amount)}
          />
          <StatCard
            label="Pasabuy"
            value={summary.pasabuy.count.toLocaleString("en-US")}
            hint={formatCurrency(summary.pasabuy.amount)}
          />
          <StatCard
            label="Fully paid (balance ₱0)"
            value={summary.fullyPaid.toLocaleString("en-US")}
            variant="success"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{meta.title}</CardTitle>
          <CardDescription>{q ? `Filtered by “${q}”.` : meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {kind === "claimed" ? (
            <form method="get" className="flex flex-wrap items-end gap-3 px-5 pb-4">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <input type="hidden" name="sort" value={sort.key} />
              <input type="hidden" name="dir" value={sort.dir} />
              <div>
                <Label htmlFor="claimed-type">Order type</Label>
                <select
                  id="claimed-type"
                  name="type"
                  defaultValue={typeFilter}
                  className="h-10 rounded-lg border border-white/15 bg-background/60 px-3 text-sm text-foreground focus:border-primary"
                >
                  <option value="all">All types</option>
                  <option value="regular">Regular</option>
                  <option value="pasabuy">Pasabuy</option>
                </select>
              </div>
              <div>
                <Label htmlFor="claimed-from">From</Label>
                <Input id="claimed-from" type="date" name="from" defaultValue={from} />
              </div>
              <div>
                <Label htmlFor="claimed-to">To</Label>
                <Input id="claimed-to" type="date" name="to" defaultValue={to} />
              </div>
              <Button type="submit">Apply</Button>
              <Link
                href="/orders/claimed"
                className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted transition-colors hover:text-foreground"
              >
                Reset
              </Link>
            </form>
          ) : null}
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <SelectionProvider ids={rows.map((row) => row.id)}>
              {bulkActions.length > 0 ? <BulkActionBar actions={bulkActions} /> : null}
              <DataTable
                columns={tableColumns}
                rows={tableRows}
                rowKey={(row) => row.rowKey}
                groupKey={(row) => row.id}
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
