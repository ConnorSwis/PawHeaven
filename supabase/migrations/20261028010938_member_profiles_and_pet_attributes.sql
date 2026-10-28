-- UX cohesion: a saved contact profile and richer pet attributes.
-- Expand-only: a new table, and new pet columns that are all defaulted, so the
-- previously deployed API (which neither reads nor writes them) keeps working
-- until the new API is released.

-- Saved contact details --------------------------------------------------------
-- Members type phone, address, and date of birth into adoption, foster, and
-- volunteer forms. One profile row prefills all of them. Applications and
-- registrations still snapshot the values they were submitted with, so editing
-- the profile never rewrites history. Only the member can read or change it.
create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text check (phone is null or char_length(phone) between 7 and 30),
  address text check (address is null or char_length(address) between 5 and 300),
  date_of_birth date check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from anon, authenticated;
grant usage on schema public to authenticated;
grant select, delete on public.member_profiles to authenticated;
grant insert (user_id, phone, address, date_of_birth, updated_at) on public.member_profiles to authenticated;
grant update (phone, address, date_of_birth, updated_at) on public.member_profiles to authenticated;

create policy "Members can read their own profile"
on public.member_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can create their own profile"
on public.member_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can update their own profile"
on public.member_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Members can delete their own profile"
on public.member_profiles for delete to authenticated
using ((select auth.uid()) = user_id);

comment on table public.member_profiles is
  'A member''s saved phone, address, and date of birth, used only to prefill forms. Readable and writable by the member alone.';

-- Pet attributes -----------------------------------------------------------------
-- Everything defaults to "not recorded" ('' or Unknown) so existing rows stay
-- valid and staff can fill the details in over time.
alter table public.pets
  add column sex text not null default '' check (sex in ('', 'Male', 'Female', 'Unknown')),
  add column size text not null default '' check (size in ('', 'Small', 'Medium', 'Large', 'Extra large')),
  add column color text not null default '' check (char_length(color) <= 100),
  add column weight_lbs integer check (weight_lbs is null or weight_lbs between 1 and 400),
  add column spayed_neutered text not null default 'Unknown' check (spayed_neutered in ('Yes', 'No', 'Unknown')),
  add column good_with_kids text not null default 'Unknown' check (good_with_kids in ('Yes', 'No', 'Unknown')),
  add column good_with_dogs text not null default 'Unknown' check (good_with_dogs in ('Yes', 'No', 'Unknown')),
  add column good_with_cats text not null default 'Unknown' check (good_with_cats in ('Yes', 'No', 'Unknown')),
  add column energy_level text not null default '' check (energy_level in ('', 'Low', 'Medium', 'High'));

comment on column public.pets.color is
  'Public coat color, so visitors can search for "black dog" and the matching quiz can use it.';
comment on column public.pets.good_with_kids is
  'Yes, No, or Unknown. Shown publicly and used by the matching quiz; Unknown means staff have not assessed it.';
