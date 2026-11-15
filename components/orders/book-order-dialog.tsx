"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ClipboardList, X } from "lucide-react";
import { bookOrderWithTracking } from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * "Book Order" form: books the order and asks for the courier tracking number
 * in the same step. The tracking number can be left blank and added later on
 * the Booking page.
 */
export function BookOrderDialog({
  orderId,
  orderLabel,
  again = false,
  onClose,
  onDone,
}: {
  orderId: string;
  /** e.g. "Maria S.'s order" */
  orderLabel: string;
  again?: boolean;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await bookOrderWithTracking(orderId, trackingNumber);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone?.(result.message);
      router.refresh();
      onClose();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`book-order-title-${orderId}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 id={`book-order-title-${orderId}`} className="text-lg font-semibold text-foreground">
              {again ? "Book Again" : "Book Order"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {orderLabel.charAt(0).toUpperCase() + orderLabel.slice(1)} moves to the Booking page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <Label htmlFor={`book-tracking-${orderId}`}>Tracking No.</Label>
            <Input
              id={`book-tracking-${orderId}`}
              autoFocus
              maxLength={100}
              value={trackingNumber}
              onChange={(event) => {
                setTrackingNumber(event.target.value);
                setError(null);
              }}
              placeholder="e.g. LBC 1234 5678 9012"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted">
              Optional now. It is required before the order can be marked as shipped.
            </p>
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
              <ClipboardList className="h-4 w-4" aria-hidden />
              {isPending ? "Booking…" : trackingNumber.trim() ? "Book & Save Tracking No." : "Book Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
