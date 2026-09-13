import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { describeDbError, fetchOrders } from "@/lib/supabase/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";

export interface OrdersViewProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  status?: OrderStatus;
  showNewOrderButton?: boolean;
}

const COLUMNS: Column<Order>[] = [
  {
    key: "order_number",
    header: "Order #",
    render: (row) => <span className="font-medium text-pink-light">{row.order_number}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (row) => row.customer?.name ?? <span className="text-muted">—</span>,
  },
  {
    key: "items",
    header: "Items",
    render: (row) =>
      (row.items ?? []).reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-US"),
  },
  {
    key: "total",
    header: "Total",
    render: (row) => formatCurrency(Number(row.total_amount)),
    className: "text-right",
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "created_at",
    header: "Date",
    render: (row) => formatDate(row.created_at),
  },
];

const CSV_HEADERS = ["Order #", "Customer", "Status", "Items", "Total", "Date"];

function toCsvRow(order: Order): (string | number)[] {
  return [
    order.order_number,
    order.customer?.name ?? "",
    order.status,
    (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    Number(order.total_amount),
    formatDate(order.created_at),
  ];
}

/** Shared list view for /orders and every status sub-page. */
export async function OrdersView({
  title,
  description,
  emptyTitle,
  emptyDescription,
  searchParams,
  status,
  showNewOrderButton,
}: OrdersViewProps) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;

  let orders: Order[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    orders = await fetchOrders({ status, q });
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <SearchInput placeholder="Search orders…" />
            <ExportButton
              filename={`${title.toLowerCase().replace(/\s+/g, "-")}.csv`}
              headers={CSV_HEADERS}
              rows={(orders ?? []).map(toCsvRow)}
            />
            {showNewOrderButton ? (
              <Link href="/orders/new">
                <Button>
                  <Plus className="h-4 w-4" aria-hidden />
                  New Order
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {q ? `Filtered by “${q}”.` : description}
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
              rows={orders ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<ShoppingCart className="h-8 w-8" aria-hidden />}
                  title={emptyTitle}
                  description={emptyDescription}
                  action={
                    showNewOrderButton ? (
                      <Link href="/orders/new">
                        <Button size="sm">
                          <Plus className="h-4 w-4" aria-hidden />
                          Create your first order
                        </Button>
                      </Link>
                    ) : undefined
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
