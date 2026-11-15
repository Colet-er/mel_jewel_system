"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, BadgeCheck, CheckCircle2, Truck, X } from "lucide-react";
import {
  cancelSelectedOrders,
  claimSelectedOrders,
  shipSelectedOrders,
  type BulkActionResult,
} from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Row selection for the server-rendered status tables. The table itself stays
 * a server component; only the checkboxes and the bulk bar are client code.
 */
interface SelectionState {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

function useSelection(): SelectionState {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("Selection components must be inside <SelectionProvider>.");
  return value;
}

export function SelectionProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drop selections for rows that left the list (shipped, cancelled, …).
  const visible = useMemo(() => new Set(ids), [ids]);
  const effective = useMemo(
    () => new Set(Array.from(selected).filter((id) => visible.has(id))),
    [selected, visible]
  );

  const value: SelectionState = {
    ids,
    selected: effective,
    toggle: (id) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected(effective.size === ids.length ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
  };

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

const checkboxClass =
  "h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-white/20 bg-background/60 transition-colors checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function SelectAllCheckbox() {
  const { ids, selected, toggleAll } = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const all = ids.length > 0 && selected.size === ids.length;
  const some = selected.size > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Select all orders"
      checked={all}
      onChange={toggleAll}
      className={checkboxClass}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      className={checkboxClass}
    />
  );
}

export type BulkAction = "cancel" | "ship" | "claim";

const ACTIONS: Record<
  BulkAction,
  {
    label: string;
    icon: ReactNode;
    variant: "primary" | "secondary" | "danger";
    title: string;
    confirm: string;
    run: (ids: string[]) => Promise<BulkActionResult>;
    done: string;
  }
> = {
  ship: {
    label: "Mark Selected as Shipped",
    icon: <Truck className="h-4 w-4" aria-hidden />,
    variant: "primary",
    title: "Mark as Shipped",
    confirm: "Mark {count} order(s) as shipped? Orders without a tracking no. are skipped.",
    run: shipSelectedOrders,
    done: "Marked {ok} order(s) as shipped.",
  },
  claim: {
    label: "Claim Selected",
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    variant: "primary",
    title: "Claim Orders",
    confirm: "Mark {count} order(s) as claimed?",
    run: claimSelectedOrders,
    done: "Marked {ok} order(s) as claimed.",
  },
  cancel: {
    label: "Cancel Selected",
    icon: <Ban className="h-4 w-4" aria-hidden />,
    variant: "danger",
    title: "Cancel Orders",
    confirm: "Cancel {count} order(s)? This cannot be undone.",
    run: (ids) => cancelSelectedOrders(ids),
    done: "Cancelled {ok} order(s).",
  },
};

/** Bar shown above the table while rows are selected. */
export function BulkActionBar({ actions }: { actions: BulkAction[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { selected, clear } = useSelection();
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function runAction(action: BulkAction) {
    const ids = Array.from(selected);
    if (ids.length === 0 || isPending) return;
    const config = ACTIONS[action];
    const ok = await confirm({
      title: config.title,
      description: config.confirm.replace("{count}", String(ids.length)),
      confirmLabel: config.title,
      variant: config.variant === "danger" ? "danger" : "primary",
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        const result = await config.run(ids);
        clear();
        const failed = result.failed.length;
        const reason =
          failed > 0 && /tracking number/i.test(result.failed[0]?.message ?? "")
            ? " (missing tracking no.)"
            : "";
        setNotice({
          text:
            config.done.replace("{ok}", String(result.succeeded.length)) +
            (failed > 0 ? ` ${failed} could not be updated${reason}.` : ""),
          tone: failed > 0 ? "warn" : "ok",
        });
        router.refresh();
      } catch (error) {
        setNotice({
          text: error instanceof Error ? `Action failed: ${error.message}` : "Action failed. Please try again.",
          tone: "warn",
        });
      }
    });
  }

  return (
    <>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-y border-white/[0.07] bg-white/[0.03] px-5 py-3">
          <span className="text-sm text-muted">{selected.size} selected</span>
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={ACTIONS[action].variant}
              onClick={() => runAction(action)}
              disabled={isPending}
            >
              {ACTIONS[action].icon}
              {ACTIONS[action].label}
            </Button>
          ))}
          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            className="text-sm text-muted hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className={
            notice.tone === "ok"
              ? "mx-4 my-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
              : "mx-4 my-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-400"
          }
        >
          <span className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
            {notice.text}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="rounded p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
