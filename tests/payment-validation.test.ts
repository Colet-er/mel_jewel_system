import { describe, expect, it } from "vitest";
import {
  MAX_PAYMENT_EVIDENCE_SIZE,
  calculatePaymentBalance,
  validatePaymentInput,
} from "@/lib/utils/payment-validation";

const validInput = {
  amount: 500,
  method: "GCash",
  remainingBalance: 1000,
  evidence: [],
};

describe("validatePaymentInput", () => {
  it("requires a non-negative amount and a real payment method", () => {
    expect(validatePaymentInput({ ...validInput, amount: 0 })).toBeNull();
    expect(validatePaymentInput({ ...validInput, amount: -1 })).toBe(
      "Payment amount must be greater than or equal to zero."
    );
    expect(validatePaymentInput({ ...validInput, method: "" })).toBe(
      "Select a valid payment method."
    );
  });

  it("rejects payments above the current remaining balance", () => {
    expect(validatePaymentInput({ ...validInput, amount: 1000.01 })).toBe(
      "Payment amount cannot exceed the current remaining balance."
    );
  });

  it("accepts at most five supported evidence images", () => {
    const image = { type: "image/webp", size: 1024 };
    expect(
      validatePaymentInput({ ...validInput, evidence: Array(5).fill(image) })
    ).toBeNull();
    expect(
      validatePaymentInput({ ...validInput, evidence: Array(6).fill(image) })
    ).toBe("Upload up to 5 evidence images only.");
  });

  it("rejects unsupported or oversized evidence", () => {
    expect(
      validatePaymentInput({
        ...validInput,
        evidence: [{ type: "application/pdf", size: 1024 }],
      })
    ).toBe("Evidence must be a JPEG, PNG, or WebP image.");
    expect(
      validatePaymentInput({
        ...validInput,
        evidence: [{ type: "image/jpeg", size: MAX_PAYMENT_EVIDENCE_SIZE + 1 }],
      })
    ).toBe("Each evidence image must be 5 MB or smaller.");
  });
});

describe("calculatePaymentBalance", () => {
  it("uses all real payment rows and keeps partial balances active", () => {
    expect(
      calculatePaymentBalance(1250, [{ amount: 300 }, { amount: 200 }])
    ).toEqual({ totalPaid: 500, remainingBalance: 750 });
  });

  it("reaches zero when valid payments cover the reservation total", () => {
    expect(calculatePaymentBalance(1000, [{ amount: 1000 }])).toEqual({
      totalPaid: 1000,
      remainingBalance: 0,
    });
  });
});
