"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer, Image as LucideImage, CreditCard, Calendar, BadgeCheck } from "lucide-react";
import Image from "next/image";
import type { Order, ReservationType } from "@/types";
import {
  BUSINESS_NAME,
  REGULAR_COPY_BUTTONS,
  buildInvoiceSummary,
  getInvoiceMessage,
  getInvoiceStatusLabel,
  getInvoiceTransactionLabel,
  resolveInvoiceTemplate,
  type InvoiceSummary,
} from "@/lib/utils/invoice";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentFormModal } from "@/components/orders/payment-form";
import { updateOrderTransactionType } from "@/app/(dashboard)/orders/reserved/actions";
import { cn } from "@/lib/utils/cn";

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-xs sm:text-sm">
      <span className="font-medium text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-800">{value}</span>
    </div>
  );
}

function CopyButton({ label, message }: { label: string; message: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [message]);

  return (
    <Button variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Copy className="h-4 w-4 text-muted" aria-hidden />
      )}
      {copied ? "Copied!" : `COPY ${label}`}
    </Button>
  );
}

function CopyPanel({ order, summary }: { order: Order; summary: InvoiceSummary }) {
  const template = resolveInvoiceTemplate(order);
  const type = (order.reservation_type ?? "regular") as ReservationType;

  if (type === "regular") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {REGULAR_COPY_BUTTONS.map((button) => (
          <CopyButton key={button.id} label={button.label} message={button.message} />
        ))}
      </div>
    );
  }

  return <CopyButton label="Message" message={getInvoiceMessage(template, summary)} />;
}

export function InvoiceView({ order: initialOrder }: { order: Order }) {
  const router = useRouter();
  const [currentOrder, setCurrentOrder] = useState<Order>(initialOrder);
  const order = currentOrder;
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUpdatingType, startTypeTransition] = useTransition();

  // Keep state in sync if prop updates
  if (initialOrder.id !== currentOrder.id || initialOrder.updated_at !== currentOrder.updated_at) {
    if (initialOrder.reservation_type !== currentOrder.reservation_type && !isUpdatingType) {
      setCurrentOrder(initialOrder);
    }
  }

  const currentType = (currentOrder.reservation_type ?? "regular") as ReservationType;

  function handleTypeChange(newType: ReservationType) {
    if (newType === currentType || isUpdatingType) return;
    const updated = { ...currentOrder, reservation_type: newType };
    setCurrentOrder(updated);

    startTypeTransition(async () => {
      const res = await updateOrderTransactionType(currentOrder.id, newType);
      if (res.ok) {
        setNotice(`Transaction type updated to ${newType.toUpperCase()}.`);
        router.refresh();
      } else {
        setNotice(res.message ?? "Failed to update transaction type.");
      }
    });
  }

  const summary = buildInvoiceSummary(currentOrder);
  const transactionLabel = getInvoiceTransactionLabel(currentOrder, summary);
  const statusLabel = getInvoiceStatusLabel(currentOrder, summary);
  const isDeliveryLabel =
    transactionLabel === "COD" ||
    transactionLabel === "CASH ON DELIVERY (COD)";

  const allEvidence = currentOrder.payments?.flatMap((p) => p.evidence ?? []) ?? [];
  const canRecordPayment = currentOrder.status !== "cancelled" && summary.amountDue > 0;

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="mx-auto max-w-xl rounded-lg border border-success/30 bg-success/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-success"
        >
          {notice}
        </div>
      ) : null}

      <div className="invoice-actions mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3">
        {/* Transaction Type Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-elevated/70 p-1">
          <span className="pl-2 pr-1 text-xs font-semibold text-muted">Type:</span>
          {(
            [
              { value: "regular", label: "Regular" },
              { value: "pasabuy", label: "Pasabuy" },
              { value: "cod", label: "COD" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={isUpdatingType}
              onClick={() => handleTypeChange(t.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-bold transition-all disabled:opacity-50",
                currentType === t.value
                  ? "bg-primary text-white shadow-sm shadow-primary/25"
                  : "text-muted hover:bg-white/[0.06] hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRecordPayment ? (
            <Button size="sm" onClick={() => setShowPaymentModal(true)}>
              <BadgeCheck className="h-4 w-4" aria-hidden />
              Record Payment
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Print Invoice
          </Button>
        </div>
      </div>

      <Card
        id="invoice-document"
        className="mx-auto max-w-xl overflow-hidden rounded-xl border border-pink-300 bg-white text-zinc-800 shadow-lg"
      >
        <div className="h-1.5 bg-pink-500" />

        <header className="flex flex-col gap-4 border-b border-pink-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-pink-400 bg-pink-50 text-sm font-black text-pink-600">
              DP
            </div>
            <div>
              <p className="text-base font-black tracking-[0.1em] text-pink-600 sm:text-lg">
                {BUSINESS_NAME}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Pearls · Jewelry · Gifts
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-light tracking-tight text-pink-500 sm:text-3xl">
            Invoice
          </h1>
        </header>

        <section className="grid gap-4 border-b border-pink-200 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:px-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-pink-500">
              Bill To:
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{summary.customerName}</p>
            {order.customer?.fb_name ? (
              <p className="text-xs text-zinc-500">FB: {order.customer.fb_name}</p>
            ) : null}
            {order.customer?.phone ? (
              <p className="text-xs text-zinc-500">{order.customer.phone}</p>
            ) : null}
            {order.customer?.address ? (
              <p className="max-w-xs text-xs text-zinc-500">{order.customer.address}</p>
            ) : null}
          </div>

          <dl className="grid grid-cols-[auto_auto] content-start gap-x-4 gap-y-1 text-xs sm:min-w-48 sm:text-sm">
            <dt className="font-semibold text-zinc-400">Invoice No.</dt>
            <dd className="text-right font-bold text-zinc-800">{summary.invoiceNumber}</dd>
            <dt className="font-semibold text-zinc-400">Date</dt>
            <dd className="text-right font-medium text-zinc-800">{summary.date}</dd>
            <dt className="font-semibold text-zinc-400">Status</dt>
            <dd className="text-right font-bold text-pink-600">{statusLabel}</dd>
          </dl>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-pink-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-white">
                <th scope="col" className="w-28 px-4 py-2 sm:px-6">Code</th>
                <th scope="col" className="px-4 py-2 sm:px-6">Items</th>
                <th scope="col" className="w-28 px-4 py-2 text-right sm:px-6">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item, index) => (
                <tr
                  key={`${item.sku ?? item.name}-${index}`}
                  className="border-b border-pink-100"
                >
                  <td className="px-4 py-2 font-mono text-[11px] text-zinc-500 sm:px-6">
                    {item.sku ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-800 sm:px-6">
                    {item.name}
                    {item.quantity > 1 ? (
                      <span className="ml-1.5 font-normal text-zinc-400">
                        × {item.quantity.toLocaleString("en-US")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-zinc-800 sm:px-6">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
              {summary.items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-xs text-zinc-400">
                    No items recorded for this order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <section className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6">
          <div className="flex flex-col justify-end">
            <p className="text-base font-black tracking-wide text-pink-500">THANK YOU 💗</p>
            <p className="text-xs italic text-zinc-500">for your purchase</p>
          </div>

          <div className="sm:ml-auto sm:w-full">
            <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
            <SummaryRow
              label="Less Discount"
              value={`−${formatCurrency(summary.discount)}`}
            />
            {summary.shippingFee > 0 ? (
              <SummaryRow
                label="Shipping Fee"
                value={formatCurrency(summary.shippingFee)}
              />
            ) : null}
            <SummaryRow
              label="Less Payment / Down Payment"
              value={`−${formatCurrency(summary.totalPaid)}`}
            />
            <div className="mt-2 flex items-center justify-between gap-4 rounded-lg bg-pink-500 px-3.5 py-2 text-white">
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Amount Due
              </span>
              <span className="text-base font-black tabular-nums">
                {formatCurrency(summary.amountDue)}
              </span>
            </div>
          </div>
        </section>

        {allEvidence.length > 0 ? (
          <section className="border-t border-pink-200 px-4 py-4 sm:px-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Proof of Payments</h3>
            <div className="flex flex-wrap gap-2">
              {allEvidence.map((ev) => (
                <a
                  key={ev.id}
                  href={`/api/storage/${ev.storage_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative h-14 w-14 rounded-lg border border-pink-200 overflow-hidden bg-zinc-50"
                >
                  <Image
                    src={`/api/storage/${ev.storage_path}`}
                    alt={`Payment evidence ${ev.id}`}
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    sizes="56px"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <LucideImage className="h-4 w-4 text-white" aria-hidden />
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {(order.payments ?? []).length > 0 || canRecordPayment ? (
          <section className="border-t border-pink-200 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-pink-500" aria-hidden />
                Payment Details
              </h3>
            </div>

            {(order.payments ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-pink-200 bg-pink-50/50 p-3 text-xs text-zinc-600">
                <p className="font-semibold text-zinc-700">No advance payment recorded</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Amount due of <strong className="text-pink-600 font-semibold">{formatCurrency(summary.amountDue)}</strong> is payable upon delivery (Cash on Delivery / COD).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(order.payments ?? []).map((payment, index) => (
                  <div
                    key={payment.id ?? index}
                    className="rounded-lg border border-pink-100 bg-pink-50 p-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-700">
                          {payment.kind === "downpayment" ? "Downpayment" : "Balance Payment"}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="font-medium text-zinc-600">{formatCurrency(payment.amount)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Calendar className="h-3 w-3" aria-hidden />
                        {payment.created_at ? formatDate(payment.created_at) : "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      <div>
                        <span className="text-zinc-400">Method: </span>
                        <span className="font-medium text-zinc-700">{payment.payment_method}</span>
                      </div>
                      {payment.reference_number ? (
                        <div>
                          <span className="text-zinc-400">Ref: </span>
                          <span className="font-mono text-zinc-700">{payment.reference_number}</span>
                        </div>
                      ) : null}
                    </div>
                    {payment.notes ? (
                      <div className="mt-1 text-[11px]">
                        <span className="text-zinc-400">Notes: </span>
                        <span className="text-zinc-600">{payment.notes}</span>
                      </div>
                    ) : null}
                    {payment.evidence && payment.evidence.length > 0 ? (
                      <div className="mt-2">
                        <span className="text-[10px] font-medium text-zinc-500">Evidence:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {payment.evidence.map((ev) => (
                            <a
                              key={ev.id}
                              href={`/api/storage/${ev.storage_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative h-12 w-12 rounded-md border border-pink-200 overflow-hidden bg-zinc-100"
                            >
                              <Image
                                src={`/api/storage/${ev.storage_path}`}
                                alt={`Payment evidence ${ev.id}`}
                                fill
                                className="object-cover transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                                sizes="48px"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <LucideImage className="h-3.5 w-3.5 text-white" aria-hidden />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                {summary.amountDue > 0 ? (
                  <div className="rounded-lg border border-dashed border-pink-200 bg-pink-50/40 px-3 py-2 text-xs">
                    <span className="text-[11px] text-zinc-500">
                      Remaining balance: <strong className="text-pink-600 font-semibold">{formatCurrency(summary.amountDue)}</strong>
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <footer
          className={
            isDeliveryLabel
              ? "bg-amber-400 px-4 py-2.5 text-center text-xs sm:text-sm font-extrabold tracking-[0.16em] text-amber-950 sm:px-6"
              : "bg-pink-500 px-4 py-2.5 text-center text-xs sm:text-sm font-extrabold tracking-[0.16em] text-white sm:px-6"
          }
        >
          {transactionLabel}
        </footer>
      </Card>

      <div className="invoice-actions mx-auto max-w-xl">
        <CopyPanel order={currentOrder} summary={summary} />
      </div>

      {showPaymentModal ? (
        <PaymentFormModal
          reservation={{
            id: currentOrder.id,
            invoiceNumber: summary.invoiceNumber,
            customerName: summary.customerName,
            fbName: currentOrder.customer?.fb_name ?? "",
            amount: summary.totalAmount,
            totalPaid: summary.totalPaid,
            balance: summary.amountDue,
          }}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(msg) => {
            setShowPaymentModal(false);
            setNotice(msg);
          }}
        />
      ) : null}
    </div>
  );
}
