-- The legacy production orders table stores status as text with an
-- orders_status_check constraint that predates the claimed and RTO states.
-- Keep the constraint for data integrity, but align it with the complete
-- application workflow. No rows or status values are rewritten.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'status'
  ) then
    alter table public.orders
      drop constraint if exists orders_status_check;

    alter table public.orders
      add constraint orders_status_check
      check (
        status::text in (
          'reserved',
          'paid',
          'shipped',
          'claimed',
          'cancelled',
          'rto'
        )
      ) not valid;

    alter table public.orders
      validate constraint orders_status_check;
  end if;
end $$;

comment on constraint orders_status_check on public.orders
  is 'Valid application order states, including claimed and return-to-origin.';

notify pgrst, 'reload schema';
