-- ============================================================
-- Migration: 0023_multi_item_reservations.sql
-- Support multi-item bulk ordering in create_reservation and update_reservation RPCs.
-- Accepts p_items jsonb (array of { item_name, item_code, category_name, quantity, price })
-- while preserving backward compatibility with single-item parameters.
-- ============================================================

drop function if exists public.create_reservation(text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text);
drop function if exists public.create_reservation(text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text,jsonb);

create or replace function public.create_reservation(
  p_fb_name text,
  p_customer_name text,
  p_customer_address text,
  p_phone text,
  p_item_name text default null,
  p_item_code text default null,
  p_category_name text default null,
  p_quantity integer default 1,
  p_price numeric default 0,
  p_discount numeric default 0,
  p_shipping_fee numeric default 0,
  p_downpayment numeric default 0,
  p_downpayment_method text default null,
  p_type text default 'regular',
  p_items jsonb default null
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
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item jsonb;
  v_line_name text;
  v_line_code text;
  v_line_category text;
  v_line_qty integer;
  v_line_price numeric(12,2);
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if nullif(btrim(p_customer_name),'') is null then
    raise exception 'Customer name is required';
  end if;

  if lower(p_type) not in ('regular','pasabuy','cod') then
    raise exception 'Invalid reservation type';
  end if;

  if coalesce(p_discount,0) < 0 or coalesce(p_shipping_fee,0) < 0 or coalesce(p_downpayment,0) < 0 then
    raise exception 'Discount, shipping fee, and downpayment cannot be negative';
  end if;

  if coalesce(p_downpayment,0) > 0 and p_downpayment_method not in ('Cash','GCash','Maya','Bank Transfer','COD','Other') then
    raise exception 'A valid payment method is required for the downpayment';
  end if;

  -- Calculate subtotal across items
  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_line_name := btrim(coalesce(v_item->>'item_name', ''));
      v_line_qty := coalesce((v_item->>'quantity')::integer, 0);
      v_line_price := coalesce((v_item->>'price')::numeric, 0);

      if v_line_name = '' then
        raise exception 'Item name is required';
      end if;
      if v_line_qty <= 0 then
        raise exception 'Quantity must be greater than zero';
      end if;
      if v_line_price < 0 then
        raise exception 'Price cannot be negative';
      end if;

      v_subtotal := v_subtotal + round(v_line_qty * v_line_price, 2);
    end loop;
  else
    if nullif(btrim(p_item_name),'') is null then
      raise exception 'Item name is required';
    end if;
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;
    if p_price is null or p_price < 0 then
      raise exception 'Price cannot be negative';
    end if;
    v_subtotal := round(p_quantity * p_price, 2);
  end if;

  v_total := round(v_subtotal - coalesce(p_discount,0), 2);
  if v_total < 0 then
    raise exception 'Discount cannot exceed subtotal';
  end if;
  if coalesce(p_downpayment,0) > v_total + coalesce(p_shipping_fee,0) then
    raise exception 'Downpayment exceeds reservation total';
  end if;

  -- Upsert Customer
  select c.id into v_customer_id
  from public.customers c
  where lower(btrim(c.name)) = lower(btrim(p_customer_name)) and not c.is_archived
  order by c.created_at limit 1 for update;

  if v_customer_id is null then
    insert into public.customers(name, fb_name, address, phone, created_by)
    values(btrim(p_customer_name), nullif(btrim(p_fb_name),''), nullif(btrim(p_customer_address),''), nullif(btrim(p_phone),''), auth.uid())
    returning id into v_customer_id;
  else
    update public.customers
    set fb_name = nullif(btrim(p_fb_name),''),
        address = nullif(btrim(p_customer_address),''),
        phone = nullif(btrim(p_phone),'')
    where id = v_customer_id;
  end if;

  -- Order sequence & number
  perform pg_advisory_xact_lock(hashtext('public.orders.order_number'));
  v_prefix := to_char(current_date, 'YYYY-MMDD');
  select coalesce(max(substring(o.order_number from char_length(v_prefix)+1)::integer), 0) + 1 into v_sequence
  from public.orders o where o.order_number ~ ('^'||v_prefix||'[0-9]+$');
  v_order_number := v_prefix || lpad(v_sequence::text, 2, '0');

  insert into public.orders(order_number, status, customer_id, total_amount, discount, shipping_fee, reservation_type, created_by)
  values(v_order_number, 'reserved', v_customer_id, v_total, coalesce(p_discount,0), coalesce(p_shipping_fee,0), lower(p_type), auth.uid())
  returning id into v_order_id;

  -- Insert Order Items
  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_line_name := btrim(coalesce(v_item->>'item_name', ''));
      v_line_code := nullif(btrim(coalesce(v_item->>'item_code', '')), '');
      v_line_category := nullif(btrim(coalesce(v_item->>'category_name', '')), '');
      v_line_qty := coalesce((v_item->>'quantity')::integer, 1);
      v_line_price := coalesce((v_item->>'price')::numeric, 0);

      v_category_id := null;
      if v_line_category is not null then
        select c.id into v_category_id from public.categories c where lower(btrim(c.name)) = lower(btrim(v_line_category)) limit 1;
        if v_category_id is null then
          insert into public.categories(name) values(btrim(v_line_category)) returning id into v_category_id;
        end if;
      end if;

      v_product_id := null;
      if v_line_code is not null then
        select p.id into v_product_id from public.products p where lower(btrim(p.sku)) = lower(btrim(v_line_code)) and p.is_active and not p.is_archived limit 1;
      end if;
      if v_product_id is null then
        select p.id into v_product_id from public.products p where lower(btrim(p.name)) = lower(btrim(v_line_name)) and p.is_active and not p.is_archived limit 1;
      end if;
      if v_product_id is null then
        insert into public.products(name, sku, category_id, price, cost, stock, is_active, is_archived, created_by)
        values(v_line_name, v_line_code, v_category_id, v_line_price, 0, 0, true, false, auth.uid())
        returning id into v_product_id;
      else
        update public.products
        set name = v_line_name,
            category_id = coalesce(v_category_id, category_id),
            price = v_line_price,
            sku = coalesce(v_line_code, sku)
        where id = v_product_id;
      end if;

      insert into public.order_items(order_id, product_id, quantity, unit_price)
      values(v_order_id, v_product_id, v_line_qty, round(v_line_price, 2));
    end loop;
  else
    if nullif(btrim(p_category_name),'') is not null then
      select c.id into v_category_id from public.categories c where lower(btrim(c.name)) = lower(btrim(p_category_name)) limit 1;
      if v_category_id is null then
        insert into public.categories(name) values(btrim(p_category_name)) returning id into v_category_id;
      end if;
    end if;

    if nullif(btrim(p_item_code),'') is not null then
      select p.id into v_product_id from public.products p where lower(btrim(p.sku)) = lower(btrim(p_item_code)) and p.is_active and not p.is_archived limit 1;
    end if;
    if v_product_id is null then
      select p.id into v_product_id from public.products p where lower(btrim(p.name)) = lower(btrim(p_item_name)) and p.is_active and not p.is_archived limit 1;
    end if;
    if v_product_id is null then
      insert into public.products(name, sku, category_id, price, cost, stock, is_active, is_archived, created_by)
      values(btrim(p_item_name), nullif(btrim(p_item_code),''), v_category_id, p_price, 0, 0, true, false, auth.uid())
      returning id into v_product_id;
    else
      update public.products
      set name = btrim(p_item_name),
          category_id = coalesce(v_category_id, category_id),
          price = p_price,
          sku = coalesce(nullif(btrim(p_item_code),''), sku)
      where id = v_product_id;
    end if;

    insert into public.order_items(order_id, product_id, quantity, unit_price)
    values(v_order_id, v_product_id, p_quantity, round(p_price, 2));
  end if;

  if coalesce(p_downpayment,0) > 0 then
    insert into public.order_payments(order_id, kind, amount, payment_method, recorded_by, created_at)
    values(v_order_id, 'downpayment', round(p_downpayment,2), p_downpayment_method, auth.uid(), now());
  end if;

  return query select v_order_id, v_order_number;
end $$;

drop function if exists public.update_reservation(uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text);
drop function if exists public.update_reservation(uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric,numeric,text,text,jsonb);

create or replace function public.update_reservation(
  p_order_id uuid,
  p_fb_name text,
  p_customer_name text,
  p_customer_address text,
  p_phone text,
  p_item_name text default null,
  p_item_code text default null,
  p_category_name text default null,
  p_quantity integer default 1,
  p_price numeric default 0,
  p_discount numeric default 0,
  p_shipping_fee numeric default 0,
  p_downpayment numeric default 0,
  p_downpayment_method text default null,
  p_type text default 'regular',
  p_items jsonb default null
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_product_id uuid;
  v_category_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_grand_total numeric(12,2);
  v_current_downpayment numeric(12,2);
  v_total_paid numeric(12,2);
  v_payment_delta numeric(12,2);
  v_item jsonb;
  v_line_name text;
  v_line_code text;
  v_line_category text;
  v_line_qty integer;
  v_line_price numeric(12,2);
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into v_order from public.orders where id = p_order_id and archived_at is null for update;
  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_order.status::text <> 'reserved' then
    raise exception 'Only reserved orders can be edited';
  end if;

  if lower(p_type) not in ('regular','pasabuy','cod') then
    raise exception 'Invalid reservation type';
  end if;

  -- Calculate subtotal
  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_line_name := btrim(coalesce(v_item->>'item_name', ''));
      v_line_qty := coalesce((v_item->>'quantity')::integer, 0);
      v_line_price := coalesce((v_item->>'price')::numeric, 0);

      if v_line_name = '' then
        raise exception 'Item name is required';
      end if;
      if v_line_qty <= 0 then
        raise exception 'Invalid quantity or price';
      end if;
      if v_line_price < 0 then
        raise exception 'Invalid quantity or price';
      end if;

      v_subtotal := v_subtotal + round(v_line_qty * v_line_price, 2);
    end loop;
  else
    if p_quantity is null or p_quantity <= 0 or p_price is null or p_price < 0 then
      raise exception 'Invalid quantity or price';
    end if;
    v_subtotal := round(p_quantity * p_price, 2);
  end if;

  v_total := round(v_subtotal - coalesce(p_discount,0), 2);
  if v_total < 0 or coalesce(p_shipping_fee,0) < 0 then
    raise exception 'Invalid reservation totals';
  end if;
  v_grand_total := round(v_total + coalesce(p_shipping_fee,0), 2);

  select
    coalesce(sum(amount) filter (where kind='downpayment'), 0),
    coalesce(sum(amount), 0)
  into v_current_downpayment, v_total_paid
  from public.order_payments where order_id = p_order_id;

  if coalesce(p_downpayment,0) < v_current_downpayment then
    raise exception 'Downpayment cannot be reduced because payment history is preserved';
  end if;
  if coalesce(p_downpayment,0) > v_grand_total then
    raise exception 'Downpayment exceeds reservation total';
  end if;
  if v_total_paid > v_grand_total then
    raise exception 'Recorded payments exceed the edited reservation total';
  end if;

  v_payment_delta := round(coalesce(p_downpayment,0) - v_current_downpayment, 2);
  if v_payment_delta > 0 and p_downpayment_method not in ('Cash','GCash','Maya','Bank Transfer','COD','Other') then
    raise exception 'A valid payment method is required for the additional downpayment';
  end if;

  -- Upsert Customer
  select id into v_customer_id from public.customers where lower(btrim(name)) = lower(btrim(p_customer_name)) and not is_archived order by created_at limit 1;
  if v_customer_id is null then
    insert into public.customers(name, fb_name, address, phone, created_by)
    values(btrim(p_customer_name), nullif(btrim(p_fb_name),''), nullif(btrim(p_customer_address),''), nullif(btrim(p_phone),''), auth.uid())
    returning id into v_customer_id;
  else
    update public.customers
    set fb_name = nullif(btrim(p_fb_name),''),
        address = nullif(btrim(p_customer_address),''),
        phone = nullif(btrim(p_phone),'')
    where id = v_customer_id;
  end if;

  -- Update Order
  update public.orders
  set customer_id = v_customer_id,
      total_amount = v_total,
      discount = coalesce(p_discount,0),
      shipping_fee = coalesce(p_shipping_fee,0),
      reservation_type = lower(p_type)
  where id = p_order_id;

  -- Replace Order Items
  delete from public.order_items where order_id = p_order_id;

  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_line_name := btrim(coalesce(v_item->>'item_name', ''));
      v_line_code := nullif(btrim(coalesce(v_item->>'item_code', '')), '');
      v_line_category := nullif(btrim(coalesce(v_item->>'category_name', '')), '');
      v_line_qty := coalesce((v_item->>'quantity')::integer, 1);
      v_line_price := coalesce((v_item->>'price')::numeric, 0);

      v_category_id := null;
      if v_line_category is not null then
        select c.id into v_category_id from public.categories c where lower(btrim(c.name)) = lower(btrim(v_line_category)) limit 1;
        if v_category_id is null then
          insert into public.categories(name) values(btrim(v_line_category)) returning id into v_category_id;
        end if;
      end if;

      v_product_id := null;
      if v_line_code is not null then
        select p.id into v_product_id from public.products p where lower(btrim(p.sku)) = lower(btrim(v_line_code)) and p.is_active and not p.is_archived limit 1;
      end if;
      if v_product_id is null then
        select p.id into v_product_id from public.products p where lower(btrim(p.name)) = lower(btrim(v_line_name)) and p.is_active and not p.is_archived limit 1;
      end if;
      if v_product_id is null then
        insert into public.products(name, sku, category_id, price, cost, stock, is_active, is_archived, created_by)
        values(v_line_name, v_line_code, v_category_id, v_line_price, 0, 0, true, false, auth.uid())
        returning id into v_product_id;
      else
        update public.products
        set name = v_line_name,
            category_id = coalesce(v_category_id, category_id),
            price = v_line_price,
            sku = coalesce(v_line_code, sku)
        where id = v_product_id;
      end if;

      insert into public.order_items(order_id, product_id, quantity, unit_price)
      values(p_order_id, v_product_id, v_line_qty, round(v_line_price, 2));
    end loop;
  else
    if nullif(btrim(p_category_name),'') is not null then
      select c.id into v_category_id from public.categories c where lower(btrim(c.name)) = lower(btrim(p_category_name)) limit 1;
      if v_category_id is null then
        insert into public.categories(name) values(btrim(p_category_name)) returning id into v_category_id;
      end if;
    end if;

    if nullif(btrim(p_item_code),'') is not null then
      select p.id into v_product_id from public.products p where lower(btrim(p.sku)) = lower(btrim(p_item_code)) and p.is_active and not p.is_archived limit 1;
    end if;
    if v_product_id is null then
      select p.id into v_product_id from public.products p where lower(btrim(p.name)) = lower(btrim(p_item_name)) and p.is_active and not p.is_archived limit 1;
    end if;
    if v_product_id is null then
      insert into public.products(name, sku, category_id, price, cost, stock, is_active, is_archived, created_by)
      values(btrim(p_item_name), nullif(btrim(p_item_code),''), v_category_id, p_price, 0, 0, true, false, auth.uid())
      returning id into v_product_id;
    else
      update public.products
      set name = btrim(p_item_name),
          sku = coalesce(nullif(btrim(p_item_code),''), sku),
          category_id = coalesce(v_category_id, category_id),
          price = p_price
      where id = v_product_id;
    end if;

    insert into public.order_items(order_id, product_id, quantity, unit_price)
    values(p_order_id, v_product_id, p_quantity, round(p_price, 2));
  end if;

  if v_payment_delta > 0 then
    insert into public.order_payments(order_id, kind, amount, payment_method, recorded_by, created_at)
    values(p_order_id, 'downpayment', v_payment_delta, p_downpayment_method, auth.uid(), now());
  end if;

  if v_total_paid + v_payment_delta >= v_grand_total and v_grand_total > 0 then
    perform public.mark_order_paid(p_order_id);
  end if;

  return p_order_id;
end $$;

grant execute on function public.create_reservation to authenticated;
grant execute on function public.update_reservation to authenticated;

notify pgrst, 'reload schema';
