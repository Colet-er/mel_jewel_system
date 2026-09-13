-- ============================================================
-- Migration 0004: Reservation finalization
-- Soft-delete (archived_at), paid_at, order status history,
-- and the mark_order_paid() finalizer used by bulk actions.
-- Idempotent: safe to run again on an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- Orders: soft delete + paid timestamp
-- ------------------------------------------------------------
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;

comment on column public.orders.archived_at is 'Set when the order is archived (soft-deleted). Null means active.';
comment on column public.orders.paid_at is 'Timestamp of full payment/finalization.';

-- ------------------------------------------------------------
-- Status history
-- ------------------------------------------------------------
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.order_status_history is 'Audit trail of order status transitions.';

create index if not exists idx_order_status_history_order on public.order_status_history (order_id);

alter table public.order_status_history enable row level security;

drop policy if exists "Authenticated users can view status history"
  on public.order_status_history;
create policy "Authenticated users can view status history"
  on public.order_status_history for select to authenticated using (true);

-- Writes happen only through the security definer function below.

-- ------------------------------------------------------------
-- Finalizer: changes workflow state only after the payment ledger
-- already covers the full reservation total.
-- ------------------------------------------------------------
drop function if exists public.mark_order_paid(uuid);
create or replace function public.mark_order_paid(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders%rowtype;
  paid_total numeric;
  order_total numeric;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Not authorized to mark orders as paid' using errcode = '42501';
  end if;

  select * into rec
  from public.orders
  where id = p_order_id and archived_at is null
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if rec.status <> 'reserved' then
    raise exception 'Only reserved orders can be marked as paid';
  end if;

  select coalesce(sum(amount), 0) into paid_total
  from public.order_payments
  where order_id = p_order_id;

  order_total := round(rec.total_amount + coalesce(rec.shipping_fee, 0), 2);
  if paid_total < order_total then
    raise exception 'Payment ledger does not cover the reservation total';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, rec.status, 'paid', auth.uid());

  return p_order_id;
end;
$$;

comment on function public.mark_order_paid(uuid)
  is 'Finalizes a fully settled reservation without fabricating payment rows. Staff/admin only.';
