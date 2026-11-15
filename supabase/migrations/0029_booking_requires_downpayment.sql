-- ============================================================
-- Migration: 0029_booking_requires_downpayment.sql
-- An order needs at least a downpayment before it can be booked.
--
-- * mark_order_booked: a reservation with no recorded payment (> ₱0) can no
--   longer be booked. Paid and RTO orders book as before.
-- * record_order_payment: a ₱0 COD entry no longer auto-books a reservation
--   (it is just recorded; the order stays in Reserved until money is paid).
-- No existing rows are modified.
-- ============================================================

create or replace function public.mark_order_booked(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
  v_paid numeric;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to book orders' using errcode = '42501';
  end if;

  select * into rec from public.orders
  where id = p_order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status::text not in ('paid', 'reserved', 'rto') then
    raise exception 'Only paid, reserved, or RTO orders can be booked';
  end if;

  if rec.status::text = 'reserved' then
    select coalesce(sum(amount), 0) into v_paid from public.order_payments where order_id = p_order_id;
    if v_paid <= 0 then
      raise exception 'A downpayment is required before booking';
    end if;
  end if;

  update public.orders
  set status = 'booked',
      booked_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
  values (
    p_order_id,
    rec.status,
    'booked',
    auth.uid(),
    case
      when rec.status::text = 'reserved' then 'Booked with downpayment'
      when rec.status::text = 'rto' then 'Re-booked from RTO'
      else 'Booked for shipping'
    end
  );

  return p_order_id;
end;
$$;

comment on function public.mark_order_booked(uuid)
  is 'Books a paid or RTO order, or a reservation that has at least a downpayment. Staff/admin only.';
grant execute on function public.mark_order_booked(uuid) to authenticated;

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

  -- No status change for a ₱0 entry: booking needs a real downpayment first.
  if v_after >= v_total and v_total > 0 then
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
