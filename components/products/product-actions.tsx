"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Package, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { deleteProduct, saveProduct } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductItemValues {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  price: number;
  cost: number;
  stock: number;
  isActive: boolean;
}

interface ProductFormProps {
  categories: ProductCategory[];
  initial?: ProductItemValues;
  onClose: () => void;
}

const selectClass =
  "h-11 w-full rounded-lg border border-white/10 bg-background/70 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition hover:border-white/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

function ProductFormModal({ categories, initial, onClose }: ProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [cost, setCost] = useState(initial?.cost ? String(initial.cost) : "");
  const [stock, setStock] = useState(initial?.stock !== undefined ? String(initial.stock) : "0");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, onClose]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError("Please enter a valid price (zero or greater).");
      return;
    }

    const numericCost = cost.trim() !== "" ? Number(cost) : 0;
    if (!Number.isFinite(numericCost) || numericCost < 0) {
      setError("Please enter a valid cost (zero or greater).");
      return;
    }

    const numericStock = stock.trim() !== "" ? Math.floor(Number(stock)) : 0;
    if (!Number.isFinite(numericStock) || numericStock < 0) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    startTransition(async () => {
      const result = await saveProduct({
        id: initial?.id,
        name: name.trim(),
        sku: sku.trim() || null,
        categoryId: categoryId || null,
        price: numericPrice,
        cost: numericCost,
        stock: numericStock,
        isActive,
      });

      if (!result.ok) {
        setError(result.message || "Failed to save product.");
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between border-b border-white/[0.07] bg-gradient-to-r from-primary/12 via-primary/[0.04] to-transparent px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-pink-light">
              <Package className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="product-form-title" className="text-lg font-semibold text-foreground">
                {initial ? "Edit Product" : "Add Product"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Define catalog items available for orders and reservations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-2 text-muted transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Product Information</h3>
              <p className="mt-1 text-xs text-muted">
                Product name and SKU will be displayed on orders and customer invoices.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="product-name">
                  Product Name <span className="text-primary">*</span>
                </Label>
                <Input
                  id="product-name"
                  className="h-11"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoFocus={!initial}
                  placeholder="e.g. South Sea Pearl Pendant 14K Gold"
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="product-sku">SKU / Item Code</Label>
                <Input
                  id="product-sku"
                  className="h-11 font-mono uppercase"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="e.g. SSP-001"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-muted">Optional unique code for quick identification.</p>
              </div>

              <div>
                <Label htmlFor="product-category">Category</Label>
                <select
                  id="product-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="border-t border-white/[0.07] pt-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Pricing & Stock</h3>
              <p className="mt-1 text-xs text-muted">Set the selling price, optional cost, and inventory count.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="product-price">
                  Selling Price <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">
                    ₱
                  </span>
                  <Input
                    id="product-price"
                    className="h-11 pl-8"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    required
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="product-cost">Cost Price</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">
                    ₱
                  </span>
                  <Input
                    id="product-cost"
                    className="h-11 pl-8"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(event) => setCost(event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="product-stock">Stock Quantity</Label>
                <Input
                  id="product-stock"
                  className="h-11"
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                id="product-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-background/80 text-primary focus:ring-primary/20"
              />
              <Label htmlFor="product-active" className="cursor-pointer text-sm font-normal text-foreground">
                Active in catalog (visible when adding orders/reservations)
              </Label>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isPending || !name.trim() || price === ""}
            >
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {isPending ? "Saving…" : initial ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddProductButton({ categories }: { categories: ProductCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Product
      </Button>
      {open ? <ProductFormModal categories={categories} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ProductRowActions({
  item,
  categories,
}: {
  item: ProductItemValues;
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete product "${item.name}"? It will be archived and hidden from new orders.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(item.id);
      if (!result.ok) {
        setError(result.message || "Failed to delete product.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex min-w-max items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isPending}
          className="text-muted hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
      {error ? <p className="mt-2 max-w-52 text-xs text-danger" role="alert">{error}</p> : null}
      {editing ? (
        <ProductFormModal
          categories={categories}
          initial={item}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
