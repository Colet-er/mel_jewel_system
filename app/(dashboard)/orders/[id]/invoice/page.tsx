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

export const metadata = { title: "Invoice" };

function BackLink() {
  return (
    <Link
      href="/orders/reserved"
      className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to reservations
    </Link>
  );
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: Order | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    order = await fetchOrderById(id);
  } catch (error) {
    dbError = describeDbError(error);
  }

  if (!dbError && !order) notFound();

  if (dbError || !order) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Invoice"
          description="Reservation invoice."
          actions={<BackLink />}
        />
        <Card>
          <CardContent className="p-5">
            <ErrorState
              title={dbError?.title ?? "Invoice not found"}
              description={
                dbError?.description ?? "This reservation does not exist or was archived."
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="invoice-actions"
        title={`Invoice ${order.order_number}`}
        description={`Recorded ${formatDateTime(order.created_at)}.`}
        actions={<BackLink />}
      />
      <InvoiceView order={order} />
    </div>
  );
}
