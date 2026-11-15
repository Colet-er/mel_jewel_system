-- ============================================================
-- Migration: 0028_booking_stage.sql
-- Adds a "booked" stage between Paid and Shipped.
--
--   Paid / Reserved / RTO --(Book)--> Booked --(tracking no. + Mark as Shipped)--> Shipped
--
-- * orders.booked_at and orders.tracking_number are new, nullable columns.
-- * mark_order_shipped now only ships BOOKED orders that have a tracking number.
-- * A ₱0 COD payment on a reservation now books the order instead of shipping it.
-- No existing rows are modified.
-- ============================================================

-- 1. New lifecycle value (enum installs) ----------------------------------
do $$
begin
  if exists (select 1 from pg_type where typname = 'order_status')
     and not exists (
       select 1 from pg_enum
       where enumlabel = 'booked'
         and enumtypid = (select oid from pg_type where typname = 'order_status')
     ) then
    alter type public.order_status add value 'booked';
  end if;
end $$;

-- 2. Legacy text-status installs: allow 'booked' in the check constraint ----
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders drop constraint orders_status_check;
    alter table public.orders
      add constraint orders_status_check
      check (status::text in ('reserved', 'paid', 'booked', 'shipped', 'claimed', 'cancelled', 'rto'))
      not valid;
    alter table public.orders validate constraint orders_status_check;
  end if;
end $$;

-- 3. Booking columns -------------------------------------------------------
alter table public.orders add column if not exists booked_at timestamptz;
alter table public.orders add column if not exists tracking_number text;

comment on column public.orders.booked_at is 'When the order was booked with a courier (moved to the Booking page).';
comment on column public.orders.tracking_number is 'Courier tracking number, entered on the Booking page before shipping.';

-- 4. Book an order ---------------------------------------------------------
create or replace function public.mark_order_booked(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
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
      when rec.status::text = 'reserved' then 'Booked directly from reservation'
      when rec.status::text = 'rto' then 'Re-booked from RTO'
      else 'Booked for shipping'
    end
  );

  return p_order_id;
end;
$$;

comment on function public.mark_order_booked(uuid)
  is 'Moves a paid, reserved, or RTO order to the Booking stage. Staff/admin only.';
grant execute on function public.mark_order_booked(uuid) to authenticated;

-- 5. Set / correct the tracking number --------------------------------------
create or replace function public.set_order_tracking_number(p_order_id uuid, p_tracking_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
  v_tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to update tracking numbers' using errcode = '42501';
  end if;

  if v_tracking is not null and length(v_tracking) > 100 then
    raise exception 'Tracking number must be 100 characters or fewer';
  end if;

  select * into rec from public.orders
  where id = p_order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status::text not in ('booked', 'shipped', 'claimed', 'rto') then
    raise exception 'Tracking numbers can only be set on booked or shipped orders';
  end if;

  update public.orders set tracking_number = v_tracking where id = p_order_id;
  return p_order_id;
end;
$$;

grant execute on function public.set_order_tracking_number(uuid, text) to authenticated;

-- 6. Ship: booked orders with a tracking number only -----------------------
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

  select * into rec from public.orders
  where id = p_order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status::text <> 'booked' then
    raise exception 'Only booked orders can be marked as shipped';
  end if;

  if nullif(btrim(coalesce(rec.tracking_number, '')), '') is null then
    raise exception 'Enter a tracking number before marking as shipped';
  end if;

  update public.orders
  set status = 'shipped',
      shipped_at = coalesce(shipped_at, now())
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
  values (p_order_id, rec.status, 'shipped', auth.uid(), 'Shipped with tracking no. ' || rec.tracking_number);

  return p_order_id;
end;
$$;

comment on function public.mark_order_shipped(uuid)
  is 'Ships a booked order that has a tracking number and writes status history.';
grant execute on function public.mark_order_shipped(uuid) to authenticated;

-- 7. record_order_payment: ₱0 COD on a reservation now BOOKS the order -----
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

  -- A ₱0 COD entry on an active reservation sends it to Booking (tracking no. is added there).
  if p_payment_method = 'COD' and p_amount = 0 and v_order.status = 'reserved' then
    update public.orders set status = 'booked', booked_at = coalesce(booked_at, now()) where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
    values (p_order_id, 'reserved', 'booked', auth.uid(), 'COD order booked (₱0 payment entry)');
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
