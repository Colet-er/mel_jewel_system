"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { shipSelectedOrders } from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** Re-ships an RTO order back to Shipped via the mark_order_shipped RPC. */
export function ReshipOrderButton({
  orderId,
  invoiceNumber,
}: {
  orderId: string;
  invoiceNumber?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isPending) return;
    const label = invoiceNumber ? `order ${invoiceNumber}` : "this order";
    const ok = await confirm({
      title: "Re-ship Order",
      description: `Re-ship ${label} back to Shipped status?`,
      confirmLabel: "Re-ship",
      variant: "primary",
    });
    if (!ok) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await shipSelectedOrders([orderId]);
        if (result.succeeded.length === 0) {
          setError(result.failed[0]?.message ?? "Could not re-ship this order.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? `Action failed: ${err.message}`
            : "Action failed. Please try again."
        );
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={handleClick}
        disabled={isPending}
        className="text-pink-light hover:text-white"
      >
        <Truck className="h-4 w-4" aria-hidden />
        {isPending ? "Re-shipping…" : "Re-ship"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
