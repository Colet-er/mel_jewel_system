import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions/roles";

describe("hasPermission", () => {
  it("grants admins full management permissions", () => {
    expect(hasPermission("admin", "users:manage")).toBe(true);
    expect(hasPermission("admin", "orders:cancel")).toBe(true);
  });

  it("allows staff to create orders but not manage users", () => {
    expect(hasPermission("staff", "orders:create")).toBe(true);
    expect(hasPermission("staff", "users:manage")).toBe(false);
  });

  it("viewers are read-only", () => {
    expect(hasPermission("viewer", "reports:view")).toBe(true);
    expect(hasPermission("viewer", "orders:create")).toBe(false);
    expect(hasPermission("viewer", "customers:manage")).toBe(false);
  });

  it("denies everything without a role", () => {
    expect(hasPermission(null, "reports:view")).toBe(false);
    expect(hasPermission(undefined, "products:view")).toBe(false);
  });
});
