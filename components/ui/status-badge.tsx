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
  claimed: {
    label: "Claimed",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-danger/10 text-danger border-danger/30",
  },
  rto: {
    label: "RTO",
    className: "bg-warning/10 text-warning border-warning/30",
  },
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function CommissionStatusBadge({ status, className }: { status: "paid" | "unpaid"; className?: string }) {
  const config = status === "paid"
    ? { label: "Paid", className: "bg-success/10 text-success border-success/30" }
    : { label: "Unpaid", className: "bg-warning/10 text-warning border-warning/30" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

type MoissaniteStatus = "active" | "low_stock" | "out_of_stock" | "archived";
const moissaniteStatusConfig: Record<MoissaniteStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/30" },
  low_stock: { label: "Low Stock", className: "bg-warning/10 text-warning border-warning/30" },
  out_of_stock: { label: "Out of Stock", className: "bg-danger/10 text-danger border-danger/30" },
  archived: { label: "Archived", className: "bg-muted/10 text-muted border-muted/30" },
};

export function MoissaniteStatusBadge({ status, className }: { status: MoissaniteStatus; className?: string }) {
  const config = moissaniteStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

type SoldMoissaniteStatus = "completed" | "pending" | "refunded";
const soldMoissaniteStatusConfig: Record<SoldMoissaniteStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/30" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/30" },
  refunded: { label: "Refunded", className: "bg-danger/10 text-danger border-danger/30" },
};

export function SoldMoissaniteStatusBadge({ status, className }: { status: SoldMoissaniteStatus; className?: string }) {
  const config = soldMoissaniteStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm",
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
    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide text-pink-light">
      {role}
    </span>
  );
}