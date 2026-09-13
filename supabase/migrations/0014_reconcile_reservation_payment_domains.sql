-- Reconcile legacy production tables with the canonical reservation/payment model.
-- Canonical names: orders.order_number, order_payments.payment_method,
-- order_payments.reference_number, and orders.archived_at.
-- Legacy columns are preserved but are no longer required by new writes.

alter table public.customers add column if not exists name text;
alter table public.customers add column if not exists fb_name text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists is_archived boolean not null default false;

alter table public.products add column if not exists name text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists is_archived boolean not null default false;

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists shipping_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists reservation_type text not null default 'regular';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists archived_at timestamptz;

alter table public.order_payments add column if not exists payment_method text;
alter table public.order_payments add column if not exists reference_number text;
alter table public.order_payments add column if not exists notes text;
alter table public.order_payments add column if not exists recorded_by uuid references auth.users(id) on delete set null;
alter table public.order_payments add column if not exists created_at timestamptz not null default now();

-- Preserve and copy legacy data before enforcing the canonical fields.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='customer_name') then
    execute 'update public.customers set name = customer_name where name is null or btrim(name) = ''''';
    execute 'alter table public.customers alter column customer_name drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='social_name') then
    execute 'update public.customers set fb_name = social_name where fb_name is null and social_name is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='product_name') then
    execute 'update public.products set name = product_name where name is null or btrim(name) = ''''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='product_code') then
    execute 'update public.products set sku = product_code where sku is null and product_code is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='order_no') then
    execute 'update public.orders set order_number = order_no where order_number is null or btrim(order_number) = ''''';
    execute 'alter table public.orders alter column order_no drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_items' and column_name='product_name') then
    execute 'alter table public.order_items alter column product_name drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_items' and column_name='product_code') then
    execute 'alter table public.order_items alter column product_code drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_payments' and column_name='reference_no') then
    execute 'update public.order_payments set reference_number = reference_no where reference_number is null and reference_no is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_payments' and column_name='reference') then
    execute 'update public.order_payments set reference_number = reference where reference_number is null and reference is not null';
  end if;
end $$;

update public.customers set name = 'Unknown customer' where name is null or btrim(name) = '';
alter table public.customers alter column name set not null;
update public.products set name = 'Unknown item' where name is null or btrim(name) = '';
alter table public.products alter column name set not null;

update public.orders
set order_number = 'LEGACY-' || replace(id::text, '-', '')
where order_number is null or btrim(order_number) = '';
alter table public.orders alter column order_number set not null;
create unique index if not exists orders_order_number_key on public.orders(order_number);

-- Production has a plain required line_total while clean installs use a
-- generated column. Fill only the legacy/plain variant so both schemas share
-- the same RPC statements.
create or replace function public.set_legacy_order_item_line_total()
returns trigger language plpgsql set search_path=public as $$
begin
  new.line_total := round(new.quantity * new.unit_price, 2);
  return new;
end $$;
do $$
declare v_generated text;
begin
  select is_generated into v_generated from information_schema.columns
  where table_schema='public' and table_name='order_items' and column_name='line_total';
  if v_generated = 'NEVER' then
    drop trigger if exists trg_order_items_line_total on public.order_items;
    create trigger trg_order_items_line_total before insert or update of quantity,unit_price
      on public.order_items for each row execute function public.set_legacy_order_item_line_total();
  end if;
end $$;

update public.order_payments
set payment_method = case lower(btrim(coalesce(payment_method, '')))
  when 'cash' then 'Cash'
  when 'gcash' then 'GCash'
  when 'maya' then 'Maya'
  when 'bank transfer' then 'Bank Transfer'
  when 'bank_transfer' then 'Bank Transfer'
  when 'cod' then 'COD'
  when 'other' then 'Other'
  else 'Other'
end;
alter table public.order_payments alter column payment_method set not null;
alter table public.order_payments drop constraint if exists order_payments_payment_method_check;
alter table public.order_payments add constraint order_payments_payment_method_check
  check (payment_method in ('Cash','GCash','Maya','Bank Transfer','COD','Other'));

create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_evidence_payment on public.payment_evidence(payment_id);
alter table public.payment_evidence enable row level security;
drop policy if exists "Authenticated users can view payment evidence metadata" on public.payment_evidence;
create policy "Authenticated users can view payment evidence metadata"
  on public.payment_evidence for select to authenticated using (true);
drop policy if exists "Staff can insert payment evidence metadata" on public.payment_evidence;
create policy "Staff can insert payment evidence metadata"
  on public.payment_evidence for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Admins can delete payment evidence metadata" on public.payment_evidence;
create policy "Admins can delete payment evidence metadata"
  on public.payment_evidence for delete to authenticated using (public.is_admin());

-- Remove the old overload so PostgREST exposes one unambiguous creation RPC.
drop function if exists public.create_reservation(text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text);
drop function if exists public.set_order_downpayment(uuid,numeric);
drop function if exists public.update_reservation(uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric,text);

create or replace function public.create_reservation(
  p_fb_name text,
  p_customer_name text,
  p_customer_address text,
  p_phone text,
  p_item_name text,
  p_item_code text,
  p_category_name text,
  p_quantity integer,
  p_price numeric,
  p_discount numeric,
  p_shipping_fee numeric,
  p_downpayment numeric,
  p_downpayment_method text,
  p_type text
)
returns table(order_id uuid, order_number text)
language plpgsql security definer set search_path=public
as $$
declare
  v_customer_id uuid;
  v_product_id uuid;
  v_category_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_prefix text;
  v_sequence integer;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
begin
  if not public.is_staff_or_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(btrim(p_customer_name),'') is null then raise exception 'Customer name is required'; end if;
  if nullif(btrim(p_item_name),'') is null then raise exception 'Item name is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price cannot be negative'; end if;
  if coalesce(p_discount,0) < 0 or coalesce(p_shipping_fee,0) < 0 or coalesce(p_downpayment,0) < 0 then
    raise exception 'Discount, shipping fee, and downpayment cannot be negative';
  end if;
  if lower(p_type) not in ('regular','pasabuy','cod') then raise exception 'Invalid reservation type'; end if;
  if coalesce(p_downpayment,0) > 0 and p_downpayment_method not in ('Cash','GCash','Maya','Bank Transfer','COD','Other') then
    raise exception 'A valid payment method is required for the downpayment';
  end if;

  v_subtotal := round(p_quantity * p_price, 2);
  v_total := round(v_subtotal - coalesce(p_discount,0), 2);
  if v_total < 0 then raise exception 'Discount cannot exceed subtotal'; end if;
  if coalesce(p_downpayment,0) > v_total + coalesce(p_shipping_fee,0) then raise exception 'Downpayment exceeds reservation total'; end if;

  select c.id into v_customer_id from public.customers c
  where lower(btrim(c.name))=lower(btrim(p_customer_name)) and not c.is_archived
  order by c.created_at limit 1 for update;
  if v_customer_id is null then
    insert into public.customers(name,fb_name,address,phone,created_by)
    values(btrim(p_customer_name),nullif(btrim(p_fb_name),''),nullif(btrim(p_customer_address),''),nullif(btrim(p_phone),''),auth.uid())
    returning id into v_customer_id;
  else
    update public.customers set fb_name=nullif(btrim(p_fb_name),''),address=nullif(btrim(p_customer_address),''),phone=nullif(btrim(p_phone),'') where id=v_customer_id;
  end if;

  if nullif(btrim(p_category_name),'') is not null then
    select c.id into v_category_id from public.categories c where lower(btrim(c.name))=lower(btrim(p_category_name)) limit 1;
    if v_category_id is null then insert into public.categories(name) values(btrim(p_category_name)) returning id into v_category_id; end if;
  end if;

  if nullif(btrim(p_item_code),'') is not null then
    select p.id into v_product_id from public.products p where lower(btrim(p.sku))=lower(btrim(p_item_code)) and p.is_active and not p.is_archived limit 1;
  end if;
  if v_product_id is null then
    select p.id into v_product_id from public.products p where lower(btrim(p.name))=lower(btrim(p_item_name)) and p.is_active and not p.is_archived limit 1;
  end if;
  if v_product_id is null then
    insert into public.products(name,sku,category_id,price,cost,stock,is_active,is_archived,created_by)
    values(btrim(p_item_name),nullif(btrim(p_item_code),''),v_category_id,p_price,0,0,true,false,auth.uid()) returning id into v_product_id;
  else
    update public.products set name=btrim(p_item_name),category_id=v_category_id,price=p_price,
      sku=coalesce(nullif(btrim(p_item_code),''),sku) where id=v_product_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.orders.order_number'));
  v_prefix := to_char(current_date,'YYYY-MMDD');
  select coalesce(max(substring(o.order_number from char_length(v_prefix)+1)::integer),0)+1 into v_sequence
  from public.orders o where o.order_number ~ ('^'||v_prefix||'[0-9]+$');
  v_order_number := v_prefix || lpad(v_sequence::text,2,'0');

  insert into public.orders(order_number,status,customer_id,total_amount,discount,shipping_fee,reservation_type,created_by)
  values(v_order_number,'reserved',v_customer_id,v_total,coalesce(p_discount,0),coalesce(p_shipping_fee,0),lower(p_type),auth.uid())
  returning id into v_order_id;
  insert into public.order_items(order_id,product_id,quantity,unit_price)
  values(v_order_id,v_product_id,p_quantity,round(p_price,2));
  if coalesce(p_downpayment,0)>0 then
    insert into public.order_payments(order_id,kind,amount,payment_method,recorded_by,created_at)
    values(v_order_id,'downpayment',round(p_downpayment,2),p_downpayment_method,auth.uid(),now());
  end if;
  return query select v_order_id,v_order_number;
end $$;

create or replace function public.update_reservation(
  p_order_id uuid,
  p_fb_name text,
  p_customer_name text,
  p_customer_address text,
  p_phone text,
  p_item_name text,
  p_item_code text,
  p_category_name text,
  p_quantity integer,
  p_price numeric,
  p_discount numeric,
  p_shipping_fee numeric,
  p_downpayment numeric,
  p_downpayment_method text,
  p_type text
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_product_id uuid;
  v_category_id uuid;
  v_item_id uuid;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
  v_grand_total numeric(12,2);
  v_current_downpayment numeric(12,2);
  v_total_paid numeric(12,2);
  v_payment_delta numeric(12,2);
begin
  if not public.is_staff_or_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_order from public.orders where id=p_order_id and archived_at is null for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_order.status::text <> 'reserved' then raise exception 'Only reserved orders can be edited'; end if;
  if p_quantity is null or p_quantity<=0 or p_price is null or p_price<0 then raise exception 'Invalid quantity or price'; end if;
  if lower(p_type) not in ('regular','pasabuy','cod') then raise exception 'Invalid reservation type'; end if;
  v_subtotal:=round(p_quantity*p_price,2); v_total:=round(v_subtotal-coalesce(p_discount,0),2);
  if v_total<0 or coalesce(p_shipping_fee,0)<0 then raise exception 'Invalid reservation totals'; end if;
  v_grand_total:=round(v_total+coalesce(p_shipping_fee,0),2);
  select
    coalesce(sum(amount) filter (where kind='downpayment'),0),
    coalesce(sum(amount),0)
  into v_current_downpayment,v_total_paid
  from public.order_payments where order_id=p_order_id;
  if coalesce(p_downpayment,0)<v_current_downpayment then
    raise exception 'Downpayment cannot be reduced because payment history is preserved';
  end if;
  if coalesce(p_downpayment,0)>v_grand_total then raise exception 'Downpayment exceeds reservation total'; end if;
  if v_total_paid>v_grand_total then raise exception 'Recorded payments exceed the edited reservation total'; end if;
  v_payment_delta:=round(coalesce(p_downpayment,0)-v_current_downpayment,2);
  if v_payment_delta>0 and p_downpayment_method not in ('Cash','GCash','Maya','Bank Transfer','COD','Other') then
    raise exception 'A valid payment method is required for the additional downpayment';
  end if;

  select id into v_customer_id from public.customers where lower(btrim(name))=lower(btrim(p_customer_name)) and not is_archived order by created_at limit 1;
  if v_customer_id is null then
    insert into public.customers(name,fb_name,address,phone,created_by) values(btrim(p_customer_name),nullif(btrim(p_fb_name),''),nullif(btrim(p_customer_address),''),nullif(btrim(p_phone),''),auth.uid()) returning id into v_customer_id;
  else
    update public.customers set fb_name=nullif(btrim(p_fb_name),''),address=nullif(btrim(p_customer_address),''),phone=nullif(btrim(p_phone),'') where id=v_customer_id;
  end if;
  if nullif(btrim(p_category_name),'') is not null then
    select id into v_category_id from public.categories where lower(btrim(name))=lower(btrim(p_category_name)) limit 1;
    if v_category_id is null then insert into public.categories(name) values(btrim(p_category_name)) returning id into v_category_id; end if;
  end if;
  if nullif(btrim(p_item_code),'') is not null then select id into v_product_id from public.products where lower(btrim(sku))=lower(btrim(p_item_code)) and is_active and not is_archived limit 1; end if;
  if v_product_id is null then select id into v_product_id from public.products where lower(btrim(name))=lower(btrim(p_item_name)) and is_active and not is_archived limit 1; end if;
  if v_product_id is null then
    insert into public.products(name,sku,category_id,price,cost,stock,is_active,is_archived,created_by) values(btrim(p_item_name),nullif(btrim(p_item_code),''),v_category_id,p_price,0,0,true,false,auth.uid()) returning id into v_product_id;
  else
    update public.products set name=btrim(p_item_name),sku=coalesce(nullif(btrim(p_item_code),''),sku),category_id=v_category_id,price=p_price where id=v_product_id;
  end if;
  update public.orders set customer_id=v_customer_id,total_amount=v_total,discount=coalesce(p_discount,0),shipping_fee=coalesce(p_shipping_fee,0),reservation_type=lower(p_type) where id=p_order_id;
  select id into v_item_id from public.order_items where order_id=p_order_id order by created_at limit 1;
  if v_item_id is null then
    insert into public.order_items(order_id,product_id,quantity,unit_price) values(p_order_id,v_product_id,p_quantity,round(p_price,2));
  else
    update public.order_items set product_id=v_product_id,quantity=p_quantity,unit_price=round(p_price,2) where id=v_item_id;
  end if;
  if v_payment_delta>0 then
    insert into public.order_payments(order_id,kind,amount,payment_method,recorded_by,created_at)
    values(p_order_id,'downpayment',v_payment_delta,p_downpayment_method,auth.uid(),now());
  end if;
  if v_total_paid+v_payment_delta>=v_grand_total then perform public.mark_order_paid(p_order_id); end if;
  return p_order_id;
end $$;

create or replace function public.mark_order_paid(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_order public.orders%rowtype; v_paid numeric; v_due numeric;
begin
  if not public.is_staff_or_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status::text <> 'reserved' then raise exception 'Only reserved orders can be marked paid'; end if;
  select coalesce(sum(amount),0) into v_paid from public.order_payments where order_id=p_order_id;
  v_due:=round(v_order.total_amount+coalesce(v_order.shipping_fee,0),2);
  if v_paid < v_due then raise exception 'Payment ledger does not cover the reservation total'; end if;
  update public.orders set status='paid',paid_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,notes) values(p_order_id,'reserved','paid',auth.uid(),'Payment ledger fully settled');
  return p_order_id;
end $$;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default null,
  p_notes text default null
)
returns table(payment_id uuid,total_paid numeric,remaining_balance numeric,fully_paid boolean)
language plpgsql security definer set search_path=public
as $$
declare v_order public.orders%rowtype; v_before numeric; v_after numeric; v_total numeric; v_payment_id uuid;
begin
  if not public.is_staff_or_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_payment_method not in ('Cash','GCash','Maya','Bank Transfer','COD','Other') then raise exception 'Select a valid payment method'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  select * into v_order from public.orders where id=p_order_id and archived_at is null for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_order.status::text <> 'reserved' then raise exception 'Payments can only be recorded for active reservations'; end if;
  v_total:=round(v_order.total_amount+coalesce(v_order.shipping_fee,0),2);
  select coalesce(sum(amount),0) into v_before from public.order_payments where order_id=p_order_id;
  if p_amount > v_total-v_before then raise exception 'Payment amount cannot exceed the remaining balance'; end if;
  insert into public.order_payments(order_id,kind,amount,payment_method,reference_number,notes,recorded_by,created_at)
  values(p_order_id,case when p_amount >= v_total-v_before then 'balance'::public.payment_kind else 'downpayment'::public.payment_kind end,round(p_amount,2),p_payment_method,nullif(btrim(p_reference_number),''),nullif(btrim(p_notes),''),auth.uid(),now()) returning id into v_payment_id;
  v_after:=round(v_before+p_amount,2);
  if v_after>=v_total then perform public.mark_order_paid(p_order_id); end if;
  return query select v_payment_id,v_after,greatest(round(v_total-v_after,2),0),v_after>=v_total;
end $$;

grant execute on function public.create_reservation(text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.update_reservation(uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.record_order_payment(uuid,numeric,text,text,text) to authenticated;

notify pgrst, 'reload schema';
