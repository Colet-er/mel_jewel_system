"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LoaderCircle, MapPin, Phone, Trash2, Users, X } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import {
  AddCustomerButton,
  CustomerRowActions,
  type CustomerItemValues,
} from "./customer-actions";
import { deleteMultipleCustomers } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface CustomerTableRow extends CustomerItemValues {
  created_at: string;
}

interface CustomersTableProps {
  customers: CustomerTableRow[];
  q?: string;
}

const checkboxClass =
  "h-4 w-4 rounded border-white/20 bg-card text-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer";

export function CustomersTable({ customers, q }: CustomersTableProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = customers.length > 0 && selected.size === customers.length;
  const someSelected = selected.size > 0 && selected.size < customers.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // Clean up selected IDs if customers list updates/filters
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(customers.map((c) => c.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [customers]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(customers.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0 || isPending) return;

    const ok = await confirm({
      title: "Delete Customers",
      description: `Are you sure you want to delete ${ids.length} selected customer${ids.length === 1 ? "" : "s"}? Historical orders will be preserved, but their records will be archived.`,
      confirmLabel: `Delete ${ids.length} Customer${ids.length === 1 ? "" : "s"}`,
      variant: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteMultipleCustomers(ids);
      if (result.ok) {
        setSelected(new Set());
        setNotice(result.message || `Successfully deleted ${ids.length} customers.`);
        router.refresh();
      } else {
        setNotice(result.message || "Failed to delete customers.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Customer Directory</h2>
          <p className="mt-1 text-sm text-muted">
            {q ? `Filtered by “${q}”.` : `Showing ${customers.length} customer${customers.length === 1 ? "" : "s"} on file.`}
          </p>
        </div>
        <AddCustomerButton onSuccess={(msg) => setNotice(msg)} />
      </div>

      {selected.size > 0 ? (
        <div className="mx-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-pink-light">
              {selected.size} customer{selected.size === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={isPending}
              className="text-xs text-muted hover:text-foreground underline underline-offset-2"
            >
              Clear selection
            </button>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={handleDeleteSelected}
            disabled={isPending}
            className="shadow-sm"
          >
            {isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {isPending ? "Deleting…" : `Delete Selected (${selected.size})`}
          </Button>
        </div>
      ) : null}

      {notice ? (
        <div
          className="mx-5 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
          role="status"
        >
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400"
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {customers.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<Users className="h-8 w-8" aria-hidden />}
            title={q ? "No matching customers" : "No customers yet"}
            description={
              q
                ? "Try a different search term or clear the filter."
                : "Add your first customer to start tracking contacts and delivery addresses."
            }
          />
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-b-2xl [scrollbar-gutter:stable]">
          <table className="w-full min-w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.025]">
                <th scope="col" className="w-10 px-4 py-3 sm:px-5">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label="Select all customers"
                    checked={allSelected}
                    onChange={toggleAll}
                    className={checkboxClass}
                  />
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-4">
                  Customer
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-4">
                  Address
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-4">
                  Phone
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-4">
                  Added
                </th>
                <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-6">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const isSelected = selected.has(customer.id);
                return (
                  <tr
                    key={customer.id}
                    className={`border-b border-white/[0.055] transition-colors last:border-0 hover:bg-primary/[0.045] ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5 sm:px-5">
                      <input
                        type="checkbox"
                        aria-label={`Select customer ${customer.name}`}
                        checked={isSelected}
                        onChange={() => toggleOne(customer.id)}
                        className={checkboxClass}
                      />
                    </td>
                    <td className="px-3 py-3.5 sm:px-4">
                      <div>
                        <span className="font-semibold text-foreground">{customer.name}</span>
                        {customer.fb_name ? (
                          <p className="text-xs text-muted">
                            FB: <span className="text-foreground/80">{customer.fb_name}</span>
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 sm:px-4">
                      {customer.address ? (
                        <div className="flex max-w-xs items-start gap-1.5 text-secondary" title={customer.address}>
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="line-clamp-2">{customer.address}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-secondary sm:px-4">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <span>{customer.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-muted sm:px-4">
                      {formatDate(customer.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-6">
                      <CustomerRowActions
                        item={customer}
                        onSuccess={(msg) => setNotice(msg)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
