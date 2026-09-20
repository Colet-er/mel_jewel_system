"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  MoreHorizontal,
  RotateCcw,
  Truck,
  X,
} from "lucide-react";
import type { OrderStatus } from "@/types";
import {
  cancelSelectedOrders,
  claimSelectedOrders,
  markOrderRto,
  shipSelectedOrders,
} from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PaymentFormModal } from "@/components/orders/payment-form";

export type StatusViewKind = "paid" | "shipped" | "claimed" | "cancelled" | "rto";

export interface StatusManageRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  fbName: string;
  amount: number;
  totalPaid: number;
  balance: number;
  status: OrderStatus;
}

interface StatusManageMenuProps {
  row: StatusManageRow;
  kind: StatusViewKind;
  disabled?: boolean;
}

export function StatusManageMenu({ row, kind, disabled }: StatusManageMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRtoModal, setShowRtoModal] = useState(false);
  const [rtoReason, setRtoReason] = useState("");
  const [rtoNotes, setRtoNotes] = useState("");
  const [rtoError, setRtoError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.05] hover:text-foreground";

  function handleToggle() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.left - 180 + rect.width,
      });
    }
    setOpen((current) => !current);
  }

  function handleShip() {
    setOpen(false);
    if (!window.confirm(`Mark order ${row.invoiceNumber} as shipped?`)) return;
    startTransition(async () => {
      try {
        await shipSelectedOrders([row.id]);
      } catch (err) {
        console.error("Ship failed:", err);
      }
    });
  }

  function handleClaim() {
    setOpen(false);
    if (!window.confirm(`Mark order ${row.invoiceNumber} as claimed?`)) return;
    startTransition(async () => {
      try {
        await claimSelectedOrders([row.id]);
      } catch (err) {
        console.error("Claim failed:", err);
      }
    });
  }

  function handleReship() {
    setOpen(false);
    if (!window.confirm(`Re-ship order ${row.invoiceNumber} back to Shipped?`)) return;
    startTransition(async () => {
      try {
        await shipSelectedOrders([row.id]);
      } catch (err) {
        console.error("Re-ship failed:", err);
      }
    });
  }

  function handleRtoSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      const result = await markOrderRto(row.id, rtoReason, rtoNotes);
      if (!result.ok) {
        setRtoError(result.message);
        return;
      }
      setShowRtoModal(false);
      setRtoReason("");
      setRtoNotes("");
      setRtoError(null);
    });
  }

  function handleCancel() {
    setOpen(false);
    const reason = window.prompt(
      `Cancel order ${row.invoiceNumber}? This cannot be undone. Optional cancellation reason:`
    );
    if (reason === null) return;
    startTransition(async () => {
      try {
        await cancelSelectedOrders([row.id], reason);
      } catch (err) {
        console.error("Cancel failed:", err);
      }
    });
  }

  const menuContent = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Manage order ${row.invoiceNumber}`}
      style={{ top: menuPos?.top, left: menuPos?.left }}
      className="fixed z-50 w-48 overflow-hidden rounded-lg border border-white/10 bg-background/95 py-1 shadow-2xl backdrop-blur-xl"
    >
      <Link
        role="menuitem"
        href={`/orders/${row.id}`}
        className={itemClass}
        onClick={() => setOpen(false)}
      >
        <Eye className="h-4 w-4 text-muted" aria-hidden />
        View Order
      </Link>

      <Link
        role="menuitem"
        href={`/orders/${row.id}/invoice`}
        className={itemClass}
        onClick={() => setOpen(false)}
      >
        <FileText className="h-4 w-4 text-muted" aria-hidden />
        View Invoice
      </Link>

      {/* Status Specific Action Buttons inside Manage Menu */}
      {kind === "paid" ? (
        <>
          <button role="menuitem" type="button" className={itemClass} onClick={handleShip}>
            <Truck className="h-4 w-4 text-muted" aria-hidden />
            Ship Order
          </button>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setShowRtoModal(true);
            }}
          >
            <RotateCcw className="h-4 w-4 text-muted" aria-hidden />
            Move to RTO
          </button>
        </>
      ) : null}

      {kind === "shipped" ? (
        <>
          <button role="menuitem" type="button" className={itemClass} onClick={handleClaim}>
            <CheckCircle2 className="h-4 w-4 text-muted" aria-hidden />
            Claim Order
          </button>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setShowRtoModal(true);
            }}
          >
            <RotateCcw className="h-4 w-4 text-muted" aria-hidden />
            Move to RTO
          </button>
        </>
      ) : null}

      {kind === "rto" ? (
        <button role="menuitem" type="button" className={itemClass} onClick={handleReship}>
          <Truck className="h-4 w-4 text-muted" aria-hidden />
          Re-ship Order
        </button>
      ) : null}

      {row.status !== "cancelled" && row.balance > 0 ? (
        <button
          role="menuitem"
          type="button"
          className={itemClass}
          onClick={() => {
            setOpen(false);
            setShowPaymentModal(true);
          }}
        >
          <BadgeCheck className="h-4 w-4 text-muted" aria-hidden />
          Record Payment
        </button>
      ) : null}

      {row.status !== "cancelled" && row.status !== "claimed" ? (
        <button
          role="menuitem"
          type="button"
          className={`${itemClass} text-danger`}
          onClick={handleCancel}
        >
          <Ban className="h-4 w-4" aria-hidden />
          Cancel Order
        </button>
      ) : null}
    </div>
  );

  const paymentModal = showPaymentModal ? createPortal(
    <PaymentFormModal
      reservation={{
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        customerName: row.customerName,
        fbName: row.fbName,
        amount: row.amount,
        totalPaid: row.totalPaid,
        balance: row.balance,
      }}
      onClose={() => setShowPaymentModal(false)}
      onSuccess={() => setShowPaymentModal(false)}
    />,
    document.body
  ) : null;

  const rtoModal = showRtoModal ? createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-rto-dialog-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-light">
              {row.invoiceNumber}
            </p>
            <h2 id="status-rto-dialog-title" className="mt-1 text-lg font-semibold text-foreground">
              Mark as Return to Origin
            </h2>
            <p className="mt-1 text-sm text-muted">
              This order will move to the RTO list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRtoModal(false)}
            disabled={isPending}
            aria-label="Close RTO form"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleRtoSubmit} className="space-y-4 px-5 py-5">
          <div>
            <Label htmlFor={`status-rto-reason-${row.id}`}>RTO Reason *</Label>
            <Input
              id={`status-rto-reason-${row.id}`}
              required
              maxLength={500}
              value={rtoReason}
              onChange={(event) => {
                setRtoReason(event.target.value);
                setRtoError(null);
              }}
              placeholder="e.g. Failed delivery, refused, incorrect address"
            />
          </div>

          <div>
            <Label htmlFor={`status-rto-notes-${row.id}`}>Notes</Label>
            <textarea
              id={`status-rto-notes-${row.id}`}
              maxLength={2000}
              rows={4}
              value={rtoNotes}
              onChange={(event) => {
                setRtoNotes(event.target.value);
                setRtoError(null);
              }}
              placeholder="Optional details about the return"
              className="w-full resize-y rounded-lg border border-white/10 bg-background/55 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/55 focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>

          {rtoError ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {rtoError}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowRtoModal(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isPending || !rtoReason.trim()}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {isPending ? "Moving to RTO…" : "Confirm RTO"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || isPending}
        onClick={handleToggle}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
        Manage
      </Button>
      {open && menuPos ? createPortal(menuContent, document.body) : null}
      {paymentModal}
      {rtoModal}
    </>
  );
}
