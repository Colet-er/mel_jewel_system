-- ============================================================
-- Migration 0001: Foundation
-- Extensions, profiles table with roles, helper functions,
-- triggers, and Row Level Security policies.
-- Idempotent: safe to run again on an existing database.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$
begin
  create type public.user_role as enum ('admin', 'staff', 'viewer');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy-schema guards: an older install may be missing columns or
-- may store role as plain text. Bring the existing table up to spec
-- so the role helpers below type-check.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
declare
  role_type text;
  con record;
begin
  select data_type into role_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'role';

  -- USER-DEFINED means the enum; anything else (text, etc.) is legacy.
  if role_type is not null and role_type <> 'USER-DEFINED' then
    -- Legacy installs may carry text-based CHECK constraints on role
    -- (e.g. "role = 'admin'"). They cannot be re-validated against the
    -- enum after the type change (no user_role = text operator), so
    -- drop them before converting.
    for con in
      select conname
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.profiles drop constraint %I', con.conname);
    end loop;

    update public.profiles set role = 'viewer' where btrim(role) = '';
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type public.user_role
      using lower(btrim(role))::public.user_role;
    alter table public.profiles alter column role set default 'viewer';
  end if;
end $$;

comment on table public.profiles is 'Application user profiles with roles. One row per auth user.';

create index if not exists idx_profiles_role on public.profiles (role);

-- ------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Auto-create profile on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'viewer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Role helper functions (used by RLS policies)
-- Force-dropped first: create or replace fails with 42P13 when an
-- existing copy has a different return type. Cascade drops any
-- policies using them; those are recreated below and in 0002-0004.
-- ------------------------------------------------------------
drop function if exists public.is_staff_or_admin() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.current_user_role() cascade;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'staff');
$$;

-- ------------------------------------------------------------
-- Enable RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- Profiles policies
-- - Any authenticated user can read profiles (needed for
--   role checks and displaying who recorded payments etc.)
-- - Users can update their own name; only admins can change
--   roles or manage other users.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can view profiles"
  on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile"
  on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "Admins can manage all profiles"
  on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
