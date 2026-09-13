import type { Order } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

/**
 * Single source of truth for invoice templates and payment-message copy.
 * Template selection is derived from order type + the payment ledger
 * (valid order_payments records only) — never from UI text.
 */

export const BUSINESS_NAME = "DAILY PEARLS PH";

export type InvoicePaymentState = "none" | "partial" | "fully-paid";

export type InvoiceTemplate =
  | "regular-initial"
  | "regular-downpayment"
  | "regular-full"
  | "pasabuy-initial"
  | "pasabuy-downpayment"
  | "pasabuy-full"
  | "cod";

export interface InvoiceItemLine {
  name: string;
  sku: string | null;
  quantity: number;
  amount: number;
}

export interface InvoiceSummary {
  invoiceNumber: string;
  customerName: string;
  date: string;
  items: InvoiceItemLine[];
  /** Item total before discounts (sum of line amounts). */
  subtotal: number;
  discount: number;
  shippingFee: number;
  /** Net order total: subtotal − discount + shipping fee. */
  totalAmount: number;
  downpayment: number;
  balancePayments: number;
  /** Every valid ledger payment recorded for this order. */
  totalPaid: number;
  /** Total Amount − valid payments, never negative. */
  amountDue: number;
}

export type InvoiceTransactionLabel =
  | "REGULAR"
  | "CASH ON DELIVERY (COD)"
  | "PASABUY"
  | "PASABUY COD"
  | "FULLY PAID";

export type InvoiceStatusLabel =
  | "Reserved"
  | "Partial Payment"
  | "Fully Paid"
  | "COD"
  | "Pasabuy COD"
  | "Cancelled"
  | "Shipped";

/** Sum of every recorded payment row — downpayments plus balances. */
export function totalValidPayments(order: Order): number {
  return (order.payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
}

const EPSILON = 0.005;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Builds the full money/item picture of an order from real data. */
export function buildInvoiceSummary(order: Order): InvoiceSummary {
  const discount = Number(order.discount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? 0);
  const items = (order.items ?? []).map((item) => {
    const storedLineTotal = Number(item.line_total);
    const amount = Number.isFinite(storedLineTotal)
      ? storedLineTotal
      : item.quantity * Number(item.unit_price);

    return {
      name: item.product?.name ?? "Item",
      sku: item.product?.sku ?? null,
      quantity: item.quantity,
      amount: round2(amount),
    };
  });
  const subtotal = round2(
    items.reduce((sum, item) => sum + item.amount, 0)
  );
  const totalAmount = round2(subtotal + shippingFee - discount);
  const downpayment = round2(
    (order.payments ?? [])
      .filter((payment) => payment.kind === "downpayment")
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  );
  const balancePayments = round2(
    (order.payments ?? [])
      .filter((payment) => payment.kind === "balance")
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  );
  const totalPaid = round2(downpayment + balancePayments);

  return {
    invoiceNumber: order.order_number,
    customerName: order.customer?.name ?? "—",
    date: formatDate(order.created_at),
    items,
    subtotal,
    discount,
    shippingFee,
    totalAmount,
    downpayment,
    balancePayments,
    totalPaid,
    amountDue: Math.max(round2(totalAmount - totalPaid), 0),
  };
}

/**
 * Transaction wording is derived from reservation type and payment balance.
 * A Pasabuy with any remaining balance is payable on delivery, so it is shown
 * as PASABUY COD without introducing another stored reservation type.
 */
export function getInvoiceTransactionLabel(
  order: Order,
  summary = buildInvoiceSummary(order)
): InvoiceTransactionLabel {
  const type = order.reservation_type ?? "regular";
  const paymentState = detectPaymentState(summary);

  if (paymentState === "fully-paid") return "FULLY PAID";
  if (type === "cod") return "CASH ON DELIVERY (COD)";
  if (type === "pasabuy") {
    return summary.amountDue > EPSILON ? "PASABUY COD" : "PASABUY";
  }
  return "REGULAR";
}

/** Lifecycle status takes precedence, then the real payment/type state. */
export function getInvoiceStatusLabel(
  order: Order,
  summary = buildInvoiceSummary(order)
): InvoiceStatusLabel {
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "shipped") return "Shipped";

  const paymentState = detectPaymentState(summary);
  if (order.status === "paid" || paymentState === "fully-paid") {
    return "Fully Paid";
  }
  if (order.reservation_type === "cod" && summary.amountDue > EPSILON) {
    return "COD";
  }
  if (
    order.reservation_type === "pasabuy" &&
    paymentState === "partial" &&
    summary.amountDue > EPSILON
  ) {
    return "Pasabuy COD";
  }
  if (paymentState === "partial") return "Partial Payment";
  return "Reserved";
}

/**
 * Payment state comes strictly from valid payment records compared
 * against the grand total — not from status text or UI labels.
 */
export function detectPaymentState(summary: InvoiceSummary): InvoicePaymentState {
  if (summary.totalPaid >= summary.totalAmount - EPSILON) {
    return summary.totalAmount > 0 || summary.totalPaid > 0 ? "fully-paid" : "none";
  }
  if (summary.totalPaid > EPSILON) return "partial";
  return "none";
}

/** Order type + payment state → the template to render/copy. */
export function resolveInvoiceTemplate(order: Order): InvoiceTemplate {
  const type = order.reservation_type ?? "regular";
  if (type === "cod") return "cod";

  const state = detectPaymentState(buildInvoiceSummary(order));
  const prefix = type === "pasabuy" ? "pasabuy" : "regular";
  if (state === "fully-paid") return `${prefix}-full` as InvoiceTemplate;
  if (state === "partial") return `${prefix}-downpayment` as InvoiceTemplate;
  return `${prefix}-initial` as InvoiceTemplate;
}

/* ------------------------------------------------------------------ */
/* Fixed copy messages (verbatim business-approved texts).            */
/* ------------------------------------------------------------------ */

export const REGULAR_COPY_MESSAGES = {
  initial:
    "💖 PAYMENT REMINDER\n\nTo process your order, we require a minimum downpayment of ₱500 before we can ship your item. Full payment is appreciated.\n\n🚚 Free shipping is available via LBC only. If you prefer a different courier, the corresponding shipping fee will apply.\n\nThank you! We look forward to processing your order.",
  downpayment:
    "Thank you for your downpayment. We have successfully received your payment and your order is now confirmed for processing.\n\nYour remaining balance will be payable upon delivery (Cash on Delivery/COD). Once your order has been shipped, we will send you the tracking number for your reference.\n\nThank you for choosing Daily Pearls PH. We truly appreciate your trust and support! 💖",
  full: "Thank you! We have successfully received your full payment.\n\nYour order is now confirmed and will be prepared for shipment. Once your parcel has been dispatched, we will send you the tracking number for your reference.\n\nThank you for choosing Daily Pearls PH. We sincerely appreciate your trust and support, and we hope you enjoy your purchase! 💖",
} as const;

export const REGULAR_COPY_BUTTONS = [
  { id: "initial", label: "Initial Invoice", message: REGULAR_COPY_MESSAGES.initial },
  { id: "downpayment", label: "Downpayment", message: REGULAR_COPY_MESSAGES.downpayment },
  { id: "full", label: "Full Payment", message: REGULAR_COPY_MESSAGES.full },
] as const;

/* ------------------------------------------------------------------ */
/* Contextual (auto-selected) messages with real order data.          */
/* ------------------------------------------------------------------ */

function pasabuyHeader(summary: InvoiceSummary): string {
  const lines = [
    `Customer: ${summary.customerName}`,
    `Date: ${summary.date}`,
    ...summary.items.map(
      (item) =>
        `Item: ${item.name}${item.sku ? ` (${item.sku})` : ""} × ${item.quantity} — ${formatCurrency(item.amount)}`
    ),
  ];
  return lines.join("\n");
}

function buildPasabuyInitialMessage(summary: InvoiceSummary): string {
  return [
    "🛍️ PASABUY ORDER SUMMARY",
    "",
    pasabuyHeader(summary),
    "",
    `Total Amount to Pay: ${formatCurrency(summary.totalAmount)}`,
    "",
    REGULAR_COPY_MESSAGES.initial,
  ].join("\n");
}

function buildPasabuyDownpaymentMessage(summary: InvoiceSummary): string {
  return [
    "✅ DOWNPAYMENT RECEIVED",
    "",
    pasabuyHeader(summary),
    "",
    `Total Amount: ${formatCurrency(summary.totalAmount)}`,
    `Less Payment: −${formatCurrency(summary.totalPaid)}`,
    `Remaining Balance / Amount to Pay: ${formatCurrency(summary.amountDue)}`,
    "",
    REGULAR_COPY_MESSAGES.downpayment,
  ].join("\n");
}

function buildPasabuyFullyPaidMessage(summary: InvoiceSummary): string {
  return [
    "🎉 PASABUY ORDER FULLY PAID",
    "",
    pasabuyHeader(summary),
    "",
    `Total Amount: ${formatCurrency(summary.totalAmount)}`,
    `Less Payment: −${formatCurrency(summary.totalPaid)}`,
    `Remaining Balance: ${formatCurrency(0)}`,
    "",
    REGULAR_COPY_MESSAGES.full,
  ].join("\n");
}

function buildCodMessage(summary: InvoiceSummary): string {
  return [
    "📦 COD ORDER SUMMARY",
    "",
    pasabuyHeader(summary),
    "",
    `Total Amount: ${formatCurrency(summary.totalAmount)}`,
    `Less Valid Payments: −${formatCurrency(summary.totalPaid)}`,
    `Amount Due (Cash on Delivery): ${formatCurrency(summary.amountDue)}`,
    "",
    `Please prepare ${formatCurrency(summary.amountDue)} upon delivery. Once your parcel has been dispatched, we will send you the tracking number for your reference.`,
    "",
    "Thank you for choosing Daily Pearls PH. We truly appreciate your trust and support! 💖",
  ].join("\n");
}

/** Message text for a template, using real invoice/payment data. */
export function getInvoiceMessage(
  template: InvoiceTemplate,
  summary: InvoiceSummary
): string {
  switch (template) {
    case "regular-initial":
      return REGULAR_COPY_MESSAGES.initial;
    case "regular-downpayment":
      return REGULAR_COPY_MESSAGES.downpayment;
    case "regular-full":
    case "pasabuy-full":
      return template === "pasabuy-full"
        ? buildPasabuyFullyPaidMessage(summary)
        : REGULAR_COPY_MESSAGES.full;
    case "pasabuy-initial":
      return buildPasabuyInitialMessage(summary);
    case "pasabuy-downpayment":
      return buildPasabuyDownpaymentMessage(summary);
    case "cod":
      return buildCodMessage(summary);
  }
}

/** Auto-selects the correct template for an order and returns its copy message. */
export function buildOrderMessage(order: Order): string {
  return getInvoiceMessage(resolveInvoiceTemplate(order), buildInvoiceSummary(order));
}
