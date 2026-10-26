-- Sprint 3 use case 10 / requirement 10: volunteer shifts.
-- Expand-only: new tables and functions only. Direct table writes are never
-- allowed; the RPCs below provide locking, validation, and authorization
-- atomically, following the visit scheduling pattern.
create table public.volunteer_shifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  requirements text not null default '' check (char_length(requirements) <= 1000),
  min_age integer not null default 0 check (min_age between 0 and 99),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  status text not null default 'published' check (status in ('published', 'canceled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_shifts_valid_duration check (
    ends_at > starts_at and ends_at <= starts_at + interval '24 hours'
  )
);

create index volunteer_shifts_status_starts_idx
  on public.volunteer_shifts (status, starts_at);

create table public.volunteer_registrations (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.volunteer_shifts(id) on delete restrict,
  member_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null check (char_length(member_name) between 1 and 100),
  member_email text not null check (char_length(member_email) between 3 and 254),
  member_phone text not null check (char_length(member_phone) between 7 and 30),
  member_date_of_birth date not null check (member_date_of_birth >= date '1900-01-01'),
  status text not null default 'registered' check (status in ('registered', 'canceled')),
  canceled_reason text check (canceled_reason in ('member', 'shift_canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_registrations_cancel_state check (
    (status = 'registered' and canceled_reason is null)
    or (status = 'canceled' and canceled_reason is not null)
  )
);

-- A member holds at most one active registration per shift. This partial
-- unique index is a second, independent protection beside the RPC locks.
create unique index volunteer_registrations_one_active_per_member_idx
  on public.volunteer_registrations (shift_id, member_id)
  where status = 'registered';
create index volunteer_registrations_member_idx
  on public.volunteer_registrations (member_id, status, created_at desc);
create index volunteer_registrations_shift_idx
  on public.volunteer_registrations (shift_id, status);

alter table public.volunteer_shifts enable row level security;
alter table public.volunteer_registrations enable row level security;

revoke all on public.volunteer_shifts, public.volunteer_registrations from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.volunteer_shifts, public.volunteer_registrations to authenticated;

create policy "Staff can read all volunteer shifts"
on public.volunteer_shifts for select to authenticated
using ((select public.is_staff()));

create policy "Members can read their own volunteer registrations"
on public.volunteer_registrations for select to authenticated
using ((select auth.uid()) = member_id);

create policy "Staff can read all volunteer registrations"
on public.volunteer_registrations for select to authenticated
using ((select public.is_staff()));

-- Whole years between a birth date and today; used for shift minimum ages.
create function public.volunteer_age(p_date_of_birth date)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from age(current_date, p_date_of_birth))::integer;
$$;

-- Members cannot read other members' registrations, so remaining capacity
-- is computed under a narrowly scoped definer function that exposes no
-- volunteer details.
create function public.list_volunteer_shifts()
returns table (
  id uuid,
  title text,
  description text,
  requirements text,
  min_age integer,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  spots_remaining integer,
  registered boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see volunteer shifts.' using errcode = '28000';
  end if;

  return query
    select shift.id,
      shift.title,
      shift.description,
      shift.requirements,
      shift.min_age,
      shift.starts_at,
      shift.ends_at,
      shift.capacity,
      greatest(shift.capacity - (
        select count(*)::integer from public.volunteer_registrations registration
        where registration.shift_id = shift.id and registration.status = 'registered'
      ), 0),
      exists (
        select 1 from public.volunteer_registrations registration
        where registration.shift_id = shift.id
          and registration.member_id = auth.uid()
          and registration.status = 'registered'
      )
    from public.volunteer_shifts shift
    where shift.status = 'published'
      and shift.starts_at > now()
    order by shift.starts_at, shift.title;
end;
$$;

create function public.list_my_volunteer_registrations()
returns table (
  id uuid,
  shift_id uuid,
  status text,
  canceled_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  title text,
  description text,
  requirements text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your volunteer shifts.' using errcode = '28000';
  end if;

  return query
    select registration.id,
      registration.shift_id,
      registration.status,
      registration.canceled_reason,
      registration.created_at,
      registration.updated_at,
      shift.title,
      shift.description,
      shift.requirements,
      shift.starts_at,
      shift.ends_at
    from public.volunteer_registrations registration
    join public.volunteer_shifts shift on shift.id = registration.shift_id
    where registration.member_id = auth.uid()
    order by shift.starts_at desc, registration.created_at desc;
end;
$$;

create function public.register_for_volunteer_shift(p_shift_id uuid, p_phone text, p_date_of_birth date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_shift public.volunteer_shifts%rowtype;
  v_registration_id uuid;
  v_phone text := btrim(coalesce(p_phone, ''));
  v_member_name text := coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''), auth.jwt() ->> 'email');
  v_member_email text := auth.jwt() ->> 'email';
begin
  if v_member_id is null then
    raise exception 'Log in before registering for a volunteer shift.' using errcode = '28000';
  end if;
  if char_length(v_phone) not between 7 and 30 then
    raise exception 'Enter a phone number where the shelter can reach you.' using errcode = '22023';
  end if;
  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Enter a valid date of birth.' using errcode = '22023';
  end if;
  if v_member_name is null or char_length(v_member_name) > 100 or v_member_email is null or char_length(v_member_email) > 254 then
    raise exception 'Your account profile is incomplete. Update it before registering.' using errcode = '22023';
  end if;

  -- Serialize one member's registrations so two concurrent requests for
  -- overlapping shifts cannot both pass the conflict check, then lock the
  -- shift so capacity is counted against a stable set of registrations.
  perform pg_advisory_xact_lock(hashtextextended('volunteer:' || v_member_id::text, 0));
  select * into v_shift from public.volunteer_shifts where id = p_shift_id for update;

  if not found or v_shift.status <> 'published' or v_shift.starts_at <= now() then
    raise exception 'That volunteer shift is no longer available.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.volunteer_registrations
    where shift_id = v_shift.id and member_id = v_member_id and status = 'registered'
  ) then
    raise exception 'You are already registered for this shift.' using errcode = 'P0001';
  end if;
  if v_shift.min_age > 0 and public.volunteer_age(p_date_of_birth) < v_shift.min_age then
    raise exception 'This shift requires volunteers to be at least % years old.', v_shift.min_age using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.volunteer_registrations registration
    join public.volunteer_shifts other on other.id = registration.shift_id
    where registration.member_id = v_member_id
      and registration.status = 'registered'
      and other.id <> v_shift.id
      and other.status = 'published'
      and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(v_shift.starts_at, v_shift.ends_at, '[)')
  ) then
    raise exception 'You are already registered for another shift that overlaps this time.' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.volunteer_registrations
    where shift_id = v_shift.id and status = 'registered'
  ) >= v_shift.capacity then
    raise exception 'This shift is full. Choose another opportunity.' using errcode = 'P0001';
  end if;

  insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth)
  values (v_shift.id, v_member_id, v_member_name, v_member_email, v_phone, p_date_of_birth)
  returning id into v_registration_id;

  return v_registration_id;
end;
$$;

create function public.cancel_volunteer_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_registration public.volunteer_registrations%rowtype;
  v_shift public.volunteer_shifts%rowtype;
begin
  if v_member_id is null then
    raise exception 'Log in before changing a volunteer registration.' using errcode = '28000';
  end if;

  select * into v_registration
  from public.volunteer_registrations
  where id = p_registration_id and member_id = v_member_id
  for update;
  if not found then
    raise exception 'Volunteer registration not found.' using errcode = 'P0001';
  end if;
  if v_registration.status <> 'registered' then
    raise exception 'This registration is already canceled.' using errcode = 'P0001';
  end if;

  select * into v_shift from public.volunteer_shifts where id = v_registration.shift_id;
  if v_shift.starts_at <= now() then
    raise exception 'Past shifts cannot be canceled online.' using errcode = 'P0001';
  end if;

  update public.volunteer_registrations
  set status = 'canceled', canceled_reason = 'member', updated_at = now()
  where id = v_registration.id;
end;
$$;

create function public.create_volunteer_shift(
  p_title text,
  p_description text,
  p_requirements text,
  p_min_age integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_shift_id uuid;
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to publish volunteer shifts.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '24 hours' then
    raise exception 'Choose a future shift that ends after it starts and lasts no more than 24 hours.' using errcode = '22023';
  end if;

  insert into public.volunteer_shifts (title, description, requirements, min_age, starts_at, ends_at, capacity, created_by)
  values (btrim(p_title), btrim(p_description), btrim(coalesce(p_requirements, '')), coalesce(p_min_age, 0), p_starts_at, p_ends_at, p_capacity, v_actor_id)
  returning id into v_shift_id;
  return v_shift_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Check the shift title, duties, requirements, minimum age, and capacity.' using errcode = '22023';
end;
$$;

-- Times and the minimum age are fixed once anyone has registered, because
-- changing them would silently invalidate existing sign-ups. Capacity may not
-- drop below the current head count.
create function public.update_volunteer_shift(
  p_shift_id uuid,
  p_title text,
  p_description text,
  p_requirements text,
  p_min_age integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_shift public.volunteer_shifts%rowtype;
  v_registered integer;
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to edit volunteer shifts.' using errcode = '42501';
  end if;

  select * into v_shift from public.volunteer_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Volunteer shift not found.' using errcode = 'P0001';
  end if;
  if v_shift.status <> 'published' or v_shift.starts_at <= now() then
    raise exception 'Only upcoming published shifts can be edited.' using errcode = 'P0001';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '24 hours' then
    raise exception 'Choose a future shift that ends after it starts and lasts no more than 24 hours.' using errcode = '22023';
  end if;

  select count(*) into v_registered
  from public.volunteer_registrations
  where shift_id = v_shift.id and status = 'registered';

  if v_registered > 0 and (p_starts_at <> v_shift.starts_at or p_ends_at <> v_shift.ends_at or coalesce(p_min_age, 0) <> v_shift.min_age) then
    raise exception 'The time and minimum age cannot change once volunteers have registered. Cancel the shift and publish a new one instead.' using errcode = 'P0001';
  end if;
  if p_capacity < v_registered then
    raise exception 'Capacity cannot be lower than the % volunteers already registered.', v_registered using errcode = 'P0001';
  end if;

  update public.volunteer_shifts
  set title = btrim(p_title),
      description = btrim(p_description),
      requirements = btrim(coalesce(p_requirements, '')),
      min_age = coalesce(p_min_age, 0),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      capacity = p_capacity,
      updated_at = now()
  where id = v_shift.id;
exception
  when check_violation or not_null_violation then
    raise exception 'Check the shift title, duties, requirements, minimum age, and capacity.' using errcode = '22023';
end;
$$;

-- Cancels an upcoming shift and every active registration on it. Returns the
-- affected volunteers so the API can email them.
create function public.cancel_volunteer_shift(p_shift_id uuid)
returns table (member_name text, member_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_shift public.volunteer_shifts%rowtype;
begin
  if v_actor_id is null or not public.is_staff() then
    raise exception 'Staff access is required to cancel volunteer shifts.' using errcode = '42501';
  end if;

  select * into v_shift from public.volunteer_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Volunteer shift not found.' using errcode = 'P0001';
  end if;
  if v_shift.status <> 'published' then
    raise exception 'This shift is already canceled.' using errcode = 'P0001';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'Past shifts cannot be canceled.' using errcode = 'P0001';
  end if;

  update public.volunteer_shifts set status = 'canceled', updated_at = now() where id = v_shift.id;

  return query
    update public.volunteer_registrations registration
    set status = 'canceled', canceled_reason = 'shift_canceled', updated_at = now()
    where registration.shift_id = v_shift.id and registration.status = 'registered'
    returning registration.member_name, registration.member_email;
end;
$$;

revoke execute on function public.volunteer_age(date) from public, anon;
revoke execute on function public.list_volunteer_shifts() from public, anon;
revoke execute on function public.list_my_volunteer_registrations() from public, anon;
revoke execute on function public.register_for_volunteer_shift(uuid, text, date) from public, anon;
revoke execute on function public.cancel_volunteer_registration(uuid) from public, anon;
revoke execute on function public.create_volunteer_shift(text, text, text, integer, timestamptz, timestamptz, integer) from public, anon;
revoke execute on function public.update_volunteer_shift(uuid, text, text, text, integer, timestamptz, timestamptz, integer) from public, anon;
revoke execute on function public.cancel_volunteer_shift(uuid) from public, anon;

grant execute on function public.volunteer_age(date) to authenticated;
grant execute on function public.list_volunteer_shifts() to authenticated;
grant execute on function public.list_my_volunteer_registrations() to authenticated;
grant execute on function public.register_for_volunteer_shift(uuid, text, date) to authenticated;
grant execute on function public.cancel_volunteer_registration(uuid) to authenticated;
grant execute on function public.create_volunteer_shift(text, text, text, integer, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.update_volunteer_shift(uuid, text, text, text, integer, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.cancel_volunteer_shift(uuid) to authenticated;

comment on table public.volunteer_shifts is
  'Staff-published volunteer opportunities with a capacity and optional minimum age.';
comment on table public.volunteer_registrations is
  'One active registration per member per shift; only database RPCs mutate it.';
