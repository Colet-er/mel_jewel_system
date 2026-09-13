import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/utils/format";

describe("formatCurrency", () => {
  it("formats positive amounts with thousand separators", () => {
    expect(formatCurrency(1500)).toContain("1,500");
    expect(formatCurrency(1000000)).toContain("1,000,000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0");
  });

  it("formats decimal amounts", () => {
    expect(formatCurrency(1234.56)).toContain("1,234.56");
    expect(formatCurrency(0.99)).toContain("0.99");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toContain("500");
  });
});

describe("Invoice number format validation", () => {
  const invoiceNumberPattern = /^\d{4}-\d{4}\d{2}$/;

  it("matches the expected YYYY-MMDDNN format", () => {
    expect("2026-082301").toMatch(invoiceNumberPattern);
    expect("2026-123199").toMatch(invoiceNumberPattern);
    expect("2025-010101").toMatch(invoiceNumberPattern);
  });

  it("rejects invalid formats", () => {
    expect("2026-08231").not.toMatch(invoiceNumberPattern); // missing leading zero
    expect("2026-0823001").not.toMatch(invoiceNumberPattern); // too many digits
    expect("26-082301").not.toMatch(invoiceNumberPattern); // short year
    expect("2026/082301").not.toMatch(invoiceNumberPattern); // wrong separator
    expect("2026-08-2301").not.toMatch(invoiceNumberPattern); // extra separator
  });
});

describe("Amount calculation", () => {
  function calculateAmounts(quantity: number, price: number, discount: number, shippingFee: number, downpayment: number) {
    const subtotal = quantity * price;
    const netAmount = Math.round((subtotal - discount) * 100) / 100;
    const totalWithShipping = Math.round((netAmount + shippingFee) * 100) / 100;
    const balance = Math.round((totalWithShipping - downpayment) * 100) / 100;
    return { subtotal, netAmount, totalWithShipping, balance };
  }

  it("calculates correct amounts for standard reservation", () => {
    const result = calculateAmounts(2, 500, 100, 250, 500);
    expect(result.subtotal).toBe(1000);
    expect(result.netAmount).toBe(900);
    expect(result.totalWithShipping).toBe(1150);
    expect(result.balance).toBe(650);
  });

  it("calculates correct amounts with zero discount", () => {
    const result = calculateAmounts(1, 1000, 0, 0, 0);
    expect(result.subtotal).toBe(1000);
    expect(result.netAmount).toBe(1000);
    expect(result.totalWithShipping).toBe(1000);
    expect(result.balance).toBe(1000);
  });

  it("calculates correct amounts with zero downpayment", () => {
    const result = calculateAmounts(3, 200, 50, 100, 0);
    expect(result.subtotal).toBe(600);
    expect(result.netAmount).toBe(550);
    expect(result.totalWithShipping).toBe(650);
    expect(result.balance).toBe(650);
  });

  it("calculates correct amounts when downpayment covers total", () => {
    const result = calculateAmounts(1, 500, 0, 50, 550);
    expect(result.subtotal).toBe(500);
    expect(result.netAmount).toBe(500);
    expect(result.totalWithShipping).toBe(550);
    expect(result.balance).toBe(0);
  });

  it("handles COD type (downpayment typically 0)", () => {
    const result = calculateAmounts(2, 300, 0, 150, 0);
    expect(result.netAmount).toBe(600);
    expect(result.totalWithShipping).toBe(750);
    expect(result.balance).toBe(750);
  });
});