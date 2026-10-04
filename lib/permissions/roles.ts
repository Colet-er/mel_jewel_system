import type { UserRole } from "@/types";

/**
 * Central permission matrix.
 * - developer & owner: Full access to all modules, including commissions and financial reports.
 * - admin & staff: Operational access (orders, products, customers), but NO access to commissions or financial reports.
 * - viewer: Read-only access to products.
 */
export type Permission =
  | "orders:create"
  | "orders:edit"
  | "orders:cancel"
  | "payments:record"
  | "customers:manage"
  | "products:view"
  | "products:manage"
  | "reports:view"
  | "reports:export"
  | "users:manage"
  | "commissions:manage";

const PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  developer: [
    "orders:create",
    "orders:edit",
    "orders:cancel",
    "payments:record",
    "customers:manage",
    "products:view",
    "products:manage",
    "reports:view",
    "reports:export",
    "users:manage",
    "commissions:manage",
  ],
  owner: [
    "orders:create",
    "orders:edit",
    "orders:cancel",
    "payments:record",
    "customers:manage",
    "products:view",
    "products:manage",
    "reports:view",
    "reports:export",
    "users:manage",
    "commissions:manage",
  ],
  admin: [
    "orders:create",
    "orders:edit",
    "orders:cancel",
    "payments:record",
    "customers:manage",
    "products:view",
    "products:manage",
  ],
  staff: [
    "orders:create",
    "orders:edit",
    "payments:record",
    "customers:manage",
    "products:view",
  ],
  viewer: ["products:view"],
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}
