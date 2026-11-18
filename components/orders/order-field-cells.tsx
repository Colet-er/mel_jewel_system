"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import {
  setOrderClaimCode,

  setOrderSource,
} from "@/app/(dashboard)/orders/reserved/field-actions";
import { OrderSourceBadge } from "@/components/orders/order-source-badge";

/** Live / Chat selector for the order source. */
export function OrderSourceSelect({
  orderId,
  value,
}: {
  orderId: string;
  value: "live" | "chat" | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      const result = await setOrderSource(orderId, next === "" ? null : (next as "live" | "chat"));
      if (result.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value ?? ""}
        disabled={isPending}
        onChange={(event) => change(event.target.value)}
        aria-label="Order source"
        className="h-8 rounded-md border border-white/15 bg-background/60 px-2 text-xs text-foreground focus:border-primary disabled:opacity-50"
      >
        <option value="">—</option>
        <option value="live">Live</option>
        <option value="chat">Chat</option>
      </select>
      {error ? (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Beside the FB name on the status pages: the colored Live/Chat tag once a source
 * is set, otherwise a small picker so staff can set it right there.
 */
export function OrderSourceTag({
  orderId,
  source,
}: {
  orderId: string;
  source: "live" | "chat" | null;
}) {
  if (source) return <OrderSourceBadge source={source} />;
  return <OrderSourceSelect orderId={orderId} value={null} />;
}

/** Claim code shown in a table cell. COD orders only; staff type it in inline. */
export function ClaimCodeCell({
  orderId,
  value,
  isCod,
}: {
  orderId: string;
  value: string | null;
  isCod: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isCod) return <span className="text-muted">—</span>;

  function save() {
    if (isPending) return;
    startTransition(async () => {
      const result = await setOrderClaimCode(orderId, draft);
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
        title={value ? "Edit claim code" : "Add claim code"}
      >
        {value ? (
          <span className="font-mono text-foreground [overflow-wrap:anywhere]">{value}</span>
        ) : (
          <span className="whitespace-nowrap rounded-md border border-dashed border-amber-400/50 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            + Add claim code
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
          maxLength={50}
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
          placeholder="Claim code"
          aria-label="Claim code"
          className="h-8 w-full min-w-[7rem] rounded-md border border-white/15 bg-background/60 px-2 text-xs text-foreground focus:border-primary"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          aria-label="Save claim code"
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
