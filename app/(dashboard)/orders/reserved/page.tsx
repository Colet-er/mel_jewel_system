import type { Order } from "@/types";
import { describeDbError, fetchOrders } from "@/lib/supabase/queries";
import { calculatePaymentBalance } from "@/lib/utils/payment-validation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { MonthYearFilter } from "@/components/filters/month-year-filter";
import { SearchInput } from "@/components/filters/search-input";
import {
  ReservedItemsTable,
  type ReservedItemRow,
  type ReservedSummary,
} from "@/components/orders/reserved-items-view";
import { AddReservationButton } from "@/components/orders/add-reservation-button";

interface ReservedItemsPageProps {
  searchParams: Promise<{ q?: string; month?: string; year?: string }>;
}

export const metadata = { title: "Reserved Items" };

function buildRow(order: Order): ReservedItemRow {
  const firstItem = (order.items ?? [])[0];
  const itemsList = (order.items ?? []).map((item) => ({
    id: item.id,
    name: item.product?.name ?? "—",
    sku: item.product?.sku ?? null,
    category: item.product?.category?.name ?? null,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
  }));

  const itemNameDisplay =
    itemsList.length === 0
      ? "—"
      : itemsList.length === 1
        ? itemsList[0].name
        : itemsList.map((it) => `${it.name} (x${it.quantity})`).join(", ");

  const reservationTotal =
    Number(order.total_amount) + Number(order.shipping_fee ?? 0);
  const paymentSummary = calculatePaymentBalance(
    reservationTotal,
    (order.payments ?? []).map((payment) => ({ amount: Number(payment.amount) }))
  );
  const downpayment = (order.payments ?? [])
    .filter((payment) => payment.kind === "downpayment")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  return {
    id: order.id,
    createdAt: order.created_at,
    invoiceNumber: order.order_number,
    fbName: order.customer?.fb_name || "—",
    customerName: order.customer?.name ?? "—",
    phone: order.customer?.phone ?? null,
    address: order.customer?.address ?? null,
    itemName: itemNameDisplay,
    items: itemsList,
    itemCode: firstItem?.product?.sku ?? null,
    category: firstItem?.product?.category?.name ?? null,
    qty: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    unitPrice: Number(firstItem?.unit_price ?? 0),
    amount: reservationTotal,
    discount: Number(order.discount ?? 0),
    shippingFee: Number(order.shipping_fee ?? 0),
    dpPaid: downpayment,
    totalPaid: paymentSummary.totalPaid,
    balance: paymentSummary.remainingBalance,
    status: order.status,
    type: order.reservation_type ?? "regular",
  };
}

function buildSummary(rows: ReservedItemRow[], amountToPay: number): ReservedSummary {
  return {
    totalReserve: rows.length,
    amountToPay,
    totalDp: rows.reduce((sum, row) => sum + row.dpPaid, 0),
    totalCod: rows.reduce((sum, row) => sum + (row.type === "cod" ? row.amount : 0), 0),
  };
}

export default async function ReservedItemsPage({ searchParams }: ReservedItemsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(params.year, now.getFullYear() - 10, now.getFullYear() + 1, now.getFullYear());
  const q = params.q?.trim() || undefined;

  let orders: Order[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    orders = await fetchOrders({ status: "reserved", month, year, q });
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = (orders ?? []).map(buildRow);
  const summary = buildSummary(
    rows,
    rows.reduce((sum, row) => sum + row.balance, 0)
  );

  const csvRows = rows.map((row) => [
    row.createdAt,
    row.invoiceNumber,
    row.fbName,
    row.customerName,
    row.itemName,
    row.qty,
    row.amount,
    row.dpPaid,
    row.balance,
    row.type,
    row.status,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RESERVED ITEMS"
        description={`Reserved orders for the selected period.`}
        actions={
          <>
            <MonthYearFilter month={month} year={year} />
            <SearchInput placeholder="Search reservations…" />
            <ExportButton
              filename={`reserved-items-${year}-${String(month).padStart(2, "0")}.csv`}
              headers={[
                "Reserve Date",
                "Invoice No.",
                "FB Name",
                "Customer Name",
                "Item",
                "Qty",
                "Amount",
                "DP",
                "Balance",
                "Type",
                "Status",
              ]}
              rows={csvRows}
            />
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Reserved Items</CardTitle>
            <CardDescription>
              {q ? `Filtered by “${q}”.` : "Select reservations to mark them as paid or archive them."}
            </CardDescription>
          </div>
          <AddReservationButton />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <ReservedItemsTable
              rows={rows}
              summary={summary}
              empty={
                <EmptyState
                  title="No reserved items"
                  description="No reservations recorded for this period. Try a different month/year or clear the search."
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
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
