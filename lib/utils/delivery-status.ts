/**
 * Courier / delivery labels shown as the Status chip on the Booking, Shipped,
 * Claimed, RTO and Cancelled pages. Display only — never changes the page an
 * order is listed on. Keep in sync with orders_delivery_status_check (0030).
 */
export const DELIVERY_STATUSES = [
  "branch_collect",
  "problematic",
  "for_pick_up",
  "delivered",
  "rto",
  "out_for_delivery",
  "in_transit",
  "full_paid",
  "shipped",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; className: string }> = {
  branch_collect: { label: "BRANCH COLLECT", className: "bg-[#d4edbc] text-[#11734b]" },
  problematic: { label: "PROBLEMATIC", className: "bg-[#b10202] text-white" },
  for_pick_up: { label: "FOR PICK UP", className: "bg-[#0a53a8] text-white" },
  delivered: { label: "DELIVERED", className: "bg-[#5a3286] text-white" },
  rto: { label: "RTO", className: "bg-[#3d3d3d] text-white" },
  out_for_delivery: { label: "OUT FOR DELIVERY", className: "bg-[#ffe5a0] text-[#473821]" },
  in_transit: { label: "IN TRANSIT", className: "bg-[#e8622c] text-white" },
  full_paid: { label: "FULL PAID", className: "bg-[#e6cff2] text-[#5a3286]" },
  shipped: { label: "SHIPPED", className: "bg-[#bfe1f6] text-[#0a53a8]" },
};

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === "string" && (DELIVERY_STATUSES as readonly string[]).includes(value);
}
