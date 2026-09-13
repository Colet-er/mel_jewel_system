"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { claimSelectedOrders } from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";

/** Marks a single shipped order as claimed via the mark_order_claimed RPC. */
export function ClaimOrderButton({ orderId, status }: { orderId: string; status?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEligible = status === "shipped";

  function handleClick() {
    if (isPending || !isEligible) return;
    if (!window.confirm("Mark this order as claimed?")) return;

    startTransition(async () => {
      setError(null);
      try {
        const result = await claimSelectedOrders([orderId]);
        if (result.succeeded.length === 0) {
          const errorMsg = result.failed[0]?.message || "Could not claim this order (not eligible or not permitted).";
          setError(errorMsg);
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
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={isPending || !isEligible}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {isPending ? "Claiming…" : "Claim"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : !isEligible ? (
        <span className="text-xs text-muted">Not shippable</span>
      ) : null}
    </span>
  );
}