"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { setOrderTrackingNumber } from "@/app/(dashboard)/orders/reserved/actions";

/**
 * Tracking number shown in a table cell. When editable, staff can type or
 * correct it inline; saving refreshes the table so "Mark as Shipped" unlocks.
 */
export function TrackingNumberCell({
  orderId,
  value,
  editable,
}: {
  orderId: string;
  value: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editable) {
    return value ? <span className="[overflow-wrap:anywhere]">{value}</span> : <span className="text-muted">—</span>;
  }

  function save() {
    if (isPending) return;
    startTransition(async () => {
      const result = await setOrderTrackingNumber(orderId, draft);
      if (result.ok) {
        setError(null);
        setEditing(false);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className="group inline-flex max-w-full items-center gap-1.5 text-left"
        title={value ? "Edit tracking number" : "Add tracking number"}
      >
        {value ? (
          <span className="text-foreground [overflow-wrap:anywhere]">{value}</span>
        ) : (
          <span className="whitespace-nowrap rounded-md border border-dashed border-amber-400/50 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            + Add tracking no.
          </span>
        )}
        {value ? <Pencil className="h-3 w-3 shrink-0 text-muted group-hover:text-foreground" aria-hidden /> : null}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          maxLength={100}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            } else if (event.key === "Escape") {
              setEditing(false);
            }
          }}
          disabled={isPending}
          placeholder="Tracking no."
          aria-label="Tracking number"
          className="h-8 w-full min-w-[7rem] rounded-md border border-white/15 bg-background/60 px-2 text-xs text-foreground focus:border-primary"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          aria-label="Save tracking number"
          className="rounded-md p-1.5 text-success hover:bg-success/10 disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          aria-label="Cancel"
          className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error ? (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
