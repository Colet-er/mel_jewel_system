"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { shipSelectedOrders } from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";

/** Marks a single paid order as shipped via the mark_order_shipped RPC. */
export function ShipOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    if (!window.confirm("Mark this order as shipped?")) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await shipSelectedOrders([orderId]);
        if (result.succeeded.length === 0) {
          setError("Could not ship this order (not eligible or not permitted).");
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
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={isPending}>
        <Truck className="h-4 w-4" aria-hidden />
        {isPending ? "Shipping…" : "Ship"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
