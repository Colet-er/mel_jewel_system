"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Save, Tags, Trash2, X } from "lucide-react";
import { deleteCategory, saveCategory } from "@/app/(dashboard)/categories/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface CategoryItemValues {
  id: string;
  name: string;
  description: string | null;
  productCount?: number;
}

interface CategoryFormProps {
  initial?: CategoryItemValues;
  onClose: () => void;
}

function CategoryFormModal({ initial, onClose }: CategoryFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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

    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }

    startTransition(async () => {
      const result = await saveCategory({
        id: initial?.id,
        name: name.trim(),
        description: description.trim() || null,
      });

      if (!result.ok) {
        setError(result.message || "Failed to save category.");
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
      aria-labelledby="category-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between border-b border-white/[0.07] bg-gradient-to-r from-primary/12 via-primary/[0.04] to-transparent px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-pink-light">
              <Tags className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="category-form-title" className="text-lg font-semibold text-foreground">
                {initial ? "Edit Category" : "Add Category"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Categories help group and organize your jewelry products.
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

        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <div>
            <Label htmlFor="category-name">
              Category Name <span className="text-primary">*</span>
            </Label>
            <Input
              id="category-name"
              className="h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus={!initial}
              placeholder="e.g. South Sea Pearls, Rings, Bracelets"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="category-description">Description</Label>
            <textarea
              id="category-description"
              className="w-full rounded-lg border border-white/10 bg-background/70 px-3 py-2.5 text-sm text-foreground shadow-inner shadow-black/5 transition hover:border-white/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes or classification details for this category."
            />
          </div>

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
              disabled={isPending || !name.trim()}
            >
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {isPending ? "Saving…" : initial ? "Save Changes" : "Add Category"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Category
      </Button>
      {open ? <CategoryFormModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function CategoryRowActions({ item }: { item: CategoryItemValues }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const warning =
      item.productCount && item.productCount > 0
        ? `Delete category "${item.name}"? ${item.productCount} products are currently assigned to it.`
        : `Delete category "${item.name}"?`;

    if (!window.confirm(warning)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(item.id);
      if (!result.ok) {
        setError(result.message || "Failed to delete category.");
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
        <CategoryFormModal
          initial={item}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
