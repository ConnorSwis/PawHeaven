-- PawHeaven's first connected use case: public pet listings and staff pet management.
-- Supabase Auth owns accounts and password hashes. Staff roles live in auth.users.raw_app_meta_data.

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  species text not null check (char_length(species) between 1 and 60),
  breed text not null check (char_length(breed) between 1 and 100),
  age_label text not null check (char_length(age_label) between 1 and 60),
  intake_date date not null check (intake_date <= current_date),
  tags text[] not null default '{}',
  status text not null default 'Available' check (status in ('Available', 'Pending', 'Adopted')),
  summary text not null check (char_length(summary) between 1 and 2000),
  image_path text,
  created_at timestamptz not null default now()
);

create index pets_name_idx on public.pets (name);
create index pets_status_idx on public.pets (status);
create index pets_tags_idx on public.pets using gin (tags);

alter table public.pets enable row level security;
revoke all on public.pets from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.pets to anon;
grant select, insert, update, delete on public.pets to authenticated;

create policy "Public can read available pets"
on public.pets for select to anon, authenticated
using (status = 'Available');

create policy "Staff can read all pets"
on public.pets for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

create policy "Staff can add pets"
on public.pets for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

create policy "Staff can update pets"
on public.pets for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'))
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

create policy "Staff can delete pets"
on public.pets for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-images', 'pet-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Staff can read pet image records"
on storage.objects for select to authenticated
using (bucket_id = 'pet-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

create policy "Staff can upload pet images"
on storage.objects for insert to authenticated
with check (bucket_id = 'pet-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

create policy "Staff can delete pet images"
on storage.objects for delete to authenticated
using (bucket_id = 'pet-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));
