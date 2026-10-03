"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, Gem, LoaderCircle, Package, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import {
  ProductRowActions,
  type ProductCategory,
  type ProductItemValues,
} from "./product-actions";
import { deleteMultipleProducts } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface ProductTableRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  is_active: boolean;
  category_id: string | null;
  category?: { name: string } | null;
  created_at?: string;
}

export function isMoissanite(product: {
  name: string;
  sku?: string | null;
  category?: { name: string } | null;
}): boolean {
  const cat = (product.category?.name ?? "").toLowerCase().trim();
  const sku = (product.sku ?? "").toUpperCase().trim();
  const name = product.name.toLowerCase().trim();
  return (
    cat === "moissanite" ||
    cat.includes("moissanite") ||
    sku.startsWith("MOISS") ||
    name.includes("moissanite")
  );
}

interface ProductsTableProps {
  products: ProductTableRow[];
  categories: ProductCategory[];
  empty: ReactNode;
}

const checkboxClass =
  "h-4 w-4 rounded border-white/20 bg-card text-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer";

export function ProductsTable({ products, categories, empty }: ProductsTableProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0 && selected.size < products.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(products.map((p) => p.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [products]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
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
      title: "Delete Products",
      description: `Delete ${ids.length} selected product${ids.length === 1 ? "" : "s"}? They will be archived and hidden from new orders.`,
      confirmLabel: `Delete ${ids.length} Product${ids.length === 1 ? "" : "s"}`,
      variant: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteMultipleProducts(ids);
      if (result.ok) {
        setSelected(new Set());
        setNotice(result.message || `Successfully deleted ${ids.length} products.`);
        router.refresh();
      } else {
        setNotice(result.message || "Failed to delete products.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {notice ? (
        <div
          className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
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

      {selected.size > 0 ? (
        <div className="mx-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-pink-light">
              {selected.size} product{selected.size === 1 ? "" : "s"} selected
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

      {products.length === 0 ? (
        <div className="p-5">{empty}</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block w-full overflow-x-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  <th scope="col" className="w-10 px-4 py-3 sm:px-5">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      aria-label="Select all products"
                      checked={allSelected}
                      onChange={toggleAll}
                      className={checkboxClass}
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    SKU
                  </th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Selling Price
                  </th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Reservation Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((row) => {
                  const isSelected = selected.has(row.id);
                  const moiss = isMoissanite(row);
                  return (
                    <tr
                      key={row.id}
                      className={`h-[58px] transition-colors hover:bg-white/[0.02] ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-2 sm:px-5">
                        <input
                          type="checkbox"
                          aria-label={`Select product ${row.name}`}
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          className={checkboxClass}
                        />
                      </td>
                      <td className="px-4 py-2 sm:px-5 font-semibold text-foreground">
                        {row.name}
                      </td>
                      <td className="px-4 py-2 sm:px-5">
                        {row.sku ? (
                          <span className="font-mono text-xs text-muted">{row.sku}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 sm:px-5">
                        {moiss ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-pink-light">
                            <Gem className="h-3 w-3" aria-hidden />
                            Moissanite
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-muted">
                            <Package className="h-3 w-3" aria-hidden />
                            Product
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 sm:px-5">
                        {row.category?.name ? (
                          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted">
                            {row.category.name}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-4 py-2 sm:px-5 text-right font-semibold text-pink-light">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="px-4 py-2 sm:px-5">
                        {row.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-elevated/60 px-2.5 py-0.5 text-xs font-medium text-muted">
                            Archived / Hidden
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 sm:px-5 text-right whitespace-nowrap">
                        <ProductRowActions
                          categories={categories}
                          item={{
                            id: row.id,
                            name: row.name,
                            sku: row.sku,
                            categoryId: row.category_id,
                            price: row.price,
                            cost: row.cost,
                            isActive: row.is_active,
                          }}
                          onSuccess={(msg) => setNotice(msg)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="divide-y divide-white/[0.07] md:hidden">
            {products.map((row) => {
              const isSelected = selected.has(row.id);
              const moiss = isMoissanite(row);
              return (
                <article
                  key={row.id}
                  className={`space-y-4 px-5 py-5 transition-colors ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Select product ${row.name}`}
                        checked={isSelected}
                        onChange={() => toggleOne(row.id)}
                        className={`mt-1 ${checkboxClass}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {moiss ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-pink-light">
                              <Gem className="h-2.5 w-2.5" />
                              Moissanite
                            </span>
                          ) : null}
                          {row.sku ? (
                            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-pink-light">
                              {row.sku}
                            </p>
                          ) : null}
                        </div>
                        <h3 className="mt-1.5 text-sm font-semibold leading-5 text-foreground">
                          {row.name}
                        </h3>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-pink-light">
                      {formatCurrency(row.price)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs pl-7">
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-muted">
                      {row.category?.name || "Uncategorized"}
                    </span>
                    {row.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Active in Reservation
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-elevated/60 px-2.5 py-0.5 text-muted">
                        Archived / Hidden
                      </span>
                    )}
                  </div>
                  <div className="pl-7">
                    <ProductRowActions
                      categories={categories}
                      item={{
                        id: row.id,
                        name: row.name,
                        sku: row.sku,
                        categoryId: row.category_id,
                        price: row.price,
                        cost: row.cost,
                        isActive: row.is_active,
                      }}
                      onSuccess={(msg) => setNotice(msg)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
