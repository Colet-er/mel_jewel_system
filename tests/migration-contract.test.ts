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
  const ownerOnlyCommissions = migration("0019_owner_only_commissions.sql");
  const codShipmentAndPayments = migration("0020_cod_shipment_and_payments.sql");
  const addOwnerRole = migration("0021_add_owner_role.sql");
  const allowZeroPayment = migration("0022_allow_zero_payment_amount.sql");
  const multiItemReservations = migration("0023_multi_item_reservations.sql");
  const reshipRtoOrders = migration("0024_reship_rto_orders.sql");

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

  it("restricts commission and employee-assistance records to owners", () => {
    expect(ownerOnlyCommissions).toContain('create policy "Owners can view commissions"');
    expect(ownerOnlyCommissions).toContain('create policy "Owners can insert commissions"');
    expect(ownerOnlyCommissions).toContain('create policy "Owners can update commissions"');
    expect(ownerOnlyCommissions).toContain('create policy "Owners can delete commissions"');
    expect(ownerOnlyCommissions).toMatch(/using \(public\.is_admin\(\)\)/i);
    expect(ownerOnlyCommissions).not.toMatch(/using \(true\)/i);
    expect(ownerOnlyCommissions).not.toContain("is_staff_or_admin");
  });

  it("allows shipping paid and reserved COD orders and recording payments on shipped/claimed orders", () => {
    expect(codShipmentAndPayments).toContain("rec.status not in ('paid', 'reserved')");
    expect(codShipmentAndPayments).toContain("insert into public.sold_moissanite");
    expect(codShipmentAndPayments).toContain("v_order.status in ('cancelled')");
    expect(codShipmentAndPayments).toContain("grant execute on function public.mark_order_shipped");
    expect(codShipmentAndPayments).toContain("grant execute on function public.record_order_payment");
  });

  it("adds owner role to user_role enum and updates is_admin / is_staff_or_admin helpers", () => {
    expect(addOwnerRole).toContain("alter type public.user_role add value if not exists 'owner'");
    expect(addOwnerRole).toContain("select public.current_user_role()::text in ('admin', 'owner')");
    expect(addOwnerRole).toContain("select public.current_user_role()::text in ('admin', 'owner', 'staff')");
  });

  it("relaxes order_payments check constraint and RPC to allow zero payment amounts and auto-ship COD", () => {
    expect(allowZeroPayment).toContain("add constraint order_payments_amount_check check (amount >= 0)");
    expect(allowZeroPayment).toContain("if p_amount is null or p_amount < 0 then");
    expect(allowZeroPayment).toContain("p_payment_method = 'COD' and p_amount = 0 and v_order.status = 'reserved'");
    expect(allowZeroPayment).toContain("update public.orders set status = 'shipped'");
    expect(allowZeroPayment).toContain("grant execute on function public.record_order_payment");
  });

  it("supports bulk multi-item ordering in create_reservation and update_reservation RPCs", () => {
    expect(multiItemReservations).toContain("p_items jsonb default null");
    expect(multiItemReservations).toContain("jsonb_typeof(p_items) = 'array'");
    expect(multiItemReservations).toContain("insert into public.order_items(order_id, product_id, quantity, unit_price)");
    expect(multiItemReservations).toContain("delete from public.order_items where order_id = p_order_id");
    expect(multiItemReservations).toContain("grant execute on function public.create_reservation");
    expect(multiItemReservations).toContain("grant execute on function public.update_reservation");
  });

  it("allows re-shipping RTO orders back to shipped status via mark_order_shipped", () => {
    expect(reshipRtoOrders).toContain("rec.status not in ('paid', 'reserved', 'rto')");
    expect(reshipRtoOrders).toContain("when rec.status = 'rto' then 'Re-shipped from RTO'");
    expect(reshipRtoOrders).toContain("grant execute on function public.mark_order_shipped(uuid) to authenticated");
  });
});
