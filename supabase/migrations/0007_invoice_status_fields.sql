-- ============================================================
-- Migration 0007: Auto invoice numbers & status lifecycle fields
-- - customers.fb_name for the FB Name field on the reservation form
-- - Server/database-side invoice number generation (YYYY-MMDDNN)
--   via a BEFORE INSERT trigger, serialized with an advisory lock
--   so concurrent inserts can never produce duplicates.
-- - orders.shipped_at / cancelled_at / cancellation_reason used by
--   the Paid, Shipped, and Cancelled status pages.
-- - mark_order_shipped() RPC mirroring mark_order_paid().
-- Idempotent: safe to run again on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- Customers: FB (Facebook) name captured on reservations
-- ------------------------------------------------------------
alter table public.customers add column if not exists fb_name text;

comment on column public.customers.fb_name is 'Facebook display name captured on reservations.';

-- ------------------------------------------------------------
-- Customers: legacy compatibility. Some databases predate the
-- repo migrations and use customer_name (NOT NULL) as the
-- display-name column while the application writes name.
-- Backfill name from customer_name, then keep both mirrored
-- with a BEFORE INSERT OR UPDATE trigger.
-- ------------------------------------------------------------
alter table public.customers add column if not exists name text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'customer_name'
  ) then
    -- Seed the app-facing column for rows created through the legacy path.
    update public.customers
    set name = customer_name
    where (name is null or btrim(name) = '')
      and customer_name is not null;

    execute $fn$
      create or replace function public.sync_customer_name()
      returns trigger
      language plpgsql
      set search_path = public
      as $body$
      begin
        if new.name is null or btrim(new.name) = '' then
          new.name := new.customer_name;
        end if;
        if new.customer_name is null or btrim(new.customer_name) = '' then
          new.customer_name := new.name;
        end if;
        return new;
      end;
      $body$;
    $fn$;

    drop trigger if exists trg_customers_sync_name on public.customers;
    create trigger trg_customers_sync_name
    before insert or update on public.customers
    for each row
    execute function public.sync_customer_name();
  end if;
end
$$;

-- ------------------------------------------------------------
-- Orders: lifecycle timestamps and cancellation reason
-- ------------------------------------------------------------
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;

comment on column public.orders.shipped_at is 'When the order was marked as shipped.';
comment on column public.orders.cancelled_at is 'When the order was cancelled.';
comment on column public.orders.cancellation_reason is 'Optional reason recorded when the order was cancelled.';

create index if not exists idx_orders_shipped_at on public.orders (shipped_at);
create index if not exists idx_orders_cancelled_at on public.orders (cancelled_at);

-- Ensure the audit trail has its timestamp (older installs may predate it),
-- then backfill cancelled_at from the existing status history.
alter table public.order_status_history
  add column if not exists created_at timestamptz not null default now();

update public.orders o
set cancelled_at = h.created_at
from (
  select distinct on (order_id) order_id, created_at
  from public.order_status_history
  where to_status = 'cancelled'
  order by order_id, created_at desc
) h
where o.id = h.order_id
  and o.cancelled_at is null;

-- ------------------------------------------------------------
-- Auto invoice number generation (YYYY-MMDDNN).
-- Runs as a BEFORE INSERT trigger inside the inserting
-- transaction; the transaction-scoped advisory lock serializes
-- concurrent assignments so the daily sequence is gap-free and
-- duplicate-free. The unique constraint on order_number remains
-- the final backstop (also covers manually entered numbers).
-- ------------------------------------------------------------
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prefix text;
  seq int;
begin
  -- Only fill in numbers the caller left blank; manual numbers pass through.
  if new.order_number is null or btrim(new.order_number) = '' then
    perform pg_advisory_xact_lock(hashtext('public.orders.order_number'));

    prefix := to_char(now(), 'YYYY-MMDD');

    select coalesce(max((substring(o.order_number from char_length(prefix) + 1))::int), 0) + 1
      into seq
      from public.orders o
      where o.order_number ~ ('^' || prefix || '[0-9]+$');

    new.order_number := prefix || lpad(coalesce(seq, 1)::text, 2, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_assign_invoice_number on public.orders;

create trigger trg_orders_assign_invoice_number
before insert on public.orders
for each row
when (new.order_number is null or btrim(new.order_number) = '')
execute function public.assign_invoice_number();

comment on function public.assign_invoice_number()
  is 'Assigns the next daily invoice number (YYYY-MMDDNN) when order_number is blank. Serialized via advisory lock to prevent duplicates.';

-- ------------------------------------------------------------
-- cancel_order(): accept an optional cancellation reason and
-- stamp cancelled_at. Signature stays backward compatible
-- (p_reason defaults to null).
-- ------------------------------------------------------------
drop function if exists public.cancel_order(uuid);
drop function if exists public.cancel_order(uuid, text);

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

  if rec.status <> 'reserved' then
    raise exception 'Only reserved orders can be cancelled';
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
  is 'Cancels a reserved order with an optional reason and writes status history. Staff/admin only.';

-- ------------------------------------------------------------
-- mark_order_shipped(): transitions a paid order to shipped,
-- stamping shipped_at and writing status history. Mirrors
-- mark_order_paid(): security definer so history can be
-- written, staff/admin only.
-- ------------------------------------------------------------
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

  if rec.status <> 'paid' then
    raise exception 'Only paid orders can be marked as shipped';
  end if;

  update public.orders
  set status = 'shipped',
      shipped_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, rec.status, 'shipped', auth.uid());

  return p_order_id;
end;
$$;

comment on function public.mark_order_shipped(uuid)
  is 'Marks a paid order as shipped and writes status history. Staff/admin only.';
