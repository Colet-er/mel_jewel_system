-- ============================================================
-- Migration: 0022_allow_zero_payment_amount.sql
-- Allow recording payment entries with 0 amount (e.g. COD waybills/remittances).
-- When recording a 0 amount with payment method 'COD' on a reserved order,
-- automatically transition the order to 'shipped'.
-- ============================================================

-- 1. Relax order_payments table amount constraint from > 0 to >= 0
alter table public.order_payments drop constraint if exists order_payments_amount_check;
alter table public.order_payments add constraint order_payments_amount_check check (amount >= 0);

-- 2. Update record_order_payment RPC
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
  v_line record;
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

    for v_line in
      select oi.id as order_item_id, oi.moissanite_sku_id, oi.quantity, oi.unit_price
      from public.order_items oi
      where oi.order_id = p_order_id and oi.moissanite_sku_id is not null
      order by oi.id
    loop
      insert into public.sold_moissanite(
        order_id, order_item_id, date_sold, invoice_number, sku_id, customer_id,
        quantity, selling_price, status, created_by
      ) values (
        p_order_id, v_line.order_item_id, current_date, v_order.order_number,
        v_line.moissanite_sku_id, v_order.customer_id, v_line.quantity,
        v_line.unit_price, 'completed', auth.uid()
      ) on conflict (order_item_id) where order_item_id is not null do nothing;
    end loop;
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
