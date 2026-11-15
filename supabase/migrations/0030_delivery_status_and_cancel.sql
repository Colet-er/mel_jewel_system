-- ============================================================
-- Migration: 0030_delivery_status_and_cancel.sql
--
-- 1. orders.delivery_status: a courier/delivery label shown as the "Status"
--    chip on the Booking, Shipped, Claimed, RTO and Cancelled pages
--    (Branch Collect, Problematic, For Pick Up, Delivered, RTO,
--    Out for Delivery, In Transit, Full Paid, Shipped). It is a label only;
--    it never moves an order between pages.
-- 2. cancel_order: can now cancel paid, booked, shipped and RTO orders too
--    (previously reserved only), so every list supports bulk cancellation.
--    Claimed and already-cancelled orders still cannot be cancelled.
-- No existing rows are modified.
-- ============================================================

alter table public.orders add column if not exists delivery_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_delivery_status_check
      check (
        delivery_status is null
        or delivery_status in (
          'branch_collect', 'problematic', 'for_pick_up', 'delivered', 'rto',
          'out_for_delivery', 'in_transit', 'full_paid', 'shipped'
        )
      );
  end if;
end $$;

comment on column public.orders.delivery_status is
  'Courier/delivery label (branch_collect, problematic, for_pick_up, delivered, rto, out_for_delivery, in_transit, full_paid, shipped). Display only.';

create or replace function public.set_order_delivery_status(p_order_id uuid, p_delivery_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(btrim(coalesce(p_delivery_status, '')), '');
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to update delivery status' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'branch_collect', 'problematic', 'for_pick_up', 'delivered', 'rto',
    'out_for_delivery', 'in_transit', 'full_paid', 'shipped'
  ) then
    raise exception 'Invalid delivery status';
  end if;

  update public.orders
  set delivery_status = v_status
  where id = p_order_id and archived_at is null;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  return p_order_id;
end;
$$;

grant execute on function public.set_order_delivery_status(uuid, text) to authenticated;

-- cancel_order: same as 0007 but accepts paid / booked / shipped / rto orders.
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to cancel orders' using errcode = '42501';
  end if;

  select * into rec
  from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status::text not in ('reserved', 'paid', 'booked', 'shipped', 'rto') then
    raise exception 'Only reserved, paid, booked, shipped, or RTO orders can be cancelled';
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, rec.status, 'cancelled', auth.uid());

  return p_order_id;
end;
$$;

comment on function public.cancel_order(uuid, text)
  is 'Cancels a reserved, paid, booked, shipped, or RTO order with an optional reason and writes status history. Staff/admin only.';

notify pgrst, 'reload schema';
