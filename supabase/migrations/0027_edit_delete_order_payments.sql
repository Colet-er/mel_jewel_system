-- ============================================================
-- Migration: 0027_edit_delete_order_payments.sql
-- Let staff correct (edit) or remove (delete) a recorded payment.
--
-- Both RPCs lock the order, validate against the order total, change the
-- ledger row, and then re-sync the order's paid state so the Reserved/Paid
-- lists stay correct:
--   * a Paid order whose payments no longer cover the total goes back to Reserved
--   * a Reserved order whose payments now cover the total becomes Paid
--   * other statuses (shipped, claimed, rto) keep their status; only paid_at is synced
-- Payment evidence rows are removed by the existing ON DELETE CASCADE.
-- ============================================================

-- Internal helper: re-derive paid/reserved state from the payment ledger.
create or replace function public.sync_order_payment_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric;
  v_paid numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return;
  end if;

  v_total := round(v_order.total_amount + coalesce(v_order.shipping_fee, 0), 2);
  select coalesce(sum(amount), 0) into v_paid from public.order_payments where order_id = p_order_id;

  if v_order.status = 'paid' and v_paid < v_total then
    update public.orders set status = 'reserved', paid_at = null where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
    values (p_order_id, 'paid', 'reserved', auth.uid(), 'Payment edited or removed; balance no longer settled');
  elsif v_order.status = 'reserved' and v_total > 0 and v_paid >= v_total then
    update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
    values (p_order_id, 'reserved', 'paid', auth.uid(), 'Payment ledger fully settled');
  elsif v_order.status not in ('reserved', 'paid', 'cancelled') then
    update public.orders
    set paid_at = case when v_total > 0 and v_paid >= v_total then coalesce(paid_at, now()) else null end
    where id = p_order_id;
  end if;
end $$;

revoke all on function public.sync_order_payment_status(uuid) from public, anon, authenticated;

-- Edit one recorded payment.
create or replace function public.update_order_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default null,
  p_notes text default null
)
returns table(order_id uuid, total_paid numeric, remaining_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.order_payments%rowtype;
  v_order public.orders%rowtype;
  v_total numeric;
  v_others numeric;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_payment_method not in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'COD', 'Other') then
    raise exception 'Select a valid payment method';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Payment amount must be greater than or equal to zero';
  end if;

  select * into v_payment from public.order_payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  select * into v_order from public.orders
  where id = v_payment.order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Payments cannot be changed on cancelled orders';
  end if;

  v_total := round(v_order.total_amount + coalesce(v_order.shipping_fee, 0), 2);
  select coalesce(sum(op.amount), 0) into v_others
  from public.order_payments op
  where op.order_id = v_order.id and op.id <> p_payment_id;

  if round(v_others + p_amount, 2) > v_total then
    raise exception 'Payment amount cannot exceed the remaining balance';
  end if;

  update public.order_payments
  set amount = round(p_amount, 2),
      payment_method = p_payment_method,
      reference_number = nullif(btrim(p_reference_number), ''),
      notes = nullif(btrim(p_notes), '')
  where id = p_payment_id;

  perform public.sync_order_payment_status(v_order.id);

  return query
  select v_order.id,
         round(v_others + p_amount, 2),
         greatest(round(v_total - v_others - p_amount, 2), 0);
end $$;

grant execute on function public.update_order_payment(uuid, numeric, text, text, text) to authenticated;

-- Delete one recorded payment (its evidence rows cascade).
create or replace function public.delete_order_payment(p_payment_id uuid)
returns table(order_id uuid, total_paid numeric, remaining_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.order_payments%rowtype;
  v_order public.orders%rowtype;
  v_total numeric;
  v_paid numeric;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_payment from public.order_payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  select * into v_order from public.orders
  where id = v_payment.order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Payments cannot be changed on cancelled orders';
  end if;

  delete from public.order_payments where id = p_payment_id;

  perform public.sync_order_payment_status(v_order.id);

  v_total := round(v_order.total_amount + coalesce(v_order.shipping_fee, 0), 2);
  select coalesce(sum(op.amount), 0) into v_paid from public.order_payments op where op.order_id = v_order.id;

  return query select v_order.id, v_paid, greatest(round(v_total - v_paid, 2), 0);
end $$;

grant execute on function public.delete_order_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
