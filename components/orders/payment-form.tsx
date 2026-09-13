"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { recordReservationPayment } from "@/app/(dashboard)/orders/reserved/actions";
import {
  MAX_PAYMENT_EVIDENCE_FILES,
  PAYMENT_EVIDENCE_TYPES,
  PAYMENT_METHODS,
  validatePaymentInput,
} from "@/lib/utils/payment-validation";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface PaymentReservationSummary {
  id: string;
  invoiceNumber: string;
  customerName: string;
  fbName: string;
  amount: number;
  totalPaid: number;
  balance: number;
}

interface PaymentFormModalProps {
  reservation: PaymentReservationSummary;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-white/10 bg-background/55 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition-all duration-200 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10";

export function PaymentFormModal({
  reservation,
  onClose,
  onSuccess,
}: PaymentFormModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEvidence(files: FileList | null) {
    const selected = files ? Array.from(files) : [];
    const validationError = validatePaymentInput({
      amount: 1,
      method: "Cash",
      remainingBalance: Number.MAX_SAFE_INTEGER,
      evidence: selected,
    });

    if (validationError) {
      setEvidence([]);
      setError(validationError);
      return;
    }
    setEvidence(selected);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const parsedAmount = Number(amount);
    const validationError = validatePaymentInput({
      amount: parsedAmount,
      method,
      remainingBalance: reservation.balance,
      evidence,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.set("amount", String(parsedAmount));
    formData.set("payment_method", method);
    formData.set("reference_number", reference.trim());
    formData.set("notes", notes.trim());
    evidence.forEach((file) => formData.append("evidence", file));

    startTransition(async () => {
      const result = await recordReservationPayment(reservation.id, formData);

      if (!result.ok) {
        if (result.paymentRecorded) {
          onSuccess(result.message);
          router.refresh();
          onClose();
          return;
        }
        setError(result.message);
        return;
      }

      const message = result.fullyPaid
        ? `Payment recorded. ${reservation.invoiceNumber} is now fully paid.`
        : `Payment recorded. Remaining balance: ${formatCurrency(result.remainingBalance)}.`;
      onSuccess(
        result.evidenceCount > 0
          ? `${message} Saved ${result.evidenceCount} evidence image(s).`
          : message
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 p-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-form-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-background shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-light">
              {reservation.invoiceNumber}
            </p>
            <h2 id="payment-form-title" className="mt-1 text-lg font-semibold text-foreground">
              Record Payment
            </h2>
            <p className="mt-1 text-sm text-muted">{reservation.customerName}</p>
            <p className="text-sm text-muted">
              Facebook / CS: {reservation.fbName === "—" ? "Not provided" : reservation.fbName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close payment form"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:grid-cols-3">
          <PaymentMetric label="Reservation total" value={reservation.amount} />
          <PaymentMetric label="Current total paid" value={reservation.totalPaid} />
          <PaymentMetric label="Current remaining balance" value={reservation.balance} emphasis />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payment-amount">Payment amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                max={reservation.balance}
                step="0.01"
                required
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="payment-method">Payment method *</Label>
              <select
                id="payment-method"
                required
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value);
                  setError(null);
                }}
                className={fieldClass}
              >
                <option value="" disabled>Select payment method</option>
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="payment-reference">Reference number</Label>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional transaction/reference number"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="payment-evidence">Evidence</Label>
              <label
                htmlFor="payment-evidence"
                className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-sm text-muted transition-all duration-200 hover:border-primary/60 hover:bg-primary/[0.04] hover:text-foreground"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {evidence.length > 0
                  ? `${evidence.length} image(s) selected`
                  : `Choose up to ${MAX_PAYMENT_EVIDENCE_FILES} receipt images`}
              </label>
              <input
                id="payment-evidence"
                name="evidence"
                type="file"
                multiple
                accept={PAYMENT_EVIDENCE_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => handleEvidence(event.target.files)}
              />
              <p className="mt-1 text-xs text-muted">
                Optional. JPEG, PNG, or WebP; maximum 5 MB each.
              </p>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="payment-notes">Payment notes</Label>
              <textarea
                id="payment-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
                className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-background/55 px-3 py-2 text-sm text-foreground shadow-inner shadow-black/5 transition-all duration-200 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !method || !amount || reservation.balance <= 0}
            >
              {isPending ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-background px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${emphasis ? "text-pink-light" : "text-foreground"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
