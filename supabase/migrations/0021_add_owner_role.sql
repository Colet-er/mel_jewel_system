-- ============================================================
-- Migration: 0021_add_owner_role.sql
-- Add 'owner' to the public.user_role PostgreSQL enum type
-- and update permission helper functions to grant owners full admin privileges.
-- ============================================================

-- Add 'owner' value to user_role enum
alter type public.user_role add value if not exists 'owner';

-- Update is_admin() helper to include 'owner'
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role()::text in ('admin', 'owner');
$$;

-- Update is_staff_or_admin() helper to include 'owner'
create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role()::text in ('admin', 'owner', 'staff');
$$;

comment on type public.user_role is
  'Application roles: owner (business owner with full privileges), admin (full system administration), staff (orders, reservations, inventory, collections), and viewer (read-only).';

notify pgrst, 'reload schema';
