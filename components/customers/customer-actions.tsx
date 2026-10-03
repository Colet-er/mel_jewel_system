"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Save, Trash2, UserPlus, Users, X } from "lucide-react";
import { deleteCustomer, saveCustomer } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface CustomerItemValues {
  id: string;
  name: string;
  fb_name: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
}

interface CustomerFormProps {
  initial?: CustomerItemValues;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

function CustomerFormModal({ initial, onClose, onSuccess }: CustomerFormProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? "");
  const [fbName, setFbName] = useState(initial?.fb_name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (initial) {
      const ok = await confirm({
        title: "Save Customer Changes",
        description: `Are you sure you want to save changes to customer "${name.trim() || initial.name}"?`,
        confirmLabel: "Save Changes",
        variant: "primary",
      });
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await saveCustomer({
        id: initial?.id,
        name: name.trim(),
        fbName: fbName.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });

      if (!result.ok) {
        setError(result.message || "Failed to save customer.");
        return;
      }

      onSuccess?.(result.message || (initial ? "Customer changes saved successfully." : "Customer added successfully."));
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between border-b border-white/[0.07] bg-gradient-to-r from-primary/12 via-primary/[0.04] to-transparent px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-pink-light">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="customer-form-title" className="text-lg font-semibold text-foreground">
                {initial ? "Edit Customer" : "Add Customer"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {initial
                  ? "Update customer contact and shipping details."
                  : "Add a new customer to your store directory."}
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

        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <div>
            <Label htmlFor="customer-name">
              Customer Name <span className="text-primary">*</span>
            </Label>
            <Input
              id="customer-name"
              className="h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus={!initial}
              placeholder="e.g. Maria Santos"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customer-fb">Facebook Name / Handle</Label>
              <Input
                id="customer-fb"
                className="h-11"
                value={fbName}
                onChange={(event) => setFbName(event.target.value)}
                placeholder="e.g. Maria Santos PH"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="customer-phone">Phone Number</Label>
              <Input
                id="customer-phone"
                className="h-11"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="e.g. 0917 123 4567"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="customer-address">Delivery Address</Label>
            <textarea
              id="customer-address"
              rows={2}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. 123 Rizal St., Brgy. San Antonio, Pasig City"
              className="w-full rounded-lg border border-white/10 bg-background/70 p-3 text-sm text-foreground shadow-inner shadow-black/5 transition hover:border-white/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div>
            <Label htmlFor="customer-notes">Notes / Special Instructions</Label>
            <Input
              id="customer-notes"
              className="h-11"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes or preferences"
              autoComplete="off"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden />
                  {initial ? "Save Changes" : "Create Customer"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddCustomerButton({ onSuccess }: { onSuccess?: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Customer
      </Button>
      {open ? (
        <CustomerFormModal
          onClose={() => setOpen(false)}
          onSuccess={onSuccess}
        />
      ) : null}
    </>
  );
}

export function CustomerRowActions({
  item,
  onSuccess,
}: {
  item: CustomerItemValues;
  onSuccess?: (message: string) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete Customer",
      description: `Are you sure you want to delete customer "${item.name}"? Historical orders will be preserved, but this customer will be archived.`,
      confirmLabel: "Delete Customer",
      variant: "danger",
    });
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCustomer(item.id);
      if (!result.ok) {
        setError(result.message || "Failed to delete customer.");
        return;
      }
      onSuccess?.(result.message || `Customer "${item.name}" deleted successfully.`);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex min-w-max items-center justify-end gap-2">
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
      {error ? <p className="mt-1 text-right text-xs text-danger" role="alert">{error}</p> : null}
      {editing ? (
        <CustomerFormModal
          initial={item}
          onClose={() => setEditing(false)}
          onSuccess={onSuccess}
        />
      ) : null}
    </div>
  );
}
