"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Order } from "@/types";
import { loadInvoiceOrder } from "@/app/(dashboard)/orders/invoice-actions";
import { InvoiceView } from "@/components/orders/invoice-view";
import { cn } from "@/lib/utils/cn";

interface FbNameInvoiceLinkProps {
  orderId: string;
  fbName: string;
  className?: string;
}

/**
 * Renders the customer's FB name as a button. Clicking it opens the order's
 * invoice in a floating modal instead of navigating to a separate page.
 */
export function FbNameInvoiceLink({ orderId, fbName, className }: FbNameInvoiceLinkProps) {
  const [open, setOpen] = useState(false);
  const label = fbName && fbName.trim() !== "" ? fbName : "—";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`View invoice for ${label}`}
        className={cn(
          "max-w-full break-words text-left font-medium text-pink-light underline-offset-2 transition-colors hover:text-primary hover:underline",
          className
        )}
      >
        {label}
      </button>
      {open ? <InvoiceModal orderId={orderId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function InvoiceModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof loadInvoiceOrder>>) => {
    if (result.ok) {
      setOrder(result.order);
      setError(null);
    } else {
      setError(result.message);
    }
  }, []);

  /** Re-fetches after a payment or type change inside the invoice. */
  const reload = useCallback(() => {
    loadInvoiceOrder(orderId).then(applyResult);
  }, [orderId, applyResult]);

  useEffect(() => {
    let active = true;
    loadInvoiceOrder(orderId).then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [orderId, applyResult]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Let nested dialogs (payment form, confirm) handle Escape themselves.
      if (event.key === "Escape" && document.querySelectorAll('[aria-modal="true"]').length <= 1) {
        onClose();
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="invoice-modal fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-3 py-6 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="invoice-modal-panel relative w-full max-w-3xl rounded-2xl border border-white/10 bg-background p-3 pt-12 shadow-2xl sm:p-5 sm:pt-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close invoice"
          className="invoice-actions absolute right-3 top-3 rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {error ? (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : order ? (
          <InvoiceView order={order} onOrderChanged={reload} />
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            Loading invoice…
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
