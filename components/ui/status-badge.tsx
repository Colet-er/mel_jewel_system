import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils/cn";

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  reserved: {
    label: "Reserved",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  paid: {
    label: "Paid",
    className: "bg-primary/10 text-pink-light border-primary/30",
  },
  shipped: {
    label: "Shipped",
    className: "bg-success/10 text-success border-success/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-danger/10 text-danger border-danger/30",
  },
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-pink-light">
      {role}
    </span>
  );
}
