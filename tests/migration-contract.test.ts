import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("reservation/payment migration contract", () => {
  const orders = migration("0002_orders_domain.sql");
  const payments = migration("0003_downpayments.sql");
  const reconcile = migration("0014_reconcile_reservation_payment_domains.sql");
  const newFeatures = migration("0015_new_features.sql");
  const statusConstraintFix = migration("0016_fix_orders_status_check.sql");
  const moissaniteOrders = migration("0017_moissanite_inventory_orders.sql");
  const profileSecurity = migration("0018_profile_role_security.sql");

  it("defines the complete clean-install reservation lifecycle", () => {
    for (const field of [
      "order_number",
      "reservation_type",
      "discount",
      "shipping_fee",
      "paid_at",
      "shipped_at",
      "cancelled_at",
      "cancellation_reason",
      "archived_at",
    ]) {
      expect(orders).toContain(field);
    }
  });

  it("requires canonical payment fields and constrains accepted methods", () => {
    expect(payments).toMatch(/payment_method text not null/i);
    expect(payments).toContain("reference_number text");
    for (const method of ["Cash", "GCash", "Maya", "Bank Transfer", "COD", "Other"]) {
      expect(payments).toContain(`'${method}'`);
    }
  });

  it("backfills legacy names without dropping customer, order, or payment data", () => {
    expect(reconcile).toContain("set order_number = order_no");
    expect(reconcile).toContain("set reference_number = reference_no");
    expect(reconcile).toContain("set payment_method = case");
    expect(reconcile).not.toMatch(/drop table/i);
  });

  it("keeps create, edit, and payment writes atomic in database functions", () => {
    expect(reconcile).toContain("function public.create_reservation");
    expect(reconcile).toContain("function public.update_reservation");
    expect(reconcile).toContain("function public.record_order_payment");
    expect(reconcile).toContain("perform public.mark_order_paid(p_order_id)");
  });

  it("allows append-only downpayment increases during reservation edits", () => {
    expect(reconcile).toContain("v_payment_delta");
    expect(reconcile).toContain("Downpayment cannot be reduced because payment history is preserved");
    expect(reconcile).toContain("p_downpayment_method");
  });

  it("allows any authenticated user to claim shipped orders", () => {
    const claimedRpc = newFeatures.slice(
      newFeatures.indexOf("create or replace function public.mark_order_claimed"),
      newFeatures.indexOf("-- mark_order_rto()")
    );
    expect(claimedRpc).toContain("if auth.uid() is null then");
    expect(claimedRpc).toContain("if rec.status <> 'shipped' then");
    expect(claimedRpc).not.toContain("is_staff_or_admin");
  });

  it("allows claimed and RTO in the legacy orders status constraint", () => {
    expect(statusConstraintFix).toContain("drop constraint if exists orders_status_check");
    expect(statusConstraintFix).toContain("'claimed'");
    expect(statusConstraintFix).toContain("'rto'");
    expect(statusConstraintFix).toContain("validate constraint orders_status_check");
    expect(statusConstraintFix).not.toMatch(/delete from public\.orders/i);
  });

  it("records paid Moissanite order items without enforcing catalog stock", () => {
    expect(moissaniteOrders).toContain("moissanite_sku_id");
    expect(moissaniteOrders).toContain("insert into public.sold_moissanite");
    expect(moissaniteOrders).toContain("where order_item_id is not null");
    expect(moissaniteOrders).not.toContain("available_stock=available_stock-v_line.quantity");
    expect(moissaniteOrders).not.toContain("Insufficient Moissanite stock for this order");
    expect(moissaniteOrders).not.toMatch(/delete from public\.(orders|order_items|order_payments)/i);
  });

  it("does not trust signup metadata or self-service updates for roles", () => {
    expect(profileSecurity).toContain("'viewer'");
    expect(profileSecurity).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/i);
    expect(profileSecurity).toContain("trg_protect_profile_identity");
    expect(profileSecurity).toContain("Only administrators can change profile roles");
  });
});
