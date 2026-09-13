-- Connect Moissanite inventory to the canonical reservation/payment workflow.
-- A paid Moissanite order remains a normal paid order and is also projected
-- atomically into sold_moissanite. Quantity belongs to the reservation line;
-- the Moissanite catalog does not enforce or decrement stock.

alter table public.moissanite_skus add column if not exists setting text;

-- Fixed catalog choices used by the Moissanite inventory form.
insert into public.categories(name)
select category_name
from (values ('Ring'),('Necklace'),('Earrings')) as required_categories(category_name)
where not exists (
  select 1 from public.categories existing
  where lower(btrim(existing.name)) = lower(required_categories.category_name)
);

alter table public.order_items add column if not exists moissanite_sku_id uuid
  references public.moissanite_skus(id) on delete restrict;
alter table public.sold_moissanite add column if not exists order_id uuid
  references public.orders(id) on delete restrict;
alter table public.sold_moissanite add column if not exists order_item_id uuid
  references public.order_items(id) on delete restrict;

create index if not exists idx_order_items_moissanite_sku
  on public.order_items(moissanite_sku_id);
create index if not exists idx_sold_moissanite_order
  on public.sold_moissanite(order_id);
create unique index if not exists sold_moissanite_order_item_key
  on public.sold_moissanite(order_item_id)
  where order_item_id is not null;

-- Link existing order items by the canonical product SKU/item number.
update public.order_items oi
set moissanite_sku_id = ms.id
from public.products p, public.moissanite_skus ms, public.orders o
where oi.product_id = p.id
  and oi.order_id = o.id
  and oi.moissanite_sku_id is null
  and p.sku is not null
  and o.status::text = 'reserved'
  and o.archived_at is null
  and ms.status <> 'archived'
  and lower(btrim(ms.sku)) = lower(btrim(p.sku));

create or replace function public.link_order_item_moissanite_sku()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.product_id is not null then
    select ms.id into new.moissanite_sku_id
    from public.products p
    join public.moissanite_skus ms
      on lower(btrim(ms.sku)) = lower(btrim(p.sku))
    where p.id = new.product_id
      and ms.status <> 'archived'
    limit 1;
  else
    new.moissanite_sku_id := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_order_items_link_moissanite on public.order_items;
create trigger trg_order_items_link_moissanite
  before insert or update of product_id,moissanite_sku_id on public.order_items
  for each row execute function public.link_order_item_moissanite_sku();

-- Finalize the normal paid workflow and, for linked Moissanite lines, record
-- the sold row in the same database transaction.
create or replace function public.mark_order_paid(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_paid numeric;
  v_due numeric;
  v_line record;
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

  for v_line in
    select oi.id as order_item_id,oi.moissanite_sku_id,oi.quantity,oi.unit_price
    from public.order_items oi
    where oi.order_id=p_order_id and oi.moissanite_sku_id is not null
    order by oi.id
  loop
    insert into public.sold_moissanite(
      order_id,order_item_id,date_sold,invoice_number,sku_id,customer_id,
      quantity,selling_price,status,created_by
    ) values(
      p_order_id,v_line.order_item_id,current_date,v_order.order_number,
      v_line.moissanite_sku_id,v_order.customer_id,v_line.quantity,
      v_line.unit_price,'completed',auth.uid()
    ) on conflict (order_item_id) where order_item_id is not null do nothing;
  end loop;

  return p_order_id;
end $$;

comment on function public.mark_order_paid(uuid)
  is 'Finalizes a paid order and atomically records linked Moissanite sales without stock enforcement.';

notify pgrst, 'reload schema';
