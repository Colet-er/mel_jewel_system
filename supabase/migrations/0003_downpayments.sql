-- ============================================================
-- Migration 0003: Downpayments
-- Order payments table used as the source of truth for
-- downpayment settlement, plus helper functions.
-- Idempotent: safe to run again on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$
begin
  create type public.payment_kind as enum ('downpayment', 'balance');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Order payments
-- ------------------------------------------------------------
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.payment_kind not null default 'downpayment',
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'COD', 'Other')),
  reference_number text,
  notes text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.order_payments is 'Payments recorded against an order (downpayments and balance payments).';

-- Legacy-schema guards: an older install may have this table without
-- some columns, or with kind stored as plain text.
alter table public.order_payments add column if not exists payment_method text;
update public.order_payments
set payment_method = 'Other'
where payment_method is null or btrim(payment_method) = '';
alter table public.order_payments alter column payment_method set not null;
alter table public.order_payments add column if not exists reference_number text;
alter table public.order_payments add column if not exists notes text;
alter table public.order_payments add column if not exists recorded_by uuid references auth.users (id) on delete set null;
alter table public.order_payments add column if not exists created_at timestamptz not null default now();

do $$
declare
  col_count int;
  kind_type text;
begin
  select count(*) into col_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'order_payments'
    and column_name = 'kind';

  if col_count = 0 then
    alter table public.order_payments
      add column kind public.payment_kind not null default 'downpayment';
  else
    select data_type into kind_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_payments'
      and column_name = 'kind';

    -- USER-DEFINED means the enum; anything else (text, etc.) is legacy.
    if kind_type <> 'USER-DEFINED' then
      update public.order_payments set kind = 'downpayment' where btrim(kind) = '';
      alter table public.order_payments alter column kind drop default;
      alter table public.order_payments alter column kind type public.payment_kind
        using lower(btrim(kind))::public.payment_kind;
      alter table public.order_payments alter column kind set default 'downpayment';
    end if;
  end if;
end $$;

alter table public.order_payments add column if not exists amount numeric(12, 2);
update public.order_payments set amount = 0 where amount is null;
alter table public.order_payments alter column amount set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) = 'CHECK (amount > 0)'
  ) then
    alter table public.order_payments
      add constraint order_payments_amount_check check (amount > 0);
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_order_payments_order on public.order_payments (order_id);
create index if not exists idx_order_payments_kind on public.order_payments (kind);

-- Optional receipt metadata; binary objects live in the private
-- payment-evidence Storage bucket created by migration 0013.
create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_evidence_payment on public.payment_evidence (payment_id);

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
-- Required downpayment is 50% of the order total.
drop function if exists public.required_downpayment(numeric);
create or replace function public.required_downpayment(order_total numeric)
returns numeric
language sql
immutable
as $$
  select round(order_total * 0.50, 2);
$$;

comment on function public.required_downpayment(numeric)
  is 'Required downpayment amount for a given order total.';

-- An order''s downpayment is settled when the sum of its recorded
-- downpayment payments reaches the required downpayment.
drop function if exists public.downpayment_settled(uuid);
create or replace function public.downpayment_settled(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(op.amount)
    from public.order_payments op
    where op.order_id = p_order_id and op.kind = 'downpayment'
  ), 0) >= public.required_downpayment((
    select o.total_amount from public.orders o where o.id = p_order_id
  ));
$$;

comment on function public.downpayment_settled(uuid)
  is 'True once recorded downpayment payments cover the required downpayment.';

-- ------------------------------------------------------------
-- Row Level Security
-- - Any authenticated user can read.
-- - Only staff/admins can write; only admins can delete.
-- ------------------------------------------------------------
alter table public.order_payments enable row level security;
alter table public.payment_evidence enable row level security;

drop policy if exists "Authenticated users can view order payments"
  on public.order_payments;
create policy "Authenticated users can view order payments"
  on public.order_payments for select to authenticated using (true);
drop policy if exists "Staff can insert order payments"
  on public.order_payments;
create policy "Staff can insert order payments"
  on public.order_payments for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Staff can update order payments"
  on public.order_payments;
create policy "Staff can update order payments"
  on public.order_payments for update to authenticated using (public.is_staff_or_admin());
drop policy if exists "Admins can delete order payments"
  on public.order_payments;
create policy "Admins can delete order payments"
  on public.order_payments for delete to authenticated using (public.is_admin());

-- Same security model as order_payments: authenticated reads,
-- staff/admin inserts, and admin-only deletes.
drop policy if exists "Authenticated users can view payment evidence metadata" on public.payment_evidence;
create policy "Authenticated users can view payment evidence metadata"
  on public.payment_evidence for select to authenticated using (true);
drop policy if exists "Staff can insert payment evidence metadata" on public.payment_evidence;
create policy "Staff can insert payment evidence metadata"
  on public.payment_evidence for insert to authenticated with check (public.is_staff_or_admin());
drop policy if exists "Admins can delete payment evidence metadata" on public.payment_evidence;
create policy "Admins can delete payment evidence metadata"
  on public.payment_evidence for delete to authenticated using (public.is_admin());
