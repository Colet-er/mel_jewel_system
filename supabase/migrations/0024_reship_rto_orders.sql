-- ============================================================
-- Migration: 0024_reship_rto_orders.sql
-- Allow RTO orders to be re-shipped back to Shipped status
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
  is 'Marks a paid, reserved COD, or RTO order as shipped, writes status history, and records sold Moissanite rows.';

grant execute on function public.mark_order_shipped(uuid) to authenticated;
