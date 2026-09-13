"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gem, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  deleteMoissaniteInventory,
  saveMoissaniteInventory,
} from "@/app/(dashboard)/moissanite/sku/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface InventoryCategory {
  id: string;
  name: string;
}

export interface InventoryItemValues {
  id: string;
  itemNumber: string;
  itemDescription: string;
  price: number;
  categoryId: string | null;
  setting: string | null;
}

interface InventoryFormProps {
  categories: InventoryCategory[];
  initial?: InventoryItemValues;
  onClose: () => void;
}

const selectClass =
  "h-11 w-full rounded-lg border border-white/10 bg-background/70 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition hover:border-white/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

function InventoryForm({ categories, initial, onClose }: InventoryFormProps) {
  const router = useRouter();
  const [itemNumber, setItemNumber] = useState(initial?.itemNumber ?? "");
  const [itemDescription, setItemDescription] = useState(initial?.itemDescription ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [setting, setSetting] = useState(initial?.setting ?? "");
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
    startTransition(async () => {
      const result = await saveMoissaniteInventory({
        id: initial?.id,
        itemNumber,
        itemDescription,
        price: Number(price),
        categoryId,
        setting,
      });
      if (!result.ok) return setError(result.message);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between border-b border-white/[0.07] bg-gradient-to-r from-primary/12 via-primary/[0.04] to-transparent px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-pink-light">
              <Gem className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="inventory-form-title" className="text-lg font-semibold text-foreground">
                {initial ? "Edit Moissanite Item" : "Add Moissanite Item"}
              </h2>
              <p className="mt-1 text-sm text-muted">These details appear when creating a reservation.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg p-2 text-muted transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Item information</h3>
              <p className="mt-1 text-xs text-muted">Use a unique item number so reservations can identify this piece correctly.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="inventory-item-number">Item Number <span className="text-primary">*</span></Label>
                <Input id="inventory-item-number" className="h-11" value={itemNumber} onChange={(event) => setItemNumber(event.target.value)} required autoFocus={!initial} placeholder="Example: MOI-001" autoComplete="off" />
                <p className="mt-1.5 text-xs text-muted">This becomes the item code on reservations.</p>
              </div>
              <div>
                <Label htmlFor="inventory-price">Selling Price <span className="text-primary">*</span></Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">₱</span>
                  <Input id="inventory-price" className="h-11 pl-8" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required placeholder="0.00" inputMode="decimal" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="inventory-description">Item Description <span className="text-primary">*</span></Label>
                <Input id="inventory-description" className="h-11" value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} required placeholder="Example: Round-cut Moissanite solitaire ring" autoComplete="off" />
              </div>
            </div>
          </section>

          <section className="border-t border-white/[0.07] pt-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Classification</h3>
              <p className="mt-1 text-xs text-muted">Optional details make the catalog easier to browse.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="inventory-category">Category <span className="text-primary">*</span></Label>
                <select id="inventory-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass} required>
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="inventory-setting">Setting</Label>
                <Input id="inventory-setting" className="h-11" value={setting} onChange={(event) => setSetting(event.target.value)} placeholder="Example: 925 Silver or 14K Gold" autoComplete="off" />
              </div>
            </div>
          </section>

          {error ? <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending || !itemNumber.trim() || !itemDescription.trim() || price === "" || !categoryId}>
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              {isPending ? "Saving…" : initial ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddInventoryButton({ categories }: { categories: InventoryCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />Add Moissanite Item</Button>
      {open ? <InventoryForm categories={categories} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function InventoryRowActions({ item, categories }: { item: InventoryItemValues; categories: InventoryCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteItem() {
    if (!window.confirm(`Delete ${item.itemNumber}? It will no longer appear in the catalog or reservation item choices.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMoissaniteInventory(item.id);
      if (!result.ok) return setError(result.message);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex min-w-max items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
        <Button size="sm" variant="ghost" onClick={deleteItem} disabled={isPending} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" aria-hidden />{isPending ? "Deleting…" : "Delete"}</Button>
      </div>
      {error ? <p className="mt-2 max-w-52 text-xs text-danger" role="alert">{error}</p> : null}
      {editing ? <InventoryForm categories={categories} initial={item} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
