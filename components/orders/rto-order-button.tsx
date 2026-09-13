"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { markOrderRto } from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RtoOrderButton({
  orderId,
  invoiceNumber,
}: {
  orderId: string;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
    setReason("");
    setNotes("");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      const result = await markOrderRto(orderId, reason, notes);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        RTO
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rto-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card shadow-2xl">
            <header className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-light">
                  {invoiceNumber}
                </p>
                <h2 id="rto-dialog-title" className="mt-1 text-lg font-semibold text-foreground">
                  Mark as Return to Origin
                </h2>
                <p className="mt-1 text-sm text-muted">
                  This order will move from Shipped to the RTO list.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                aria-label="Close RTO form"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div>
                <Label htmlFor={`rto-reason-${orderId}`}>RTO Reason *</Label>
                <Input
                  id={`rto-reason-${orderId}`}
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Failed delivery, refused, incorrect address"
                />
              </div>

              <div>
                <Label htmlFor={`rto-notes-${orderId}`}>Notes</Label>
                <textarea
                  id={`rto-notes-${orderId}`}
                  maxLength={2000}
                  rows={4}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setError(null);
                  }}
                  placeholder="Optional details about the return"
                  className="w-full resize-y rounded-lg border border-white/10 bg-background/55 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/55 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-4">
                <Button variant="secondary" onClick={close} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={isPending || !reason.trim()}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  {isPending ? "Moving to RTO…" : "Confirm RTO"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
