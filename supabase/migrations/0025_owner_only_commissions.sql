-- ============================================================
-- Migration: 0025_owner_only_commissions.sql
-- Strictly restrict commission records to owner only (excluding admin, staff, viewer).
-- ============================================================

-- Create is_owner() helper
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role()::text = 'owner';
$$;

-- Drop existing commission policies
drop policy if exists "Owners can view commissions" on public.commissions;
drop policy if exists "Owners can insert commissions" on public.commissions;
drop policy if exists "Owners can update commissions" on public.commissions;
drop policy if exists "Owners can delete commissions" on public.commissions;
drop policy if exists "Authenticated users can view commissions" on public.commissions;
drop policy if exists "Staff can insert commissions" on public.commissions;
drop policy if exists "Staff can update commissions" on public.commissions;
drop policy if exists "Admins can delete commissions" on public.commissions;

-- Recreate strict owner-only policies using is_owner()
create policy "Owners can view commissions"
  on public.commissions for select to authenticated
  using (public.is_owner());

create policy "Owners can insert commissions"
  on public.commissions for insert to authenticated
  with check (public.is_owner());

create policy "Owners can update commissions"
  on public.commissions for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "Owners can delete commissions"
  on public.commissions for delete to authenticated
  using (public.is_owner());

comment on table public.commissions is
  'Strictly owner-only commission records. Admin, staff, and viewer do not have access.';

notify pgrst, 'reload schema';
