-- Introduce the `staff` role described in the Sprint 3 report. Roles live in
-- immutable auth.users.raw_app_meta_data and arrive in the JWT as
-- app_metadata.role:
--   staff      pet records, applications, and the visit schedule
--   admin      everything staff can do, plus ordinary-user account management
--   superuser  everything admin can do, plus administrator invitations
--
-- This migration only widens existing administrator policies, so the API that
-- is currently deployed keeps working unchanged until the new API is released.

create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('staff', 'admin', 'superuser');
$$;

comment on function public.is_staff() is
  'True when the caller JWT carries an immutable staff, admin, or superuser app_metadata role.';

grant execute on function public.is_staff() to anon, authenticated;

-- Pets
drop policy "Administrators can read all pets" on public.pets;
drop policy "Administrators can add pets" on public.pets;
drop policy "Administrators can update pets" on public.pets;
drop policy "Administrators can delete pets" on public.pets;

create policy "Staff can read all pets"
on public.pets for select to authenticated
using ((select public.is_staff()));

create policy "Staff can add pets"
on public.pets for insert to authenticated
with check ((select public.is_staff()));

create policy "Staff can update pets"
on public.pets for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "Staff can delete pets"
on public.pets for delete to authenticated
using ((select public.is_staff()));

-- Public pet photos
drop policy "Administrators can read pet image records" on storage.objects;
drop policy "Administrators can upload pet images" on storage.objects;
drop policy "Administrators can delete pet images" on storage.objects;

create policy "Staff can read pet image records"
on storage.objects for select to authenticated
using (bucket_id = 'pet-images' and (select public.is_staff()));

create policy "Staff can upload pet images"
on storage.objects for insert to authenticated
with check (bucket_id = 'pet-images' and (select public.is_staff()));

create policy "Staff can delete pet images"
on storage.objects for delete to authenticated
using (bucket_id = 'pet-images' and (select public.is_staff()));

-- Adoption applications
drop policy "Administrators can read all applications" on public.adoption_applications;
drop policy "Administrators can record application outcomes" on public.adoption_applications;

create policy "Staff can read all applications"
on public.adoption_applications for select to authenticated
using ((select public.is_staff()));

create policy "Staff can record application outcomes"
on public.adoption_applications for update to authenticated
using ((select public.is_staff()))
with check (
  (select public.is_staff())
  and status <> 'Pending'
  and reviewed_at is not null
  and reviewed_by = (select auth.uid())
);

-- Visit schedule
drop policy "Administrators can read all visit slots" on public.visit_slots;
drop policy "Administrators can read all appointments" on public.appointments;

create policy "Staff can read all visit slots"
on public.visit_slots for select to authenticated
using ((select public.is_staff()));

create policy "Staff can read all appointments"
on public.appointments for select to authenticated
using ((select public.is_staff()));

create or replace function public.publish_visit_slot(p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_slot_id uuid;
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to publish visit times.' using errcode = '42501';
  end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at then
    raise exception 'Choose a future end time after the start time.' using errcode = '22023';
  end if;

  insert into public.visit_slots (starts_at, ends_at, created_by)
  values (p_starts_at, p_ends_at, v_actor_id)
  returning id into v_slot_id;
  return v_slot_id;
end;
$$;

create or replace function public.withdraw_visit_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_slot public.visit_slots%rowtype;
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to withdraw visit times.' using errcode = '42501';
  end if;

  select * into v_slot from public.visit_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Visit time not found.' using errcode = 'P0001';
  end if;
  if v_slot.status <> 'published' then
    raise exception 'This visit time is already withdrawn.' using errcode = 'P0001';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'Past visit times cannot be withdrawn.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.appointments
    where slot_id = v_slot.id and status = 'booked'
  ) then
    raise exception 'A booked visit time cannot be withdrawn.' using errcode = 'P0001';
  end if;

  update public.visit_slots set status = 'withdrawn' where id = v_slot.id;
end;
$$;
