-- Sprint 3 use cases 6 and 7: the AI pet-matching quiz and lost-pet photo
-- matching. Expand-only: new tables, a new private bucket, and new functions;
-- nothing the previously deployed API reads or writes changes.
--
-- Recommendations and visual matches never reserve a pet or establish
-- ownership. Photos uploaded for lost-pet searches are personal data, so they
-- live in a PRIVATE bucket (never the public pet-images bucket) and expire
-- 30 days after the search, or 30 days after the last inquiry about it.

-- Quiz ---------------------------------------------------------------------
create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 8000),
  recommendations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(recommendations) = 'array' and pg_column_size(recommendations) <= 20000),
  created_at timestamptz not null default now()
);

create index quiz_responses_user_created_idx
  on public.quiz_responses (user_id, created_at desc);

alter table public.quiz_responses enable row level security;
revoke all on public.quiz_responses from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, delete on public.quiz_responses to authenticated;

create policy "Members can read their own quiz responses"
on public.quiz_responses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can save their own quiz responses"
on public.quiz_responses for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can delete their own quiz responses"
on public.quiz_responses for delete to authenticated
using ((select auth.uid()) = user_id);

comment on table public.quiz_responses is
  'A member''s pet-matching quiz answers and the recommendations produced from them. Recommendations never reserve a pet.';

-- Lost-pet searches ---------------------------------------------------------
create table public.lost_pet_searches (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  species text not null check (species in ('Dog', 'Cat', 'Other')),
  description text not null default '' check (char_length(description) <= 300),
  -- Photos are removed immediately when a search finds nothing; the attempt row stays
  -- so the daily search limit still counts it.
  photo_paths text[] not null check (cardinality(photo_paths) between 0 and 3),
  result jsonb not null default '[]'::jsonb
    check (jsonb_typeof(result) = 'array' and pg_column_size(result) <= 20000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index lost_pet_searches_member_created_idx
  on public.lost_pet_searches (member_id, created_at desc);
create index lost_pet_searches_expires_idx
  on public.lost_pet_searches (expires_at);

alter table public.lost_pet_searches enable row level security;
revoke all on public.lost_pet_searches from anon, authenticated;
grant select, delete on public.lost_pet_searches to authenticated;
-- expires_at and created_at keep their defaults; clients cannot extend retention.
grant insert (member_id, species, description, photo_paths, result) on public.lost_pet_searches to authenticated;

create policy "Members can read their own lost-pet searches"
on public.lost_pet_searches for select to authenticated
using ((select auth.uid()) = member_id);

create policy "Staff can read all lost-pet searches"
on public.lost_pet_searches for select to authenticated
using ((select public.is_staff()));

create policy "Members can record their own lost-pet searches"
on public.lost_pet_searches for insert to authenticated
with check (
  (select auth.uid()) = member_id
  and not exists (
    select 1 from unnest(photo_paths) as photo_path
    where photo_path not like (select auth.uid())::text || '/%'
  )
);

create policy "Members can delete their own lost-pet searches"
on public.lost_pet_searches for delete to authenticated
using ((select auth.uid()) = member_id);

create policy "Staff can delete lost-pet searches"
on public.lost_pet_searches for delete to authenticated
using ((select public.is_staff()));

-- Lost-pet inquiries ----------------------------------------------------------
create table public.lost_pet_inquiries (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.lost_pet_searches(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null check (char_length(member_name) between 1 and 100),
  member_email text not null check (char_length(member_email) between 3 and 254),
  member_phone text not null check (char_length(member_phone) between 7 and 30),
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text not null check (char_length(pet_name) between 1 and 100),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'New' check (status in ('New', 'In progress', 'Resolved')),
  staff_note text not null default '' check (char_length(staff_note) <= 1000),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lost_pet_inquiries_one_per_search_pet unique (search_id, pet_id)
);

create index lost_pet_inquiries_member_created_idx
  on public.lost_pet_inquiries (member_id, created_at desc);
create index lost_pet_inquiries_status_created_idx
  on public.lost_pet_inquiries (status, created_at desc);

alter table public.lost_pet_inquiries enable row level security;
revoke all on public.lost_pet_inquiries from anon, authenticated;
grant select on public.lost_pet_inquiries to authenticated;

create policy "Members can read their own lost-pet inquiries"
on public.lost_pet_inquiries for select to authenticated
using ((select auth.uid()) = member_id);

create policy "Staff can read all lost-pet inquiries"
on public.lost_pet_inquiries for select to authenticated
using ((select public.is_staff()));

-- Private upload bucket ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lost-pet-uploads', 'lost-pet-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Members can upload lost-pet photos to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lost-pet-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Members can read their own lost-pet photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'lost-pet-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Members can delete their own lost-pet photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'lost-pet-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Staff can read lost-pet photos"
on storage.objects for select to authenticated
using (bucket_id = 'lost-pet-uploads' and (select public.is_staff()));

create policy "Staff can delete lost-pet photos"
on storage.objects for delete to authenticated
using (bucket_id = 'lost-pet-uploads' and (select public.is_staff()));

-- Functions -------------------------------------------------------------------
-- Members may only read Available pets directly, but a lost animal can be in
-- any shelter state. This projection exposes just what a match result needs
-- (never medical history, intake notes, or applications) for every pet that is
-- not Adopted and has a photo.
create function public.lost_pet_candidates(p_species text)
returns table (
  id uuid,
  name text,
  species text,
  breed text,
  age_label text,
  status text,
  image_path text,
  intake_date date
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to search for a lost pet.' using errcode = '28000';
  end if;
  if p_species not in ('Dog', 'Cat', 'Other') then
    raise exception 'Choose Dog, Cat, or Other.' using errcode = '22023';
  end if;

  return query
    select pet.id, pet.name, pet.species, pet.breed, pet.age_label, pet.status, pet.image_path, pet.intake_date
    from public.pets pet
    where pet.status <> 'Adopted'
      and pet.image_path is not null
      and (
        (p_species = 'Other' and lower(pet.species) not in ('dog', 'cat'))
        or lower(pet.species) = lower(p_species)
      )
    order by pet.intake_date desc, pet.name
    limit 30;
end;
$$;

-- An inquiry may only name an animal the member's own, unexpired search
-- returned, and a member may send at most ten a day.
create function public.submit_lost_pet_inquiry(p_search_id uuid, p_pet_id uuid, p_phone text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_search public.lost_pet_searches%rowtype;
  v_pet_name text;
  v_inquiry_id uuid;
  v_phone text := btrim(coalesce(p_phone, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_member_name text := coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''), auth.jwt() ->> 'email');
  v_member_email text := auth.jwt() ->> 'email';
begin
  if v_member_id is null then
    raise exception 'Log in before contacting the shelter.' using errcode = '28000';
  end if;
  if char_length(v_phone) not between 7 and 30 then
    raise exception 'Enter a phone number where the shelter can reach you.' using errcode = '22023';
  end if;
  if char_length(v_message) not between 10 and 1000 then
    raise exception 'Write a message of 10 to 1,000 characters.' using errcode = '22023';
  end if;
  if v_member_name is null or char_length(v_member_name) > 100 or v_member_email is null or char_length(v_member_email) > 254 then
    raise exception 'Your account profile is incomplete. Update it before contacting the shelter.' using errcode = '22023';
  end if;

  select * into v_search
  from public.lost_pet_searches
  where id = p_search_id and member_id = v_member_id
  for update;
  if not found then
    raise exception 'That search was not found. Search again with your photo.' using errcode = 'P0001';
  end if;
  if v_search.expires_at <= now() then
    raise exception 'That search has expired. Search again with your photo.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_search.result) as match_row
    where match_row ->> 'petId' = p_pet_id::text
  ) then
    raise exception 'That animal was not one of the possible matches for this search.' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.lost_pet_inquiries
    where member_id = v_member_id and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'You have reached today''s limit of 10 inquiries. Please try again tomorrow or call the shelter.' using errcode = 'P0001';
  end if;

  select pet.name into v_pet_name from public.pets pet where pet.id = p_pet_id;
  if v_pet_name is null then
    raise exception 'That animal is no longer in the shelter records.' using errcode = 'P0001';
  end if;

  insert into public.lost_pet_inquiries (search_id, member_id, member_name, member_email, member_phone, pet_id, pet_name, message)
  values (v_search.id, v_member_id, v_member_name, v_member_email, v_phone, p_pet_id, v_pet_name, v_message)
  returning id into v_inquiry_id;

  -- Keep the photos staff need until 30 days after the latest inquiry.
  update public.lost_pet_searches
  set expires_at = greatest(expires_at, now() + interval '30 days')
  where id = v_search.id;

  return v_inquiry_id;
end;
$$;

create function public.update_lost_pet_inquiry(p_inquiry_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to update lost-pet inquiries.' using errcode = '42501';
  end if;
  if p_status not in ('New', 'In progress', 'Resolved') then
    raise exception 'Choose New, In progress, or Resolved.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Keep the staff note to 1,000 characters or fewer.' using errcode = '22023';
  end if;

  update public.lost_pet_inquiries
  set status = p_status,
      staff_note = btrim(coalesce(p_note, '')),
      handled_by = v_actor_id,
      handled_at = now()
  where id = p_inquiry_id;
  if not found then
    raise exception 'Lost-pet inquiry not found.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.lost_pet_candidates(text) from public, anon;
revoke execute on function public.submit_lost_pet_inquiry(uuid, uuid, text, text) from public, anon;
revoke execute on function public.update_lost_pet_inquiry(uuid, text, text) from public, anon;

grant execute on function public.lost_pet_candidates(text) to authenticated;
grant execute on function public.submit_lost_pet_inquiry(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_lost_pet_inquiry(uuid, text, text) to authenticated;

comment on table public.lost_pet_searches is
  'A member''s lost-pet photo search. Photos are in the private lost-pet-uploads bucket and expire with the row.';
comment on table public.lost_pet_inquiries is
  'A member''s question to shelter staff about a possible match. A visual match never establishes ownership.';
