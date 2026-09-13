-- ============================================================
-- Migration 0015: New Features
-- - Add claimed and rto order statuses
-- - Commission tracking table
-- - Moissanite inventory (sku) and sold tracking
-- - Collections tracking
-- Idempotent: safe to run again on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- Extend order_status enum with claimed and rto
-- ------------------------------------------------------------
do $$
begin
  -- Add 'claimed' if not exists
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'claimed'
    and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'claimed';
  end if;

  -- Add 'rto' if not exists (Return to Origin)
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'rto'
    and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'rto';
  end if;
end $$;

comment on type public.order_status is 'Order lifecycle status: reserved, paid, shipped, claimed, cancelled, rto.';

-- ------------------------------------------------------------
-- Orders: Add RTO and claimed timestamps, RTO reason/notes
-- ------------------------------------------------------------
alter table public.orders add column if not exists claimed_at timestamptz;
alter table public.orders add column if not exists rto_at timestamptz;
alter table public.orders add column if not exists rto_reason text;
alter table public.orders add column if not exists rto_notes text;

comment on column public.orders.claimed_at is 'When the order was marked as claimed/received by customer.';
comment on column public.orders.rto_at is 'When the order was marked as Return to Origin.';
comment on column public.orders.rto_reason is 'Reason for RTO (e.g., failed delivery, refused, address issue).';
comment on column public.orders.rto_notes is 'Additional notes for RTO.';

create index if not exists idx_orders_claimed_at on public.orders (claimed_at);
create index if not exists idx_orders_rto_at on public.orders (rto_at);

-- Backfill claimed_at from status history for existing claimed orders (if any)
update public.orders o
set claimed_at = h.created_at
from (
  select distinct on (order_id) order_id, created_at
  from public.order_status_history
  where to_status = 'claimed'
  order by order_id, created_at desc
) h
where o.id = h.order_id
  and o.claimed_at is null;

-- Backfill rto_at from status history for existing rto orders (if any)
update public.orders o
set rto_at = h.created_at
from (
  select distinct on (order_id) order_id, created_at
  from public.order_status_history
  where to_status = 'rto'
  order by order_id, created_at desc
) h
where o.id = h.order_id
  and o.rto_at is null;

-- ------------------------------------------------------------
-- Commission table for worker commissions
-- ------------------------------------------------------------
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  date date not null default current_date,
  related_order_id uuid references public.orders (id) on delete set null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('paid', 'unpaid')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.commissions is 'Worker commission records.';

create index if not exists idx_commissions_worker on public.commissions (worker_name);
create index if not exists idx_commissions_date on public.commissions (date);
create index if not exists idx_commissions_status on public.commissions (status);
create index if not exists idx_commissions_order on public.commissions (related_order_id);

-- ------------------------------------------------------------
-- Commission: updated_at trigger
-- ------------------------------------------------------------
drop trigger if exists trg_commissions_updated_at on public.commissions;
create trigger trg_commissions_updated_at
  before update on public.commissions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Commission: RLS
-- ------------------------------------------------------------
alter table public.commissions enable row level security;

drop policy if exists "Authenticated users can view commissions" on public.commissions;
create policy "Authenticated users can view commissions"
  on public.commissions for select to authenticated using (true);

drop policy if exists "Staff can insert commissions" on public.commissions;
create policy "Staff can insert commissions"
  on public.commissions for insert to authenticated with check (public.is_staff_or_admin());

drop policy if exists "Staff can update commissions" on public.commissions;
create policy "Staff can update commissions"
  on public.commissions for update to authenticated using (public.is_staff_or_admin());

drop policy if exists "Admins can delete commissions" on public.commissions;
create policy "Admins can delete commissions"
  on public.commissions for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Moissanite SKU (inventory) table
-- Separate from products for specialized Moissanite tracking
-- ------------------------------------------------------------
create table if not exists public.moissanite_skus (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  item_name text not null,
  description text,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  available_stock integer not null default 0 check (available_stock >= 0),
  status text not null default 'active' check (status in ('active', 'low_stock', 'out_of_stock', 'archived')),
  category_id uuid references public.categories (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.moissanite_skus is 'Moissanite inventory SKU records - source of truth for Moissanite stock.';

create index if not exists idx_moissanite_skus_sku on public.moissanite_skus (sku);
create index if not exists idx_moissanite_skus_status on public.moissanite_skus (status);
create index if not exists idx_moissanite_skus_category on public.moissanite_skus (category_id);

-- ------------------------------------------------------------
-- Moissanite SKU: updated_at trigger
-- ------------------------------------------------------------
drop trigger if exists trg_moissanite_skus_updated_at on public.moissanite_skus;
create trigger trg_moissanite_skus_updated_at
  before update on public.moissanite_skus
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Moissanite SKU: RLS
-- ------------------------------------------------------------
alter table public.moissanite_skus enable row level security;

drop policy if exists "Authenticated users can view moissanite skus" on public.moissanite_skus;
create policy "Authenticated users can view moissanite skus"
  on public.moissanite_skus for select to authenticated using (true);

drop policy if exists "Staff can insert moissanite skus" on public.moissanite_skus;
create policy "Staff can insert moissanite skus"
  on public.moissanite_skus for insert to authenticated with check (public.is_staff_or_admin());

drop policy if exists "Staff can update moissanite skus" on public.moissanite_skus;
create policy "Staff can update moissanite skus"
  on public.moissanite_skus for update to authenticated using (public.is_staff_or_admin());

drop policy if exists "Admins can delete moissanite skus" on public.moissanite_skus;
create policy "Admins can delete moissanite skus"
  on public.moissanite_skus for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Sold Moissanite transactions table
-- Tracks sold Moissanite items (separate from orders)
-- ------------------------------------------------------------
create table if not exists public.sold_moissanite (
  id uuid primary key default gen_random_uuid(),
  date_sold date not null default current_date,
  invoice_number text not null,
  sku_id uuid not null references public.moissanite_skus (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,
  quantity integer not null check (quantity > 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  total_amount numeric(12, 2) generated always as (quantity * selling_price) stored,
  status text not null default 'completed' check (status in ('completed', 'pending', 'refunded')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sold_moissanite is 'Sold Moissanite transaction records.';

create index if not exists idx_sold_moissanite_date on public.sold_moissanite (date_sold);
create index if not exists idx_sold_moissanite_invoice on public.sold_moissanite (invoice_number);
create index if not exists idx_sold_moissanite_sku on public.sold_moissanite (sku_id);
create index if not exists idx_sold_moissanite_customer on public.sold_moissanite (customer_id);
create index if not exists idx_sold_moissanite_status on public.sold_moissanite (status);

-- ------------------------------------------------------------
-- Sold Moissanite: updated_at trigger
-- ------------------------------------------------------------
drop trigger if exists trg_sold_moissanite_updated_at on public.sold_moissanite;
create trigger trg_sold_moissanite_updated_at
  before update on public.sold_moissanite
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Sold Moissanite: RLS
-- ------------------------------------------------------------
alter table public.sold_moissanite enable row level security;

drop policy if exists "Authenticated users can view sold moissanite" on public.sold_moissanite;
create policy "Authenticated users can view sold moissanite"
  on public.sold_moissanite for select to authenticated using (true);

drop policy if exists "Staff can insert sold moissanite" on public.sold_moissanite;
create policy "Staff can insert sold moissanite"
  on public.sold_moissanite for insert to authenticated with check (public.is_staff_or_admin());

drop policy if exists "Staff can update sold moissanite" on public.sold_moissanite;
create policy "Staff can update sold moissanite"
  on public.sold_moissanite for update to authenticated using (public.is_staff_or_admin());

drop policy if exists "Admins can delete sold moissanite" on public.sold_moissanite;
create policy "Admins can delete sold moissanite"
  on public.sold_moissanite for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Collections tracking table
-- Separate from normal Paid page for collection monitoring
-- ------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'COD', 'Other')),
  reference_number text,
  notes text,
  collected_by uuid references auth.users (id) on delete set null,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.collections is 'Collection records for monitoring payments/collections separately.';

create index if not exists idx_collections_order on public.collections (order_id);
create index if not exists idx_collections_customer on public.collections (customer_id);
create index if not exists idx_collections_collected_at on public.collections (collected_at);
create index if not exists idx_collections_collected_by on public.collections (collected_by);

-- ------------------------------------------------------------
-- Collections: RLS
-- ------------------------------------------------------------
alter table public.collections enable row level security;

drop policy if exists "Authenticated users can view collections" on public.collections;
create policy "Authenticated users can view collections"
  on public.collections for select to authenticated using (true);

drop policy if exists "Staff can insert collections" on public.collections;
create policy "Staff can insert collections"
  on public.collections for insert to authenticated with check (public.is_staff_or_admin());

drop policy if exists "Staff can update collections" on public.collections;
create policy "Staff can update collections"
  on public.collections for update to authenticated using (public.is_staff_or_admin());

drop policy if exists "Admins can delete collections" on public.collections;
create policy "Admins can delete collections"
  on public.collections for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Helper functions for new statuses
-- ------------------------------------------------------------

-- mark_order_claimed(): transitions a shipped order to claimed
drop function if exists public.mark_order_claimed(uuid);
create or replace function public.mark_order_claimed(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to claim orders' using errcode = '42501';
  end if;

  select * into rec
  from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status <> 'shipped' then
    raise exception 'Only shipped orders can be marked as claimed';
  end if;

  update public.orders
  set status = 'claimed',
      claimed_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, rec.status, 'claimed', auth.uid());

  return p_order_id;
end;
$$;

comment on function public.mark_order_claimed(uuid)
  is 'Marks a shipped order as claimed/received by customer and writes status history. Any authenticated user.';

-- mark_order_rto(): transitions an order to RTO (can be from shipped or paid)
drop function if exists public.mark_order_rto(uuid, text, text);
create or replace function public.mark_order_rto(p_order_id uuid, p_reason text default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to mark orders as RTO' using errcode = '42501';
  end if;

  select * into rec
  from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status not in ('paid', 'shipped') then
    raise exception 'Only paid or shipped orders can be marked as RTO';
  end if;

  update public.orders
  set status = 'rto',
      rto_at = now(),
      rto_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      rto_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, rec.status, 'rto', auth.uid());

  return p_order_id;
end;
$$;

comment on function public.mark_order_rto(uuid, text, text)
  is 'Marks a paid/shipped order as Return to Origin with reason and notes. Staff/admin only.';

grant execute on function public.mark_order_claimed(uuid) to authenticated;
grant execute on function public.mark_order_rto(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
