"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
import {
  deleteReservationPayment,
  updateReservationPayment,
} from "@/app/(dashboard)/orders/reserved/actions";
import { PAYMENT_METHODS } from "@/lib/utils/payment-validation";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";

export interface EditablePayment {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
}

interface PaymentEntryActionsProps {
  payment: EditablePayment;
  /** "light" for the white invoice card, "dark" for app cards. */
  tone?: "light" | "dark";
  disabled?: boolean;
  onChanged: (message: string) => void;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-white/10 bg-background/55 px-3 text-sm text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10";

/** Edit and Delete buttons for one recorded payment. */
export function PaymentEntryActions({ payment, tone = "dark", disabled, onChanged }: PaymentEntryActionsProps) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buttonClass =
    tone === "light"
      ? "inline-flex items-center gap-1 rounded-md border border-pink-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-pink-50 disabled:opacity-50"
      : "inline-flex items-center gap-1 rounded-md border border-white/10 bg-elevated/60 px-2 py-1 text-[11px] font-semibold text-secondary transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50";

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete Payment",
      description: `Delete this ${formatCurrency(Number(payment.amount))} ${payment.payment_method} payment? The order balance will be recalculated. This cannot be undone.`,
      confirmLabel: "Delete Payment",
      variant: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteReservationPayment(payment.id);
      if (result.ok) {
        setError(null);
        onChanged(`Payment deleted. Remaining balance: ${formatCurrency(result.remainingBalance)}.`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="invoice-actions flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || isPending}
          onClick={() => {
            setError(null);
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Edit
        </button>
        <button
          type="button"
          className={cn(buttonClass, tone === "light" ? "text-red-600 hover:bg-red-50" : "text-danger hover:bg-danger/10")}
          disabled={disabled || isPending}
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          {isPending && !editing ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && !editing ? (
        <p role="alert" className={tone === "light" ? "text-[11px] text-red-600" : "text-[11px] text-danger"}>
          {error}
        </p>
      ) : null}

      {editing
        ? createPortal(
            <EditPaymentDialog
              payment={payment}
              onClose={() => setEditing(false)}
              onSaved={(message) => {
                setEditing(false);
                onChanged(message);
              }}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function EditPaymentDialog({
  payment,
  onClose,
  onSaved,
}: {
  payment: EditablePayment;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [amount, setAmount] = useState(String(Number(payment.amount)));
  const [method, setMethod] = useState(payment.payment_method);
  const [reference, setReference] = useState(payment.reference_number ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    if (!method) {
      setError("Select a payment method.");
      return;
    }

    startTransition(async () => {
      const result = await updateReservationPayment(payment.id, {
        amount: parsed,
        method,
        referenceNumber: reference,
        notes,
      });
      if (result.ok) {
        onSaved(`Payment updated. Remaining balance: ${formatCurrency(result.remainingBalance)}.`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`edit-payment-${payment.id}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 id={`edit-payment-${payment.id}`} className="text-lg font-semibold text-foreground">
            Edit Payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close edit payment"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`edit-amount-${payment.id}`}>Amount *</Label>
              <Input
                id={`edit-amount-${payment.id}`}
                type="number"
                min={0}
                step="0.01"
                required
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <Label htmlFor={`edit-method-${payment.id}`}>Payment Method *</Label>
              <select
                id={`edit-method-${payment.id}`}
                value={method}
                required
                onChange={(event) => {
                  setMethod(event.target.value);
                  setError(null);
                }}
                className={fieldClass}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor={`edit-ref-${payment.id}`}>Reference No.</Label>
            <Input
              id={`edit-ref-${payment.id}`}
              maxLength={120}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor={`edit-notes-${payment.id}`}>Notes</Label>
            <textarea
              id={`edit-notes-${payment.id}`}
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              className="w-full resize-y rounded-lg border border-white/10 bg-background/55 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/55 focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
