-- ============================================================
-- Migration 0002: Orders domain
-- Customers, categories, products, orders, and order items
-- tables with Row Level Security. Uses role helpers from 0001.
-- Idempotent: safe to run again on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$
begin
  create type public.order_status as enum ('reserved', 'paid', 'shipped', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Customers
-- ------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fb_name text,
  address text,
  email text,
  phone text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is 'Customer directory for orders.';

-- Legacy-schema guard: an older install may have this table without
-- the columns below.
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists fb_name text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists is_archived boolean not null default false;
alter table public.customers add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists name text;
update public.customers set name = '' where name is null;
alter table public.customers alter column name set not null;

create index if not exists idx_customers_name on public.customers (name);

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is 'Product categories.';

alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists created_at timestamptz not null default now();
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.categories add column if not exists name text;
update public.categories set name = '' where name is null;
alter table public.categories alter column name set not null;

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category_id uuid references public.categories (id) on delete set null,
  price numeric(12, 2) not null default 0 check (price >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Product catalog with pricing and stock.';

alter table public.products add column if not exists name text;
update public.products set name = '' where name is null;
alter table public.products alter column name set not null;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists category_id uuid references public.categories (id) on delete set null;
alter table public.products add column if not exists price numeric(12, 2) not null default 0;
alter table public.products add column if not exists cost numeric(12, 2) not null default 0;
alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists is_archived boolean not null default false;
alter table public.products add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_name on public.products (name);

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status public.order_status not null default 'reserved',
  customer_id uuid not null references public.customers (id) on delete restrict,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  reservation_type text not null default 'regular' check (reservation_type in ('regular', 'pasabuy', 'cod')),
  notes text,
  reserved_until date,
  paid_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is 'Customer orders and their lifecycle status.';

alter table public.orders add column if not exists order_number text;
update public.orders set order_number = coalesce(order_number, '');
alter table public.orders alter column order_number set not null;
alter table public.orders add column if not exists status public.order_status not null default 'reserved';
alter table public.orders add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.orders add column if not exists total_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists discount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists shipping_fee numeric(12, 2) not null default 0;
alter table public.orders add column if not exists reservation_type text not null default 'regular';
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists reserved_until date;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created_at on public.orders (created_at);
create index if not exists idx_orders_customer on public.orders (customer_id);

-- ------------------------------------------------------------
-- Order items
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

comment on table public.order_items is 'Line items belonging to an order.';

alter table public.order_items add column if not exists order_id uuid references public.orders (id) on delete cascade;
alter table public.order_items add column if not exists product_id uuid references public.products (id) on delete set null;
alter table public.order_items add column if not exists quantity integer not null default 1;
alter table public.order_items add column if not exists unit_price numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists created_at timestamptz not null default now();

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_product on public.order_items (product_id);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- - Any authenticated user can read.
-- - Only staff/admins can write.
-- ------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Authenticated users can view customers"
  on public.customers;
create policy "Authenticated users can view customers"
  on public.customers for select to authenticated using (true);
drop policy if exists "Staff can insert customers"
  on public.customers;
create policy "Staff can insert customers"
  on public.customers for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update customers"
  on public.customers;
create policy "Staff can update customers"
  on public.customers for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete customers"
  on public.customers;
create policy "Admins can delete customers"
  on public.customers for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated users can view categories"
  on public.categories;
create policy "Authenticated users can view categories"
  on public.categories for select to authenticated using (true);
drop policy if exists "Staff can insert categories"
  on public.categories;
create policy "Staff can insert categories"
  on public.categories for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update categories"
  on public.categories;
create policy "Staff can update categories"
  on public.categories for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete categories"
  on public.categories;
create policy "Admins can delete categories"
  on public.categories for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated users can view products"
  on public.products;
create policy "Authenticated users can view products"
  on public.products for select to authenticated using (true);
drop policy if exists "Staff can insert products"
  on public.products;
create policy "Staff can insert products"
  on public.products for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update products"
  on public.products;
create policy "Staff can update products"
  on public.products for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete products"
  on public.products;
create policy "Admins can delete products"
  on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated users can view orders"
  on public.orders;
create policy "Authenticated users can view orders"
  on public.orders for select to authenticated using (true);
drop policy if exists "Staff can insert orders"
  on public.orders;
create policy "Staff can insert orders"
  on public.orders for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update orders"
  on public.orders;
create policy "Staff can update orders"
  on public.orders for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete orders"
  on public.orders;
create policy "Admins can delete orders"
  on public.orders for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated users can view order items"
  on public.order_items;
create policy "Authenticated users can view order items"
  on public.order_items for select to authenticated using (true);
drop policy if exists "Staff can insert order items"
  on public.order_items;
create policy "Staff can insert order items"
  on public.order_items for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update order items"
  on public.order_items;
create policy "Staff can update order items"
  on public.order_items for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete order items"
  on public.order_items;
create policy "Admins can delete order items"
  on public.order_items for delete to authenticated using (public.is_admin());
