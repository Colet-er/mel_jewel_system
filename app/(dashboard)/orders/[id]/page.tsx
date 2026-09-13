import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, FileText, Hash, Image as LucideImage } from "lucide-react";
import type { Order } from "@/types";
import { describeDbError, fetchOrderById } from "@/lib/supabase/queries";
import { formatDateTime, formatCurrency, formatDate, formatReservationType } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { InvoiceView } from "@/components/orders/invoice-view";
import { StatusBadge } from "@/components/ui/status-badge";
import Image from "next/image";

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

function OrderSummaryCard({ order }: { order: Order }) {
  const totalAmount = Number(order.total_amount);
  const discount = Number(order.discount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? 0);
  const grandTotal = totalAmount + shippingFee - discount;
  const totalPaid = (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(grandTotal - totalPaid, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
        <CardDescription>Invoice {order.order_number}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted">Status</p>
            <p className="mt-1"><StatusBadge status={order.status} /></p>
          </div>
          <div>
            <p className="text-sm text-muted">Type</p>
            <p className="mt-1">{formatReservationType(order.reservation_type)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Date</p>
            <p className="mt-1">{formatDateTime(order.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Grand Total</p>
            <p className="mt-1 font-semibold text-pink-light">{formatCurrency(grandTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Total Paid</p>
            <p className="mt-1 font-semibold text-success">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Balance</p>
            <p className="mt-1 font-semibold text-warning">{formatCurrency(balance)}</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-muted">Customer</p>
          <p className="mt-1 font-medium">{order.customer?.name ?? "—"}</p>
          {order.customer?.fb_name && (
            <p className="text-sm text-muted">FB: {order.customer.fb_name}</p>
          )}
          {order.customer?.phone && (
            <p className="text-sm text-muted">{order.customer.phone}</p>
          )}
          {order.customer?.address && (
            <p className="text-sm text-muted">{order.customer.address}</p>
          )}
        </div>

        {(order.items ?? []).length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm text-muted">Items</p>
            <ul className="mt-2 space-y-2 text-sm">
              {(order.items ?? []).map((item, index) => (
                <li key={`${item.id}-${index}`} className="flex justify-between">
                  <span>{item.product?.name ?? "Item"} × {item.quantity}</span>
                  <span className="font-medium">{formatCurrency(Number(item.unit_price) * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(order.payments ?? []).length > 0 && (
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Payments</p>
              <span className="text-xs text-muted">Total: {formatCurrency(totalPaid)}</span>
            </div>
            <div className="mt-3 space-y-3">
              {(order.payments ?? []).map((payment, index) => (
                <div
                  key={`${payment.id}-${index}`}
                  className="rounded-lg border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold capitalize text-foreground">
                        {payment.kind === "downpayment" ? "Downpayment" : "Balance Payment"}
                      </span>
                      <span className="text-muted">•</span>
                      <span className="font-medium text-pink-light">{formatCurrency(Number(payment.amount))}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <CreditCard className="h-3 w-3" aria-hidden />
                      {payment.created_at ? formatDate(payment.created_at) : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className="text-muted">Payment Method:</span>
                      <span className="font-medium text-foreground">{payment.payment_method}</span>
                    </div>
                    {payment.reference_number ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted" aria-hidden />
                        <span className="text-muted">Reference:</span>
                        <span className="font-mono font-medium text-foreground">{payment.reference_number}</span>
                      </div>
                    ) : null}
                  </div>
                  {payment.notes ? (
                    <div className="mt-2 text-sm">
                      <span className="text-muted">Notes: </span>
                      <span className="text-foreground">{payment.notes}</span>
                    </div>
                  ) : null}
                  {payment.evidence && payment.evidence.length > 0 ? (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-muted">Proof of Payment:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {payment.evidence.map((ev) => (
                          <a
                            key={ev.id}
                            href={`/api/storage/${ev.storage_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative h-20 w-20 rounded-lg border border-white/10 overflow-hidden bg-white/5"
                          >
                            <Image
                              src={`/api/storage/${ev.storage_path}`}
                              alt={`Payment evidence ${ev.id}`}
                              fill
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              sizes="80px"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <LucideImage className="h-5 w-5 text-white" aria-hidden />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

  const isPaid = order.status === "paid";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.order_number}`}
        description={isPaid ? "Paid order details." : `Recorded ${formatDateTime(order.created_at)}.`}
        actions={<BackLink />}
      />

      <OrderSummaryCard order={order} />

      {!isPaid && <InvoiceView order={order} />}
    </div>
  );
}