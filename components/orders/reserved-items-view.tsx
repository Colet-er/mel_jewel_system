"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  Ban,
  Eye,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import type { OrderStatus, ReservationType } from "@/types";
import {
  archiveSelectedOrders,
  cancelSelectedOrders,
  type BulkActionResult,
} from "@/app/(dashboard)/orders/reserved/actions";
import { formatCurrency, formatDate, formatReservationType } from "@/lib/utils/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ReservationFormModal,
  type ReservationFormValues,
} from "@/components/orders/reservation-form";
import { PaymentFormModal } from "@/components/orders/payment-form";

export interface ReservedItemRow {
  id: string;
  createdAt: string;
  invoiceNumber: string;
  fbName: string;
  customerName: string;
  phone: string | null;
  address: string | null;
  itemName: string;
  itemCode: string | null;
  category: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
  discount: number;
  shippingFee: number;
  dpPaid: number;
  totalPaid: number;
  balance: number;
  status: OrderStatus;
  type: ReservationType;
}

export interface ReservedSummary {
  totalReserve: number;
  amountToPay: number;
  totalDp: number;
  totalCod: number;
}

interface ReservedItemsTableProps {
  rows: ReservedItemRow[];
  summary: ReservedSummary;
  empty: React.ReactNode;
}

const checkboxClass =
  "h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-white/20 bg-background/60 transition-colors checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

const headerCellClass =
  "px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted xl:px-4";

function toFormValues(row: ReservedItemRow): ReservationFormValues {
  const qty = row.qty > 0 ? row.qty : 1;
  return {
    invoiceNumber: row.invoiceNumber,
    fbName: row.fbName === "—" ? "" : row.fbName,
    customerName: row.customerName === "—" ? "" : row.customerName,
    customerAddress: row.address ?? "",
    phone: row.phone ?? "",
    itemName: row.itemName === "—" ? "" : row.itemName,
    itemCode: row.itemCode ?? "",
    category: row.category ?? "",
    quantity: String(qty),
    price: String(row.unitPrice),
    discount: String(row.discount),
    shippingFee: String(row.shippingFee ?? 0),
    downpayment: String(row.dpPaid),
    downpaymentMethod: "",
    type:
      row.type === "pasabuy"
        ? "Pasabuy"
        : row.type === "cod"
          ? "COD"
          : "Regular",
  };
}

export function ReservedItemsTable({ rows, summary, empty }: ReservedItemsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [paymentRow, setPaymentRow] = useState<ReservedItemRow | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const visibleRows = useMemo(
    () => rows.map((row) => ({ row, isSelected: selected.has(row.id) })),
    [rows, selected]
  );

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
    setNotice(null);
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setNotice(null);
  }

  function runBulkAction(
    confirmMessage: string,
    action: (ids: string[]) => Promise<BulkActionResult>,
    describe: (result: BulkActionResult) => string
  ) {
    const ids = Array.from(selected);
    if (ids.length === 0 || isPending) return;
    if (!window.confirm(confirmMessage.replace("{count}", String(ids.length)))) return;

    startTransition(async () => {
      try {
        const result = await action(ids);
        setSelected(new Set());
        setNotice(describe(result));
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `Action failed: ${error.message}`
            : "Action failed. Please try again."
        );
      }
    });
  }

  function handleRecordPayment() {
    if (selected.size !== 1) {
      setNotice("Select exactly one reservation to record a payment.");
      return;
    }
    const row = rows.find((candidate) => selected.has(candidate.id));
    if (row) setPaymentRow(row);
  }

  function handleDelete() {
    runBulkAction(
      `Archive {count} reservation(s)? They will be removed from all lists but kept in the database for records.`,
      archiveSelectedOrders,
      (result) =>
        `Archived ${result.succeeded.length} reservation(s).` +
        (result.failed.length > 0
          ? ` ${result.failed.length} skipped (not permitted or already archived).`
          : "")
    );
  }



  return (
    <div>
      {paymentRow ? (
        <PaymentFormModal
          reservation={paymentRow}
          onClose={() => setPaymentRow(null)}
          onSuccess={(msg) => {
            setSelected(new Set());
            setNotice(msg);
            setPaymentRow(null);
          }}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-5 py-3">
          <span className="text-sm text-muted">
            {selected.size} selected
          </span>
          <Button size="sm" onClick={handleRecordPayment} disabled={isPending}>
            <BadgeCheck className="h-4 w-4" aria-hidden />
            Record Payment
          </Button>
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={isPending}>
            <Archive className="h-4 w-4" aria-hidden />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted hover:text-foreground"
            disabled={isPending}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="border-b border-white/[0.07] px-5 py-3 text-sm text-pink-light" role="status">
          {notice}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <>{empty}</>
      ) : (
        <div className="w-full overflow-x-auto [scrollbar-gutter:stable]">
          <table className="w-max min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.025]">
                <th scope="col" className="w-12 px-4 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label="Select all visible reservations"
                    checked={allSelected}
                    onChange={toggleAll}
                    className={checkboxClass}
                  />
                </th>
                <th scope="col" className={headerCellClass}>Reserve Date</th>
                <th scope="col" className={headerCellClass}>Invoice No.</th>
                <th scope="col" className={headerCellClass}>FB Name</th>
                <th scope="col" className={headerCellClass}>Customer Name</th>
                <th scope="col" className={headerCellClass}>Item</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Qty</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Amount</th>
                <th scope="col" className={`${headerCellClass} text-right`}>DP</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Balance</th>
                <th scope="col" className={headerCellClass}>Type</th>
                <th scope="col" className={headerCellClass}>Status</th>
                <th scope="col" className={`${headerCellClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, isSelected }) => (
                <tr
                  key={row.id}
className={`border-b border-white/[0.055] transition-colors last:border-0 hover:bg-primary/[0.045] ${
                  isSelected ? "bg-primary/5" : ""
                }`}
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Select reservation ${row.invoiceNumber}`}
                      checked={isSelected}
                      onChange={() => toggleOne(row.id)}
                      className={checkboxClass}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 xl:px-4">{formatDate(row.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 font-medium text-pink-light xl:px-4">{row.invoiceNumber}</td>
                  <td className="px-3 py-3.5 xl:px-4">{row.fbName}</td>
                  <td className="px-3 py-3.5 xl:px-4">{row.customerName}</td>
                  <td className="px-3 py-3.5 xl:px-4">{row.itemName}</td>
                  <td className="px-3 py-3.5 text-right xl:px-4">{row.qty.toLocaleString("en-US")}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right xl:px-4">{formatCurrency(row.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right xl:px-4">{formatCurrency(row.dpPaid)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right xl:px-4">{formatCurrency(row.balance)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 xl:px-4">{formatReservationType(row.type)}</td>
                  <td className="px-3 py-3.5 xl:px-4"><StatusBadge status={row.status} /></td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right xl:px-4">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link
                        href={`/orders/${row.id}/invoice`}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        View Invoice
                      </Link>
                      <ManageMenu
                        row={row}
                        disabled={isPending}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.07] bg-white/[0.02] text-sm font-semibold">
                <td colSpan={2} className="px-4 py-3 text-xs uppercase tracking-wider text-muted">
                  Total Reserve
                </td>
                <td className="px-3 py-3 xl:px-4">{summary.totalReserve.toLocaleString("en-US")}</td>
                <td colSpan={3} className="px-4 py-3 text-xs uppercase tracking-wider text-muted">
                  Amount to Pay
                </td>
                <td className="px-3 py-3 xl:px-4" />
                <td className="px-3 py-3 xl:px-4">{formatCurrency(summary.amountToPay)}</td>
                <td className="px-3 py-3 text-xs uppercase tracking-wider text-muted xl:px-4">
                  Total DP
                </td>
                <td className="px-3 py-3 xl:px-4">{formatCurrency(summary.totalDp)}</td>
                <td className="px-3 py-3 text-xs uppercase tracking-wider text-muted xl:px-4">Total COD</td>
                <td colSpan={2} className="px-3 py-3 xl:px-4">
                  {formatCurrency(summary.totalCod)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function ManageMenu({
  row,
  disabled,
}: {
  row: ReservedItemRow;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
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

  function handleEdit() {
    setOpen(false);
    setShowEditModal(true);
  }

  function handlePayment() {
    setOpen(false);
    setShowPaymentModal(true);
  }

  function handleCancel() {
    setOpen(false);
    const reason = window.prompt(
      `Cancel reservation ${row.invoiceNumber}? This cannot be undone. Optional cancellation reason:`
    );
    if (reason === null) return;
    cancelSelectedOrders([row.id], reason).catch((err) => console.error("Cancel failed:", err));
  }

  const menuContent = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Manage reservation ${row.invoiceNumber}`}
      style={{ top: menuPos?.top, left: menuPos?.left }}
      className="fixed z-50 w-44 overflow-hidden rounded-lg border border-white/10 bg-background/95 py-1 shadow-2xl backdrop-blur-xl"
    >
      {row.status === "reserved" ? (
        <>
          <button role="menuitem" type="button" className={itemClass} onClick={handleEdit}>
            <Pencil className="h-4 w-4 text-muted" aria-hidden />
            Edit
          </button>
          <button role="menuitem" type="button" className={itemClass} onClick={handlePayment}>
            <BadgeCheck className="h-4 w-4 text-muted" aria-hidden />
            Record Payment
          </button>
          <button
            role="menuitem"
            type="button"
            className={`${itemClass} text-danger`}
            onClick={handleCancel}
          >
            <Ban className="h-4 w-4" aria-hidden />
            Cancel
          </button>
        </>
      ) : null}
      <Link role="menuitem" href={`/orders/${row.id}/invoice`} className={itemClass} onClick={() => setOpen(false)}>
        <Eye className="h-4 w-4 text-muted" aria-hidden />
        View Invoice
      </Link>
    </div>
  );

  const editModal = showEditModal ? createPortal(
    <ReservationFormModal
      mode="edit"
      orderId={row.id}
      initial={toFormValues(row)}
      onClose={() => setShowEditModal(false)}
    />,
    document.body
  ) : null;

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
      onSuccess={() => {
        setShowPaymentModal(false);
      }}
    />,
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
        disabled={disabled}
        onClick={handleToggle}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
        Manage
      </Button>
      {open && menuPos ? createPortal(menuContent, document.body) : null}
      {editModal}
      {paymentModal}
    </>
  );
}
