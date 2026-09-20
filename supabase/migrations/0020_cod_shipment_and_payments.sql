-- ============================================================
-- Migration: 0020_cod_shipment_and_payments.sql
-- Allow COD/unpaid reserved orders to proceed directly to shipment,
-- record linked Moissanite sales upon shipment if not already recorded,
-- and allow recording ledger payments on shipped, claimed, and reserved orders.
-- ============================================================

create or replace function public.mark_order_shipped(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
  v_line record;
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

  if rec.status not in ('paid', 'reserved') then
    raise exception 'Only paid or reserved orders can be marked as shipped';
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
    case when rec.status = 'reserved' then 'Shipped directly from reservation (COD / ready to dispatch)' else null end
  );

  -- For linked Moissanite line items, record the sold entry atomically if not yet inserted
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
      p_order_id, v_line.order_item_id, current_date, rec.order_number,
      v_line.moissanite_sku_id, rec.customer_id, v_line.quantity,
      v_line.unit_price, 'completed', auth.uid()
    ) on conflict (order_item_id) where order_item_id is not null do nothing;
  end loop;

  return p_order_id;
end;
$$;

comment on function public.mark_order_shipped(uuid)
  is 'Marks a paid or reserved COD order as shipped, writes status history, and records sold Moissanite rows.';

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

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
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
    case when p_amount >= v_total - v_before then 'balance'::public.payment_kind else 'downpayment'::public.payment_kind end,
    round(p_amount, 2),
    p_payment_method,
    nullif(btrim(p_reference_number), ''),
    nullif(btrim(p_notes), ''),
    auth.uid(),
    now()
  ) returning id into v_payment_id;

  v_after := round(v_before + p_amount, 2);

  if v_after >= v_total then
    if v_order.status = 'reserved' then
      perform public.mark_order_paid(p_order_id);
    else
      update public.orders set paid_at = coalesce(paid_at, now()) where id = p_order_id;
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, notes)
      values (p_order_id, v_order.status, v_order.status, auth.uid(), 'Payment ledger fully settled');
    end if;
  end if;

  return query select v_payment_id, v_after, greatest(round(v_total - v_after, 2), 0), v_after >= v_total;
end $$;

grant execute on function public.mark_order_shipped(uuid) to authenticated;
grant execute on function public.record_order_payment(uuid, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';
