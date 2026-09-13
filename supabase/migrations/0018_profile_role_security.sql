-- Prevent signup metadata and self-service profile updates from granting
-- application privileges. Roles may only be assigned by an existing admin.

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

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin()
     and (new.role is distinct from old.role or new.email is distinct from old.email) then
    raise exception 'Only administrators can change profile roles or email addresses'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_identity on public.profiles;
create trigger trg_protect_profile_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

-- Security-definer functions should not inherit PostgreSQL's default PUBLIC
-- execute permission. Grant only the roles that use them.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff_or_admin() from public, anon;
revoke execute on function public.downpayment_settled(uuid) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.downpayment_settled(uuid) to authenticated;

notify pgrst, 'reload schema';
