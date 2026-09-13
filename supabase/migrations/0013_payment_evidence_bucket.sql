-- Private evidence storage for reservation payment receipts.
-- Payment metadata remains in public.order_payments; objects are associated
-- through the path: order_id/payment_id/unique-file-name.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-evidence',
  'payment-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can view payment evidence" on storage.objects;
create policy "Staff can view payment evidence"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-evidence'
  and public.is_staff_or_admin()
);

drop policy if exists "Staff can upload payment evidence" on storage.objects;
create policy "Staff can upload payment evidence"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-evidence'
  and public.is_staff_or_admin()
);

drop policy if exists "Staff can remove failed payment evidence" on storage.objects;
create policy "Staff can remove failed payment evidence"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-evidence'
  and public.is_staff_or_admin()
);
