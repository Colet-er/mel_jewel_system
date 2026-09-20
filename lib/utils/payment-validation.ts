export const PAYMENT_METHODS = [
  "Cash",
  "GCash",
  "Maya",
  "Bank Transfer",
  "COD",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_EVIDENCE_BUCKET = "payment-evidence";
export const MAX_PAYMENT_EVIDENCE_FILES = 5;
export const MAX_PAYMENT_EVIDENCE_SIZE = 5 * 1024 * 1024;
export const PAYMENT_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface EvidenceFileLike {
  size: number;
  type: string;
}

export interface PaymentValidationInput {
  amount: number;
  method: string;
  remainingBalance: number;
  evidence: EvidenceFileLike[];
}

const EPSILON = 0.005;

export function roundPaymentAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function validatePaymentInput(
  input: PaymentValidationInput
): string | null {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return "Payment amount must be greater than or equal to zero.";
  }
  if (!isPaymentMethod(input.method)) {
    return "Select a valid payment method.";
  }
  if (input.amount > input.remainingBalance + EPSILON) {
    return "Payment amount cannot exceed the current remaining balance.";
  }
  if (input.evidence.length > MAX_PAYMENT_EVIDENCE_FILES) {
    return "Upload up to 5 evidence images only.";
  }

  for (const file of input.evidence) {
    if (!PAYMENT_EVIDENCE_TYPES.includes(file.type as (typeof PAYMENT_EVIDENCE_TYPES)[number])) {
      return "Evidence must be a JPEG, PNG, or WebP image.";
    }
    if (file.size > MAX_PAYMENT_EVIDENCE_SIZE) {
      return "Each evidence image must be 5 MB or smaller.";
    }
  }

  return null;
}

export function calculatePaymentBalance(
  reservationTotal: number,
  payments: Array<{ amount: number }>
): { totalPaid: number; remainingBalance: number } {
  const totalPaid = roundPaymentAmount(
    payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  );

  return {
    totalPaid,
    remainingBalance: Math.max(
      roundPaymentAmount(Number(reservationTotal) - totalPaid),
      0
    ),
  };
}
