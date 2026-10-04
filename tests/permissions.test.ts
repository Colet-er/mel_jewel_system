import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions/roles";

describe("hasPermission", () => {
  it("grants developers and owners full permissions including commissions and reports", () => {
    // Developer
    expect(hasPermission("developer", "commissions:manage")).toBe(true);
    expect(hasPermission("developer", "reports:view")).toBe(true);
    expect(hasPermission("developer", "reports:export")).toBe(true);
    expect(hasPermission("developer", "orders:create")).toBe(true);
    expect(hasPermission("developer", "users:manage")).toBe(true);

    // Owner
    expect(hasPermission("owner", "commissions:manage")).toBe(true);
    expect(hasPermission("owner", "reports:view")).toBe(true);
    expect(hasPermission("owner", "reports:export")).toBe(true);
    expect(hasPermission("owner", "orders:create")).toBe(true);
    expect(hasPermission("owner", "users:manage")).toBe(true);
  });

  it("restricts commissions, reports, and account management from admins while allowing other operational management", () => {
    // Admin operational access
    expect(hasPermission("admin", "orders:create")).toBe(true);
    expect(hasPermission("admin", "orders:edit")).toBe(true);
    expect(hasPermission("admin", "orders:cancel")).toBe(true);
    expect(hasPermission("admin", "payments:record")).toBe(true);
    expect(hasPermission("admin", "customers:manage")).toBe(true);
    expect(hasPermission("admin", "products:manage")).toBe(true);

    // Admin denied from commissions, financial reports, and user accounts management
    expect(hasPermission("admin", "users:manage")).toBe(false);
    expect(hasPermission("admin", "commissions:manage")).toBe(false);
    expect(hasPermission("admin", "reports:view")).toBe(false);
    expect(hasPermission("admin", "reports:export")).toBe(false);
  });

  it("restricts commissions and reports from staff", () => {
    // Staff operational access
    expect(hasPermission("staff", "orders:create")).toBe(true);
    expect(hasPermission("staff", "orders:edit")).toBe(true);
    expect(hasPermission("staff", "payments:record")).toBe(true);
    expect(hasPermission("staff", "customers:manage")).toBe(true);
    expect(hasPermission("staff", "products:view")).toBe(true);

    // Staff denied from users, commissions, and reports
    expect(hasPermission("staff", "users:manage")).toBe(false);
    expect(hasPermission("staff", "commissions:manage")).toBe(false);
    expect(hasPermission("staff", "reports:view")).toBe(false);
    expect(hasPermission("staff", "reports:export")).toBe(false);
  });

  it("viewers are read-only with no access to commissions or reports", () => {
    expect(hasPermission("viewer", "products:view")).toBe(true);
    expect(hasPermission("viewer", "reports:view")).toBe(false);
    expect(hasPermission("viewer", "reports:export")).toBe(false);
    expect(hasPermission("viewer", "commissions:manage")).toBe(false);
    expect(hasPermission("viewer", "orders:create")).toBe(false);
    expect(hasPermission("viewer", "customers:manage")).toBe(false);
  });

  it("denies everything without a role", () => {
    expect(hasPermission(null, "reports:view")).toBe(false);
    expect(hasPermission(undefined, "products:view")).toBe(false);
  });
});
