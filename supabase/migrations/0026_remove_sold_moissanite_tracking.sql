-- ============================================================
-- Migration: 0026_remove_sold_moissanite_tracking.sql
-- Detach Sold Moissanite from the order workflow.
--
-- Paying, shipping, and COD-dispatching an order no longer writes rows into
-- public.sold_moissanite. The table and its existing rows are intentionally
-- kept (no data is deleted); nothing in the app reads or writes it anymore.
-- ============================================================

-- 1. mark_order_paid: same as 0017, minus the sold_moissanite projection.
create or replace function public.mark_order_paid(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_paid numeric;
  v_due numeric;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into v_order from public.orders
  where id=p_order_id and archived_at is null for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status::text <> 'reserved' then
    raise exception 'Only reserved orders can be marked paid';
  end if;

  select coalesce(sum(amount),0) into v_paid
  from public.order_payments where order_id=p_order_id;
  v_due:=round(v_order.total_amount+coalesce(v_order.shipping_fee,0),2);
  if v_paid < v_due then
    raise exception 'Payment ledger does not cover the reservation total';
  end if;

  update public.orders set status='paid',paid_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,notes)
  values(p_order_id,'reserved','paid',auth.uid(),'Payment ledger fully settled');

  return p_order_id;
end $$;

comment on function public.mark_order_paid(uuid)
  is 'Finalizes a paid order once the payment ledger covers the total.';

-- 2. mark_order_shipped: same as 0024, minus the sold_moissanite projection.
create or replace function public.mark_order_shipped(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to ship orders' using errcode = '42501';
  end if;

  select * into rec
  from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status not in ('paid', 'reserved', 'rto') then
    raise exception 'Only paid, reserved, or RTO orders can be marked as shipped';
  end if;

  update public.orders
  set status = 'shipped',
      shipped_at = coalesce(shipped_at, now())
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
  values (
    p_order_id,
    rec.status,
    'shipped',
    auth.uid(),
    case
      when rec.status = 'reserved' then 'Shipped directly from reservation (COD / ready to dispatch)'
      when rec.status = 'rto' then 'Re-shipped from RTO'
      else null
    end
  );

  return p_order_id;
end;
$$;

comment on function public.mark_order_shipped(uuid)
  is 'Marks a paid, reserved COD, or RTO order as shipped and writes status history.';

grant execute on function public.mark_order_shipped(uuid) to authenticated;

-- 3. record_order_payment: same as 0022, minus the sold_moissanite projection.
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default null,
  p_notes text default null
)
returns table(payment_id uuid, total_paid numeric, remaining_balance numeric, fully_paid boolean)
language plpgsql security definer set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_before numeric;
  v_after numeric;
  v_total numeric;
  v_payment_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if p_payment_method not in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'COD', 'Other') then
    raise exception 'Select a valid payment method';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Payment amount must be greater than or equal to zero';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('cancelled') then
    raise exception 'Payments cannot be recorded for cancelled orders';
  end if;

  v_total := round(v_order.total_amount + coalesce(v_order.shipping_fee, 0), 2);
  select coalesce(sum(amount), 0) into v_before from public.order_payments where order_id = p_order_id;

  if p_amount > v_total - v_before then
    raise exception 'Payment amount cannot exceed the remaining balance';
  end if;

  insert into public.order_payments(
    order_id, kind, amount, payment_method, reference_number, notes, recorded_by, created_at
  )
  values (
    p_order_id,
    case when p_amount >= v_total - v_before and (v_total - v_before) > 0 then 'balance'::public.payment_kind else 'downpayment'::public.payment_kind end,
    round(p_amount, 2),
    p_payment_method,
    nullif(btrim(p_reference_number), ''),
    nullif(btrim(p_notes), ''),
    auth.uid(),
    now()
  ) returning id into v_payment_id;

  v_after := round(v_before + p_amount, 2);

  -- If recording 0 amount with COD on an active reservation, automatically move to shipped
  if p_payment_method = 'COD' and p_amount = 0 and v_order.status = 'reserved' then
    update public.orders set status = 'shipped', shipped_at = coalesce(shipped_at, now()) where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
    values (p_order_id, 'reserved', 'shipped', auth.uid(), 'COD shipment dispatched (₱0 payment entry)');
  elsif v_after >= v_total and v_total > 0 then
    if v_order.status = 'reserved' then
      perform public.mark_order_paid(p_order_id);
    else
      update public.orders set paid_at = coalesce(paid_at, now()) where id = p_order_id;
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
      values (p_order_id, v_order.status, v_order.status, auth.uid(), 'Payment ledger fully settled');
    end if;
  end if;

  return query select v_payment_id, v_after, greatest(round(v_total - v_after, 2), 0), (v_after >= v_total and v_total > 0);
end $$;

grant execute on function public.record_order_payment(uuid, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';
