import { describe, expect, it } from "vitest";
import type { Order } from "@/types";
import {
  REGULAR_COPY_MESSAGES,
  buildInvoiceSummary,
  buildOrderMessage,
  detectPaymentState,
  getInvoiceMessage,
  getInvoiceStatusLabel,
  getInvoiceTransactionLabel,
  resolveInvoiceTemplate,
} from "@/lib/utils/invoice";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_number: "2026-082301",
    status: "reserved",
    customer_id: null,
    total_amount: 1000,
    discount: 0,
    shipping_fee: 0,
    notes: null,
    reservation_type: "regular",
    reserved_until: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-08-23T04:00:00.000Z",
    updated_at: "2026-08-23T04:00:00.000Z",
    customer: { name: "Maria Santos" },
    items: [
      {
        id: "i1",
        quantity: 2,
        unit_price: 500,
        line_total: 1000,
        product: { name: "South Sea Pearl", cost: 300 },
      },
    ],
    payments: [],
    ...overrides,
  };
}

describe("buildInvoiceSummary", () => {
  it("computes subtotal, discount, shipping fee and amount due from real data", () => {
    const summary = buildInvoiceSummary(
      makeOrder({
        discount: 100,
        shipping_fee: 250,
        payments: [{ kind: "downpayment", amount: 500 }],
      })
    );

    expect(summary.subtotal).toBe(1000);
    expect(summary.discount).toBe(100);
    expect(summary.shippingFee).toBe(250);
    expect(summary.totalAmount).toBe(1150);
    expect(summary.totalPaid).toBe(500);
    expect(summary.amountDue).toBe(650);
  });

  it("never returns a negative amount due when overpaid", () => {
    const summary = buildInvoiceSummary(
      makeOrder({
        payments: [
          { kind: "downpayment", amount: 800 },
          { kind: "balance", amount: 400 },
        ],
      })
    );

    expect(summary.totalPaid).toBe(1200);
    expect(summary.amountDue).toBe(0);
  });
});

describe("invoice transaction and status labels", () => {
  it("detects normal COD from the stored reservation type", () => {
    const order = makeOrder({ reservation_type: "cod" });
    expect(getInvoiceTransactionLabel(order)).toBe("CASH ON DELIVERY (COD)");
    expect(getInvoiceStatusLabel(order)).toBe("COD");
  });

  it("detects Pasabuy COD from Pasabuy plus a remaining paid-on-delivery balance", () => {
    const order = makeOrder({
      reservation_type: "pasabuy",
      payments: [{ kind: "downpayment", amount: 250 }],
    });
    expect(getInvoiceTransactionLabel(order)).toBe("PASABUY COD");
    expect(getInvoiceStatusLabel(order)).toBe("Pasabuy COD");
  });

  it("labels unpaid Pasabuy with a remaining balance as Pasabuy COD", () => {
    const order = makeOrder({ reservation_type: "pasabuy", payments: [] });
    expect(getInvoiceTransactionLabel(order)).toBe("PASABUY COD");
  });

  it("gives fully paid precedence over reservation type", () => {
    const paidPasabuy = makeOrder({
      reservation_type: "pasabuy",
      payments: [{ kind: "balance", amount: 1000 }],
    });
    const paidCod = makeOrder({
      reservation_type: "cod",
      payments: [{ kind: "balance", amount: 1000 }],
    });

    expect(getInvoiceTransactionLabel(paidPasabuy)).toBe("FULLY PAID");
    expect(getInvoiceTransactionLabel(paidCod)).toBe("FULLY PAID");
  });

  it("uses lifecycle states before payment-derived labels", () => {
    expect(getInvoiceStatusLabel(makeOrder({ status: "cancelled" }))).toBe("Cancelled");
    expect(getInvoiceStatusLabel(makeOrder({ status: "shipped" }))).toBe("Shipped");
    expect(
      getInvoiceStatusLabel(
        makeOrder({
          status: "paid",
          payments: [{ kind: "balance", amount: 1000 }],
        })
      )
    ).toBe("Fully Paid");
  });
});

describe("detectPaymentState (valid payment records only)", () => {
  it("is none when no valid payments exist", () => {
    expect(detectPaymentState(buildInvoiceSummary(makeOrder()))).toBe("none");
  });

  it("is partial for a downpayment below the grand total", () => {
    const summary = buildInvoiceSummary(
      makeOrder({ payments: [{ kind: "downpayment", amount: 500 }] })
    );
    expect(detectPaymentState(summary)).toBe("partial");
  });

  it("is fully-paid once valid payments cover the total including shipping", () => {
    const summary = buildInvoiceSummary(
      makeOrder({
        shipping_fee: 100,
        payments: [
          { kind: "downpayment", amount: 500 },
          { kind: "balance", amount: 600 },
        ],
      })
    );
    expect(detectPaymentState(summary)).toBe("fully-paid");
  });
});

describe("resolveInvoiceTemplate (order type + payment state)", () => {
  it("maps regular states to initial / downpayment / full", () => {
    expect(resolveInvoiceTemplate(makeOrder())).toBe("regular-initial");
    expect(
      resolveInvoiceTemplate(makeOrder({ payments: [{ kind: "downpayment", amount: 500 }] }))
    ).toBe("regular-downpayment");
    expect(
      resolveInvoiceTemplate(
        makeOrder({ payments: [{ kind: "balance", amount: 1000 }] })
      )
    ).toBe("regular-full");
  });

  it("maps pasabuy states to pasabuy templates automatically", () => {
    expect(resolveInvoiceTemplate(makeOrder({ reservation_type: "pasabuy" }))).toBe(
      "pasabuy-initial"
    );
    expect(
      resolveInvoiceTemplate(
        makeOrder({
          reservation_type: "pasabuy",
          payments: [{ kind: "downpayment", amount: 200 }],
        })
      )
    ).toBe("pasabuy-downpayment");
    expect(
      resolveInvoiceTemplate(
        makeOrder({
          reservation_type: "pasabuy",
          status: "paid",
          payments: [{ kind: "balance", amount: 1000 }],
        })
      )
    ).toBe("pasabuy-full");
  });

  it("always resolves COD regardless of payment state", () => {
    expect(resolveInvoiceTemplate(makeOrder({ reservation_type: "cod" }))).toBe("cod");
    expect(
      resolveInvoiceTemplate(
        makeOrder({
          reservation_type: "cod",
          payments: [{ kind: "downpayment", amount: 300 }],
        })
      )
    ).toBe("cod");
  });
});

describe("copy messages", () => {
  it("keeps the fixed regular texts verbatim", () => {
    expect(REGULAR_COPY_MESSAGES.initial).toContain("💖 PAYMENT REMINDER");
    expect(REGULAR_COPY_MESSAGES.initial).toContain("minimum downpayment of ₱500");
    expect(REGULAR_COPY_MESSAGES.downpayment).toContain(
      "Thank you for your downpayment."
    );
    expect(REGULAR_COPY_MESSAGES.full).toContain(
      "Thank you! We have successfully received your full payment."
    );
  });

  it("includes real customer/item/amount data in contextual messages", () => {
    const order = makeOrder({
      reservation_type: "pasabuy",
      customer: { name: "Juan Dela Cruz" },
      payments: [{ kind: "downpayment", amount: 250 }],
    });
    const message = buildOrderMessage(order);

    expect(message).toContain("Juan Dela Cruz");
    expect(message).toContain("South Sea Pearl");
    expect(message).toContain("Remaining Balance / Amount to Pay");
    expect(message).toContain("₱750.00");
  });

  it("generates the COD amount due from real reservation/payment data", () => {
    const message = getInvoiceMessage(
      "cod",
      buildInvoiceSummary(
        makeOrder({
          reservation_type: "cod",
          shipping_fee: 150,
          payments: [{ kind: "downpayment", amount: 400 }],
        })
      )
    );

    expect(message).toContain("COD ORDER SUMMARY");
    expect(message).toContain("Amount Due (Cash on Delivery): ₱750.00");
  });
});
