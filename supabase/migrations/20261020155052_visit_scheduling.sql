-- Shelter visits are general appointments, not applications for a particular
-- animal. All time instants are stored with timezone; the public and admin
-- interfaces label the shelter's configured America/New_York timezone.
create table public.visit_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'published' check (status in ('published', 'withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint visit_slots_valid_duration check (ends_at > starts_at),
  constraint visit_slots_published_times_do_not_overlap
    exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status = 'published')
);

create index visit_slots_status_starts_idx
  on public.visit_slots (status, starts_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null check (char_length(member_name) between 1 and 100),
  member_email text not null check (char_length(member_email) between 3 and 254),
  slot_id uuid not null references public.visit_slots(id) on delete restrict,
  purpose text not null check (char_length(btrim(purpose)) between 1 and 500),
  status text not null default 'booked' check (status in ('booked', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A canceled appointment frees its slot. This partial unique index is a
-- second, independent protection in addition to the slot locks in the RPCs.
create unique index appointments_one_booked_member_per_slot_idx
  on public.appointments (slot_id)
  where status = 'booked';
create index appointments_member_status_updated_idx
  on public.appointments (member_id, status, updated_at desc);
create index appointments_slot_idx on public.appointments (slot_id);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('booked', 'rescheduled', 'canceled')),
  slot_starts_at timestamptz not null,
  slot_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint appointment_events_valid_snapshot check (slot_ends_at > slot_starts_at)
);

create index appointment_events_member_created_idx
  on public.appointment_events (member_id, created_at desc);
create index appointment_events_appointment_created_idx
  on public.appointment_events (appointment_id, created_at desc);

alter table public.visit_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;

-- Direct table writes are never allowed. The mutation RPCs below provide the
-- locking, validation, history creation, and authorization checks atomically.
revoke all on public.visit_slots, public.appointments, public.appointment_events from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.visit_slots, public.appointments, public.appointment_events to authenticated;

create policy "Administrators can read all visit slots"
on public.visit_slots for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Members can read their own appointments"
on public.appointments for select to authenticated
using ((select auth.uid()) = member_id);

create policy "Administrators can read all appointments"
on public.appointments for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Members can read their own appointment events"
on public.appointment_events for select to authenticated
using ((select auth.uid()) = member_id);

-- This public-facing projection intentionally has no visitor name, email, or
-- purpose. The availability calculation runs under a narrowly scoped definer
-- function because members cannot read other members' appointments.
create function public.list_visit_slots()
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, available boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see available visit times.' using errcode = '28000';
  end if;

  return query
    select slot.id,
      slot.starts_at,
      slot.ends_at,
      not exists (
        select 1
        from public.appointments appointment
        where appointment.slot_id = slot.id
          and appointment.status = 'booked'
      ) as available
    from public.visit_slots slot
    where slot.status = 'published'
      and slot.starts_at > now()
    order by slot.starts_at;
end;
$$;

create function public.list_my_appointments()
returns table (
  id uuid,
  slot_id uuid,
  purpose text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your appointments.' using errcode = '28000';
  end if;

  return query
    select appointment.id,
      appointment.slot_id,
      appointment.purpose,
      appointment.status,
      appointment.created_at,
      appointment.updated_at,
      slot.starts_at,
      slot.ends_at
    from public.appointments appointment
    join public.visit_slots slot on slot.id = appointment.slot_id
    where appointment.member_id = auth.uid()
    order by slot.starts_at desc, appointment.created_at desc;
end;
$$;

create function public.list_my_appointment_events()
returns table (
  id uuid,
  appointment_id uuid,
  event_type text,
  slot_starts_at timestamptz,
  slot_ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your appointment confirmations.' using errcode = '28000';
  end if;

  return query
    select event.id,
      event.appointment_id,
      event.event_type,
      event.slot_starts_at,
      event.slot_ends_at,
      event.created_at
    from public.appointment_events event
    where event.member_id = auth.uid()
    order by event.created_at desc;
end;
$$;

create function public.book_visit_slot(p_slot_id uuid, p_purpose text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_slot public.visit_slots%rowtype;
  v_appointment_id uuid;
  v_purpose text := btrim(coalesce(p_purpose, ''));
  v_member_name text := coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''), auth.jwt() ->> 'email');
  v_member_email text := auth.jwt() ->> 'email';
begin
  if v_member_id is null then
    raise exception 'Log in before booking a visit.' using errcode = '28000';
  end if;
  if char_length(v_purpose) not between 1 and 500 then
    raise exception 'Tell the shelter why you would like to visit, using up to 500 characters.' using errcode = '22023';
  end if;
  if v_member_name is null or char_length(v_member_name) > 100 or v_member_email is null or char_length(v_member_email) > 254 then
    raise exception 'Your account profile is incomplete. Update it before booking a visit.' using errcode = '22023';
  end if;

  select * into v_slot
  from public.visit_slots
  where id = p_slot_id
  for update;

  if not found or v_slot.status <> 'published' or v_slot.starts_at <= now() then
    raise exception 'That visit time is no longer available.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments
    where slot_id = v_slot.id and status = 'booked'
  ) then
    raise exception 'That visit time was just booked. Choose another available time.' using errcode = 'P0001';
  end if;

  insert into public.appointments (member_id, member_name, member_email, slot_id, purpose)
  values (v_member_id, v_member_name, v_member_email, v_slot.id, v_purpose)
  returning id into v_appointment_id;

  insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at)
  values (v_appointment_id, v_member_id, 'booked', v_slot.starts_at, v_slot.ends_at);

  return v_appointment_id;
end;
$$;

create function public.cancel_visit_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_slot public.visit_slots%rowtype;
begin
  if v_member_id is null then
    raise exception 'Log in before changing an appointment.' using errcode = '28000';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id and member_id = v_member_id
  for update;

  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0001';
  end if;

  select * into v_slot from public.visit_slots where id = v_appointment.slot_id for update;
  if v_appointment.status <> 'booked' then
    raise exception 'This appointment is already canceled.' using errcode = 'P0001';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'Past appointments cannot be canceled online.' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'canceled', updated_at = now()
  where id = v_appointment.id;

  insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at)
  values (v_appointment.id, v_member_id, 'canceled', v_slot.starts_at, v_slot.ends_at);
end;
$$;

create function public.reschedule_visit_appointment(p_appointment_id uuid, p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_current_slot public.visit_slots%rowtype;
  v_destination_slot public.visit_slots%rowtype;
begin
  if v_member_id is null then
    raise exception 'Log in before changing an appointment.' using errcode = '28000';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id and member_id = v_member_id
  for update;

  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0001';
  end if;
  if v_appointment.status <> 'booked' then
    raise exception 'This appointment is already canceled.' using errcode = 'P0001';
  end if;
  if v_appointment.slot_id = p_slot_id then
    raise exception 'Choose a different available visit time.' using errcode = '22023';
  end if;

  -- Every reschedule locks its two slots in UUID order. That deterministic
  -- order prevents crossed reschedules from deadlocking one another.
  perform 1
  from public.visit_slots
  where id in (v_appointment.slot_id, p_slot_id)
  order by id
  for update;

  select * into v_current_slot from public.visit_slots where id = v_appointment.slot_id;
  select * into v_destination_slot from public.visit_slots where id = p_slot_id;

  if v_current_slot.starts_at <= now() then
    raise exception 'Past appointments cannot be rescheduled online.' using errcode = 'P0001';
  end if;
  if not found or v_destination_slot.status <> 'published' or v_destination_slot.starts_at <= now() then
    raise exception 'That visit time is no longer available.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.appointments
    where slot_id = v_destination_slot.id and status = 'booked'
  ) then
    raise exception 'That visit time was just booked. Choose another available time.' using errcode = 'P0001';
  end if;

  update public.appointments
  set slot_id = v_destination_slot.id, updated_at = now()
  where id = v_appointment.id;

  insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at)
  values (v_appointment.id, v_member_id, 'rescheduled', v_destination_slot.starts_at, v_destination_slot.ends_at);
end;
$$;

create function public.publish_visit_slot(p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_slot_id uuid;
begin
  if v_actor_id is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'superuser') then
    raise exception 'Administrator access is required to publish visit times.' using errcode = '42501';
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

create function public.withdraw_visit_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_slot public.visit_slots%rowtype;
begin
  if v_actor_id is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'superuser') then
    raise exception 'Administrator access is required to withdraw visit times.' using errcode = '42501';
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

revoke execute on function public.list_visit_slots() from public, anon;
revoke execute on function public.list_my_appointments() from public, anon;
revoke execute on function public.list_my_appointment_events() from public, anon;
revoke execute on function public.book_visit_slot(uuid, text) from public, anon;
revoke execute on function public.cancel_visit_appointment(uuid) from public, anon;
revoke execute on function public.reschedule_visit_appointment(uuid, uuid) from public, anon;
revoke execute on function public.publish_visit_slot(timestamptz, timestamptz) from public, anon;
revoke execute on function public.withdraw_visit_slot(uuid) from public, anon;

grant execute on function public.list_visit_slots() to authenticated;
grant execute on function public.list_my_appointments() to authenticated;
grant execute on function public.list_my_appointment_events() to authenticated;
grant execute on function public.book_visit_slot(uuid, text) to authenticated;
grant execute on function public.cancel_visit_appointment(uuid) to authenticated;
grant execute on function public.reschedule_visit_appointment(uuid, uuid) to authenticated;
grant execute on function public.publish_visit_slot(timestamptz, timestamptz) to authenticated;
grant execute on function public.withdraw_visit_slot(uuid) to authenticated;

comment on table public.visit_slots is
  'Administrator-published general shelter visit times. Published ranges cannot overlap.';
comment on table public.appointments is
  'One member booking per published shelter visit slot; only database RPCs mutate it.';
comment on table public.appointment_events is
  'Account-visible booking, reschedule, and cancellation confirmation history.';
