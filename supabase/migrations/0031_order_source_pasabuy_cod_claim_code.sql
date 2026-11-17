-- ============================================================
-- Migration: 0031_order_source_pasabuy_cod_claim_code.sql
--
-- 1. orders.order_source: 'live' or 'chat' (where the order was taken).
-- 2. orders.is_pasabuy_cod: marks a COD order as Pasabuy. Only meaningful
--    when reservation_type = 'cod'. A separate flag because reservation_type
--    holds a single value.
-- 3. orders.claim_code: code needed to claim COD money (typed in by staff).
--    Unique across orders when set.
-- Setters are staff-only RPCs, following the migration 0028/0030 pattern.
-- No existing rows are modified.
-- ============================================================

alter table public.orders add column if not exists order_source text;
alter table public.orders add column if not exists is_pasabuy_cod boolean not null default false;
alter table public.orders add column if not exists claim_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_order_source_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_source_check
      check (order_source is null or order_source in ('live', 'chat'));
  end if;
end $$;

create unique index if not exists orders_claim_code_key
  on public.orders (claim_code)
  where claim_code is not null;

comment on column public.orders.order_source is 'Where the order was taken: live or chat.';
comment on column public.orders.is_pasabuy_cod is 'True when a COD order is also a Pasabuy order.';
comment on column public.orders.claim_code is 'Code needed to claim the COD money. Typed in by staff; unique when set.';

-- Order source ----------------------------------------------------------
create or replace function public.set_order_source(p_order_id uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := nullif(lower(btrim(coalesce(p_source, ''))), '');
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to update the order source' using errcode = '42501';
  end if;

  if v_source is not null and v_source not in ('live', 'chat') then
    raise exception 'Order source must be live or chat';
  end if;

  update public.orders set order_source = v_source
  where id = p_order_id and archived_at is null;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  return p_order_id;
end;
$$;

grant execute on function public.set_order_source(uuid, text) to authenticated;

-- Pasabuy COD flag -----------------------------------------------------
create or replace function public.set_order_pasabuy_cod(p_order_id uuid, p_value boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to update the COD type' using errcode = '42501';
  end if;

  select * into rec from public.orders
  where id = p_order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.reservation_type is distinct from 'cod' then
    raise exception 'Pasabuy COD can only be set on COD orders';
  end if;

  update public.orders set is_pasabuy_cod = coalesce(p_value, false) where id = p_order_id;
  return p_order_id;
end;
$$;

grant execute on function public.set_order_pasabuy_cod(uuid, boolean) to authenticated;

-- Claim code -------------------------------------------------------------
create or replace function public.set_order_claim_code(p_order_id uuid, p_claim_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
  v_code text := nullif(btrim(coalesce(p_claim_code, '')), '');
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to update claim codes' using errcode = '42501';
  end if;

  if v_code is not null and length(v_code) > 50 then
    raise exception 'Claim code must be 50 characters or fewer';
  end if;

  select * into rec from public.orders
  where id = p_order_id and archived_at is null
  for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.reservation_type is distinct from 'cod' then
    raise exception 'Claim codes can only be set on COD orders';
  end if;

  if v_code is not null and exists (
    select 1 from public.orders
    where claim_code = v_code and id <> p_order_id
  ) then
    raise exception 'That claim code is already used by another order';
  end if;

  update public.orders set claim_code = v_code where id = p_order_id;
  return p_order_id;
end;
$$;

grant execute on function public.set_order_claim_code(uuid, text) to authenticated;
