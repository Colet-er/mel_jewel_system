import Link from "next/link";
import { Eye, Gem, ReceiptText, ShoppingBag } from "lucide-react";
import { describeDbError, fetchSoldMoissanite } from "@/lib/supabase/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { MonthYearFilter } from "@/components/filters/month-year-filter";
import { SoldMoissaniteStatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Sold Moissanite" };

interface SoldMoissaniteRow {
  id: string;
  orderId: string | null;
  dateSold: string;
  invoiceNumber: string;
  sku: string;
  itemName: string;
  customerName: string;
  fbName: string;
  quantity: number;
  sellingPrice: number;
  totalAmount: number;
  status: "completed" | "pending" | "refunded";
}

function invoiceLink(row: SoldMoissaniteRow) {
  return row.orderId ? <Link href={`/orders/${row.orderId}/invoice`} className={buttonVariants({ variant: "secondary", size: "sm" })}><Eye className="h-3.5 w-3.5" aria-hidden />Invoice</Link> : null;
}

const COLUMNS: Column<SoldMoissaniteRow>[] = [
  { key: "dateSold", header: "Date", render: (row) => <span className="whitespace-nowrap text-muted">{formatDate(row.dateSold)}</span> },
  { key: "invoiceNumber", header: "Invoice", render: (row) => <div><p className="font-mono text-sm font-semibold text-pink-light">{row.invoiceNumber}</p><p className="mt-1 text-xs text-muted">{row.customerName}</p></div> },
  { key: "item", header: "Moissanite Item", render: (row) => <div className="max-w-xs"><p className="font-medium leading-5 text-foreground">{row.itemName}</p><p className="mt-1 font-mono text-xs text-muted">{row.sku}</p></div> },
  { key: "quantity", header: "Qty", className: "text-center", render: (row) => <span className="inline-flex min-w-8 justify-center rounded-lg bg-white/[0.05] px-2 py-1 font-semibold">{row.quantity.toLocaleString("en-US")}</span> },
  { key: "sellingPrice", header: "Unit Price", className: "text-right", render: (row) => formatCurrency(row.sellingPrice) },
  { key: "totalAmount", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-pink-light">{formatCurrency(row.totalAmount)}</span> },
  { key: "status", header: "Status", render: (row) => <SoldMoissaniteStatusBadge status={row.status} /> },
  { key: "invoice", header: "View", render: invoiceLink },
];

const CSV_HEADERS = ["Date Sold", "Invoice No.", "Item Number", "Item Description", "Customer", "Quantity", "Unit Price", "Total", "Status"];

export default async function SoldMoissanitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const now = new Date();
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(params.year, now.getFullYear() - 10, now.getFullYear() + 1, now.getFullYear());
  const q = typeof params.q === "string" ? params.q.trim() : "";
  let soldItems: SoldMoissaniteRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const data = await fetchSoldMoissanite({ month, year, q });
    soldItems = (data ?? []).map((item) => ({
      id: item.id,
      orderId: item.order_id ?? null,
      dateSold: item.date_sold,
      invoiceNumber: item.invoice_number,
      sku: item.sku?.sku ?? "—",
      itemName: item.sku?.item_name ?? "—",
      customerName: item.customer?.name ?? "—",
      fbName: item.customer?.fb_name ?? "—",
      quantity: item.quantity,
      sellingPrice: Number(item.selling_price),
      totalAmount: Number(item.total_amount),
      status: item.status,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = soldItems ?? [];
  const totalPieces = rows.reduce((sum, row) => sum + row.quantity, 0);
  const salesTotal = rows.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.totalAmount, 0);
  const csvRows = rows.map((row) => [formatDate(row.dateSold), row.invoiceNumber, row.sku, row.itemName, row.customerName, row.quantity, row.sellingPrice, row.totalAmount, row.status]);
  const empty = <EmptyState icon={<ShoppingBag className="h-8 w-8" aria-hidden />} title={q ? "No matching sales" : "No Moissanite sales this month"} description={q ? "Try another search or change the month." : "Fully paid Moissanite reservations will appear here automatically."} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOLD MOISSANITE"
        description="A clear sales record created automatically from fully paid reservations."
        actions={<><MonthYearFilter month={month} year={year} /><SearchInput placeholder="Search invoice, item, or customer…" /><ExportButton filename={`sold-moissanite-${year}-${String(month).padStart(2, "0")}.csv`} headers={CSV_HEADERS} rows={csvRows} /></>}
      />

      {!dbError ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-card px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-pink-light"><ReceiptText className="h-5 w-5" aria-hidden /></span><div><p className="text-xs font-medium uppercase tracking-wider text-muted">Completed sales</p><p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(salesTotal)}</p></div></div></div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] text-pink-light"><Gem className="h-5 w-5" aria-hidden /></span><div><p className="text-xs font-medium uppercase tracking-wider text-muted">Items sold</p><p className="mt-1 text-xl font-semibold text-foreground">{totalPieces.toLocaleString("en-US")}</p></div></div></div>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Sales History</CardTitle><CardDescription>{q ? `Showing results for “${q}”.` : "Use the filters above to review a different sales period."}</CardDescription></CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? <div className="px-5 pb-5"><ErrorState title={dbError.title} description={dbError.description} /></div> : (
            <>
              <div className="hidden lg:block"><DataTable columns={COLUMNS} rows={rows} rowKey={(row) => row.id} empty={empty} /></div>
              <div className="divide-y divide-white/[0.07] lg:hidden">
                {rows.length === 0 ? empty : rows.map((row) => (
                  <article key={row.id} className="space-y-4 px-5 py-5">
                    <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs font-semibold text-pink-light">{row.invoiceNumber}</p><p className="mt-1 text-xs text-muted">{formatDate(row.dateSold)}</p></div><SoldMoissaniteStatusBadge status={row.status} /></div>
                    <div><h3 className="text-sm font-semibold text-foreground">{row.itemName}</h3><p className="mt-1 font-mono text-xs text-muted">{row.sku}</p></div>
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-sm"><div><p className="text-xs text-muted">Customer</p><p className="mt-1 font-medium text-foreground">{row.customerName}</p>{row.fbName !== "—" ? <p className="mt-0.5 text-xs text-muted">Facebook: {row.fbName}</p> : null}</div><div className="text-right"><p className="text-xs text-muted">{row.quantity} × {formatCurrency(row.sellingPrice)}</p><p className="mt-1 font-semibold text-pink-light">{formatCurrency(row.totalAmount)}</p></div></div>
                    {invoiceLink(row)}
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function clampInt(raw: string | string[] | undefined, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
}
