import type { UserRole } from "@/types";

/**
 * Central permission matrix.
 * The database enforces the same rules via RLS; this matrix drives UI affordances.
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
  | "settings:manage";

const PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
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
    "settings:manage",
  ],
  staff: [
    "orders:create",
    "orders:edit",
    "payments:record",
    "customers:manage",
    "products:view",
    "reports:view",
  ],
  viewer: ["products:view", "reports:view"],
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return PERMISSIONS[role].includes(permission);
}
