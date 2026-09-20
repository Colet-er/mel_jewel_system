"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Clock, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import {
  updateCommissionStatus,
  deleteCommissionRecord,
} from "@/app/(dashboard)/commission/actions";
import { buttonVariants } from "@/components/ui/button";

interface CommissionActionMenuProps {
  id: string;
  status: "paid" | "unpaid";
  relatedOrderId: string | null;
  customerName: string;
  workerName: string;
}

export function CommissionActionMenu({
  id,
  status,
  relatedOrderId,
  customerName,
  workerName,
}: CommissionActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
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

  function handleToggle() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 180;
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(10, rect.right - menuWidth),
      });
    }
    setOpen((prev) => !prev);
  }

  function handleToggleStatus() {
    setOpen(false);
    const nextStatus = status === "paid" ? "unpaid" : "paid";
    startTransition(async () => {
      await updateCommissionStatus(id, nextStatus);
    });
  }

  function handleDelete() {
    setOpen(false);
    if (
      !window.confirm(
        `Delete assistance record for ${workerName} (${customerName})? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      await deleteCommissionRecord(id);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {relatedOrderId ? (
        <Link
          href={`/orders/${relatedOrderId}/invoice`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Eye className="h-4 w-4" aria-hidden />
          View Invoice
        </Link>
      ) : null}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-label="Commission actions"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-elevated/60 text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {open &&
          menuPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
              className="fixed z-50 min-w-[180px] rounded-xl border border-white/10 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-white/10"
              >
                {status === "paid" ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-warning" />
                    <span>Mark as Unpaid</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span>Mark as Paid</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Record</span>
              </button>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
