-- Restrict commission and employee-assistance records to the owner (admin).
-- Route guards and navigation visibility are convenience controls; these RLS
-- policies are the database enforcement boundary.

alter table public.commissions enable row level security;

drop policy if exists "Authenticated users can view commissions" on public.commissions;
drop policy if exists "Staff can insert commissions" on public.commissions;
drop policy if exists "Staff can update commissions" on public.commissions;
drop policy if exists "Admins can delete commissions" on public.commissions;
drop policy if exists "Owners can view commissions" on public.commissions;
drop policy if exists "Owners can insert commissions" on public.commissions;
drop policy if exists "Owners can update commissions" on public.commissions;
drop policy if exists "Owners can delete commissions" on public.commissions;

create policy "Owners can view commissions"
  on public.commissions for select to authenticated
  using (public.is_admin());

create policy "Owners can insert commissions"
  on public.commissions for insert to authenticated
  with check (public.is_admin());

create policy "Owners can update commissions"
  on public.commissions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Owners can delete commissions"
  on public.commissions for delete to authenticated
  using (public.is_admin());

comment on table public.commissions is
  'Owner-only commission records linking assisting employees to customers, orders, and sold items.';

notify pgrst, 'reload schema';
