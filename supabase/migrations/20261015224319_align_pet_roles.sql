-- The application recognizes only immutable `admin` and `superuser` roles.
-- The initial migration used the historical report term `staff`, which meant a
-- superuser could authenticate to the admin portal but was denied pet and
-- image access by RLS. Keep authorization in immutable app_metadata.

drop policy "Staff can read all pets" on public.pets;
drop policy "Staff can add pets" on public.pets;
drop policy "Staff can update pets" on public.pets;
drop policy "Staff can delete pets" on public.pets;

create policy "Administrators can read all pets"
on public.pets for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Administrators can add pets"
on public.pets for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Administrators can update pets"
on public.pets for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'))
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Administrators can delete pets"
on public.pets for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

drop policy "Staff can read pet image records" on storage.objects;
drop policy "Staff can upload pet images" on storage.objects;
drop policy "Staff can delete pet images" on storage.objects;

create policy "Administrators can read pet image records"
on storage.objects for select to authenticated
using (
  bucket_id = 'pet-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser')
);

create policy "Administrators can upload pet images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pet-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser')
);

create policy "Administrators can delete pet images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser')
);
