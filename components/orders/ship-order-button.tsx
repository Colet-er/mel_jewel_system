"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Truck } from "lucide-react";
import {
  bookSelectedOrders,
  shipSelectedOrders,
  type BulkActionResult,
} from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** Moves a paid / reserved / RTO order to the Booking stage. */
export function BookOrderButton({ orderId }: { orderId: string }) {
  return (
    <StageButton
      orderId={orderId}
      icon={<ClipboardList className="h-4 w-4" aria-hidden />}
      label="Book"
      pendingLabel="Booking…"
      title="Book Order"
      description="Book this order for shipping? It moves to the Booking page, where you add the tracking no."
      action={bookSelectedOrders}
    />
  );
}

/** Ships a booked order; the database also requires a tracking number. */
export function ShipOrderButton({
  orderId,
  trackingNumber,
}: {
  orderId: string;
  trackingNumber: string | null;
}) {
  const hasTracking = Boolean(trackingNumber?.trim());
  return (
    <StageButton
      orderId={orderId}
      icon={<Truck className="h-4 w-4" aria-hidden />}
      label="Mark as Shipped"
      pendingLabel="Shipping…"
      title="Mark as Shipped"
      description={`Mark this order as shipped with tracking no. ${trackingNumber ?? ""}?`}
      blockedMessage={hasTracking ? null : "Add the tracking no. on the Booking page first."}
      action={shipSelectedOrders}
    />
  );
}

function StageButton({
  orderId,
  icon,
  label,
  pendingLabel,
  title,
  description,
  blockedMessage = null,
  action,
}: {
  orderId: string;
  icon: ReactNode;
  label: string;
  pendingLabel: string;
  title: string;
  description: string;
  blockedMessage?: string | null;
  action: (ids: string[]) => Promise<BulkActionResult>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isPending) return;
    if (blockedMessage) {
      setError(blockedMessage);
      return;
    }
    const ok = await confirm({ title, description, confirmLabel: title, variant: "primary" });
    if (!ok) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await action([orderId]);
        if (result.succeeded.length === 0) {
          setError(result.failed[0]?.message ?? "This order is not eligible for that action.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? `Action failed: ${err.message}` : "Action failed. Please try again.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={isPending}>
        {icon}
        {isPending ? pendingLabel : label}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
