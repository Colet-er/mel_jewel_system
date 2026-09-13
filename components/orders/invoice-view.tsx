"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Printer, Image as LucideImage, CreditCard, Calendar } from "lucide-react";
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

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-8 py-1.5 text-sm">
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

export function InvoiceView({ order }: { order: Order }) {
  const summary = buildInvoiceSummary(order);
  const transactionLabel = getInvoiceTransactionLabel(order, summary);
  const statusLabel = getInvoiceStatusLabel(order, summary);
  const isDeliveryLabel =
    transactionLabel === "CASH ON DELIVERY (COD)" ||
    transactionLabel === "PASABUY COD";

  const allEvidence = order.payments?.flatMap((p) => p.evidence ?? []) ?? [];

  return (
    <div className="space-y-4">
      <div className="invoice-actions flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Print Invoice
        </Button>
      </div>

      <Card
        id="invoice-document"
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-2 border-pink-300 bg-white text-zinc-800 shadow-xl"
      >
        <div className="h-2 bg-pink-500" />

        <header className="flex flex-col gap-6 border-b-2 border-pink-200 px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-pink-400 bg-pink-50 text-lg font-black text-pink-600">
              DP
            </div>
            <div>
              <p className="text-xl font-black tracking-[0.12em] text-pink-600 sm:text-2xl">
                {BUSINESS_NAME}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                Pearls · Jewelry · Gifts
              </p>
            </div>
          </div>

          <h1 className="text-5xl font-light tracking-tight text-pink-500 sm:text-6xl">
            Invoice
          </h1>
        </header>

        <section className="grid gap-6 border-b border-pink-200 px-6 py-6 sm:grid-cols-[1fr_auto] sm:px-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-500">
              Bill To:
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-900">{summary.customerName}</p>
            {order.customer?.fb_name ? (
              <p className="mt-1 text-sm text-zinc-500">FB: {order.customer.fb_name}</p>
            ) : null}
            {order.customer?.phone ? (
              <p className="text-sm text-zinc-500">{order.customer.phone}</p>
            ) : null}
            {order.customer?.address ? (
              <p className="max-w-md text-sm text-zinc-500">{order.customer.address}</p>
            ) : null}
          </div>

          <dl className="grid grid-cols-[auto_auto] content-start gap-x-5 gap-y-2 text-sm sm:min-w-64">
            <dt className="font-semibold text-zinc-400">Invoice No.</dt>
            <dd className="text-right font-bold text-zinc-800">{summary.invoiceNumber}</dd>
            <dt className="font-semibold text-zinc-400">Date</dt>
            <dd className="text-right font-semibold text-zinc-800">{summary.date}</dd>
            <dt className="font-semibold text-zinc-400">Status</dt>
            <dd className="text-right font-bold text-pink-600">{statusLabel}</dd>
          </dl>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="bg-pink-500 text-xs font-bold uppercase tracking-[0.16em] text-white">
                <th scope="col" className="w-36 px-6 py-3 sm:px-10">Code</th>
                <th scope="col" className="px-6 py-3">Items</th>
                <th scope="col" className="w-40 px-6 py-3 text-right sm:px-10">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item, index) => (
                <tr
                  key={`${item.sku ?? item.name}-${index}`}
                  className="border-b border-pink-100"
                >
                  <td className="px-6 py-3 font-mono text-xs text-zinc-500 sm:px-10">
                    {item.sku ?? "—"}
                  </td>
                  <td className="px-6 py-3 font-semibold text-zinc-800">
                    {item.name}
                    {item.quantity > 1 ? (
                      <span className="ml-2 font-normal text-zinc-400">
                        × {item.quantity.toLocaleString("en-US")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold tabular-nums text-zinc-800 sm:px-10">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
              {summary.items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-5 text-center text-zinc-400">
                    No items recorded for this order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <section className="grid gap-8 px-6 py-7 sm:grid-cols-2 sm:px-10">
          <div className="flex min-h-36 flex-col justify-end">
            <p className="text-2xl font-black tracking-wide text-pink-500">THANK YOU 💗</p>
            <p className="mt-1 text-base italic text-zinc-500">for your purchase</p>
          </div>

          <div className="sm:ml-auto sm:w-full sm:max-w-sm">
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
            <div className="mt-3 flex items-center justify-between gap-8 rounded-lg bg-pink-500 px-4 py-3 text-white">
              <span className="text-sm font-extrabold uppercase tracking-wider">
                Amount Due
              </span>
              <span className="text-lg font-black tabular-nums">
                {formatCurrency(summary.amountDue)}
              </span>
            </div>
          </div>
        </section>

        {allEvidence.length > 0 ? (
          <section className="border-t border-pink-200 px-6 py-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">Proof of Payments</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allEvidence.map((ev) => (
                <a
                  key={ev.id}
                  href={`/api/storage/${ev.storage_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square rounded-lg border border-pink-200 overflow-hidden bg-zinc-50"
                >
                  <Image
                    src={`/api/storage/${ev.storage_path}`}
                    alt={`Payment evidence ${ev.id}`}
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <LucideImage className="h-6 w-6 text-white" aria-hidden />
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {(order.payments ?? []).length > 0 ? (
          <section className="border-t border-pink-200 px-6 py-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-pink-500" aria-hidden />
              Payment Details
            </h3>
            <div className="space-y-3">
              {(order.payments ?? []).map((payment, index) => (
                <div
                  key={payment.id ?? index}
                  className="rounded-lg border border-pink-100 bg-pink-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-zinc-700">
                        {payment.kind === "downpayment" ? "Downpayment" : "Balance Payment"}
                      </span>
                      <span className="text-zinc-400">•</span>
                      <span className="font-medium text-zinc-600">{formatCurrency(payment.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {payment.created_at ? formatDate(payment.created_at) : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-zinc-400">Payment Method: </span>
                      <span className="font-medium text-zinc-700">{payment.payment_method}</span>
                    </div>
                    {payment.reference_number ? (
                      <div>
                        <span className="text-zinc-400">Reference: </span>
                        <span className="font-mono text-zinc-700">{payment.reference_number}</span>
                      </div>
                    ) : null}
                  </div>
                  {payment.notes ? (
                    <div className="mt-2 text-sm">
                      <span className="text-zinc-400">Notes: </span>
                      <span className="text-zinc-600">{payment.notes}</span>
                    </div>
                  ) : null}
                  {payment.evidence && payment.evidence.length > 0 ? (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-zinc-500">Evidence:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {payment.evidence.map((ev) => (
                          <a
                            key={ev.id}
                            href={`/api/storage/${ev.storage_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative h-16 w-16 rounded-lg border border-pink-200 overflow-hidden bg-zinc-100"
                          >
                            <Image
                              src={`/api/storage/${ev.storage_path}`}
                              alt={`Payment evidence ${ev.id}`}
                              fill
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              sizes="64px"
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
          </section>
        ) : null}

        <footer
          className={
            isDeliveryLabel
              ? "bg-amber-400 px-6 py-4 text-center text-base font-black tracking-[0.18em] text-amber-950 sm:px-10"
              : "bg-pink-500 px-6 py-4 text-center text-base font-black tracking-[0.18em] text-white sm:px-10"
          }
        >
          {transactionLabel}
        </footer>
      </Card>

      <div className="invoice-actions mx-auto max-w-4xl">
        <CopyPanel order={order} summary={summary} />
      </div>
    </div>
  );
}
