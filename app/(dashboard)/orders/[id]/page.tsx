import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Order } from "@/types";
import { describeDbError, fetchOrderById } from "@/lib/supabase/queries";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { InvoiceView } from "@/components/orders/invoice-view";
import { OrderSummaryCard } from "@/components/orders/order-summary-card";

export const metadata = { title: "Order Details" };

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to dashboard
    </Link>
  );
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order: Order | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    order = await fetchOrderById(id);
  } catch (error) {
    dbError = describeDbError(error);
  }

  if (!dbError && !order) {
    notFound();
  }

  if (dbError || !order) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Order Details"
          description="Order and reservation information."
          actions={<BackLink />}
        />
        <Card>
          <CardContent className="p-5">
            <ErrorState
              title={dbError?.title ?? "Order not found"}
              description={dbError?.description ?? "This order does not exist or was removed."}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Recorded ${formatDateTime(order.created_at)}.`}
        actions={<BackLink />}
      />

      <OrderSummaryCard order={order} />

      <InvoiceView order={order} />
    </div>
  );
}