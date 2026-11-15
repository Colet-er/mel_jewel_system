"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderDeliveryStatus } from "@/app/(dashboard)/orders/reserved/actions";
import {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_CONFIG,
  isDeliveryStatus,
} from "@/lib/utils/delivery-status";
import { cn } from "@/lib/utils/cn";

const chipBase =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide";

/** Read-only delivery chip (or a muted dash when unset). */
export function DeliveryStatusChip({ value }: { value: string | null | undefined }) {
  if (!isDeliveryStatus(value)) return <span className="text-muted">—</span>;
  const config = DELIVERY_STATUS_CONFIG[value];
  return <span className={cn(chipBase, config.className)}>{config.label}</span>;
}

/**
 * Delivery-status chip that doubles as a dropdown. Picking a value saves it
 * immediately; it is a label only and never moves the order to another page.
 */
export function DeliveryStatusSelect({
  orderId,
  value,
}: {
  orderId: string;
  value: string | null | undefined;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<string>(isDeliveryStatus(value) ? value : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const config = isDeliveryStatus(current) ? DELIVERY_STATUS_CONFIG[current] : null;

  function handleChange(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const result = await setOrderDeliveryStatus(orderId, next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <select
        value={current}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Delivery status"
        className={cn(
          chipBase,
          "cursor-pointer appearance-none border-0 pr-2.5 text-center uppercase focus:ring-2 focus:ring-primary/40 disabled:opacity-60",
          config ? config.className : "border border-dashed border-white/20 bg-transparent font-semibold text-muted"
        )}
      >
        <option value="" className="bg-card text-foreground">
          {current ? "Clear status" : "Set status"}
        </option>
        {DELIVERY_STATUSES.map((status) => (
          <option key={status} value={status} className="bg-card text-foreground">
            {DELIVERY_STATUS_CONFIG[status].label}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
