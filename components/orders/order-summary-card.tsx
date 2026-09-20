"use client";

import { useState } from "react";
import Image from "next/image";
import { BadgeCheck, CreditCard, FileText, Hash, Image as LucideImage } from "lucide-react";
import type { Order } from "@/types";
import { formatDateTime, formatCurrency, formatDate, formatReservationType } from "@/lib/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShipOrderButton } from "@/components/orders/ship-order-button";
import { PaymentFormModal } from "@/components/orders/payment-form";

export function OrderSummaryCard({ order }: { order: Order }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const totalAmount = Number(order.total_amount);
  const discount = Number(order.discount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? 0);
  const grandTotal = totalAmount + shippingFee - discount;
  const totalPaid = (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(grandTotal - totalPaid, 0);

  const canShip = order.status === "reserved" || order.status === "paid";
  const canRecordPayment = order.status !== "cancelled" && balance > 0;

  return (
    <>
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          {notice}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Order Summary</CardTitle>
            <CardDescription>Invoice {order.order_number}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canShip ? <ShipOrderButton orderId={order.id} /> : null}
            {canRecordPayment ? (
              <Button size="sm" onClick={() => setShowPaymentModal(true)}>
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Record Payment
              </Button>
            ) : null}
          </div>
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

          <div className="border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted">Payments</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">Total Paid: {formatCurrency(totalPaid)}</span>
              </div>
            </div>

            {(order.payments ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-muted">
                <p className="font-medium text-foreground">No advance payment recorded</p>
                <p className="text-xs text-muted mt-0.5">
                  Remaining balance of <span className="font-semibold text-pink-light">{formatCurrency(balance)}</span> is payable upon delivery (Cash on Delivery / COD).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
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

                {balance > 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm">
                    <span className="text-xs text-muted">
                      Remaining balance: <strong className="text-warning font-semibold">{formatCurrency(balance)}</strong>
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showPaymentModal ? (
        <PaymentFormModal
          reservation={{
            id: order.id,
            invoiceNumber: order.order_number,
            customerName: order.customer?.name ?? "",
            fbName: order.customer?.fb_name ?? "",
            amount: grandTotal,
            totalPaid,
            balance,
          }}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(msg) => {
            setShowPaymentModal(false);
            setNotice(msg);
          }}
        />
      ) : null}
    </>
  );
}
