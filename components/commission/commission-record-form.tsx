"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Plus, X, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createCommissionRecord } from "@/app/(dashboard)/commission/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface OrderOption {
  id: string;
  label: string;
}

export function CommissionRecordForm({ orders }: { orders: OrderOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await createCommissionRecord({
      workerName: String(form.get("workerName") ?? ""),
      date: String(form.get("date") ?? ""),
      relatedOrderId: String(form.get("relatedOrderId") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      status: String(form.get("status") ?? "unpaid") as "paid" | "unpaid",
      notes: String(form.get("notes") ?? ""),
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Could not save the commission record.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={() => setOpen(true)}
        disabled={orders.length === 0}
        title={orders.length === 0 ? "No orders are available for this period" : undefined}
        className="gap-1.5 shadow-sm shadow-primary/25"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add Record
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-md animate-in fade-in duration-150"
              onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) setOpen(false);
              }}
            >
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="commission-dialog-title"
                className="w-full max-w-lg rounded-2xl border border-white/15 bg-card/95 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl animate-in zoom-in-95 duration-150"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h2
                        id="commission-dialog-title"
                        className="text-lg font-semibold text-foreground"
                      >
                        Add Assistance Record
                      </h2>
                      <p className="text-xs text-muted">
                        Link an employee to a customer order for sales commission tracking.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    aria-label="Close"
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="commission-worker">Assisting Employee / Worker</Label>
                    <Input
                      id="commission-worker"
                      name="workerName"
                      placeholder="e.g. Maria Santos"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label htmlFor="commission-order">Customer Order</Label>
                    <select
                      id="commission-order"
                      name="relatedOrderId"
                      required
                      defaultValue=""
                      className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="" disabled>
                        Select a customer order...
                      </option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="commission-date">Date Assisted</Label>
                      <Input
                        id="commission-date"
                        name="date"
                        type="date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="commission-amount">Commission Amount (₱)</Label>
                      <Input
                        id="commission-amount"
                        name="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="commission-status">Payment Status</Label>
                    <select
                      id="commission-status"
                      name="status"
                      defaultValue="unpaid"
                      className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="unpaid">Unpaid (Pending Settlement)</option>
                      <option value="paid">Paid (Settled)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="commission-notes">Notes / Details (Optional)</Label>
                    <textarea
                      id="commission-notes"
                      name="notes"
                      maxLength={500}
                      rows={2}
                      placeholder="Any additional notes about the assistance..."
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpen(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving..." : "Save Record"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
