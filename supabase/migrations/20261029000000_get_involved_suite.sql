-- Get Involved suite: recurring open hours, visit capacity and pets, open-house events,
-- pet quick-action flags, a foster alert pool, volunteer-to-foster invitations, reminders,
-- a member schedule, a public "what is open" feed, and a staff "needs attention" report.
--
-- Backward compatibility: the visit RPCs keep their names and gain defaulted parameters, so the
-- previously deployed API keeps working. Every new column is nullable or defaulted. The shelter
-- time zone for recurring times is America/New_York, matching the rest of the app.

-- ---------------------------------------------------------------------------
-- Pet quick-action flags
-- ---------------------------------------------------------------------------
alter table public.pets
  add column visits_open boolean not null default true,
  add column needs_walkers boolean not null default false,
  add column foster_urgent_at timestamptz;

comment on column public.pets.visits_open is 'When false the pet is not offered in the visit "meet a pet" picker.';
comment on column public.pets.needs_walkers is 'Shows a "needs walkers" note and links to volunteer shifts.';
comment on column public.pets.foster_urgent_at is 'Set when staff request a foster now; cleared when the request is closed.';

-- ---------------------------------------------------------------------------
-- Recurring open hours
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('visit', 'shift')),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  capacity integer not null default 1 check (capacity between 1 and 500),
  slot_minutes integer not null default 30 check (slot_minutes between 15 and 240),
  title text not null default '' check (char_length(title) <= 100),
  description text not null default '' check (char_length(description) <= 2000),
  requirements text not null default '' check (char_length(requirements) <= 1000),
  min_age integer not null default 0 check (min_age between 0 and 99),
  weeks_ahead integer not null default 6 check (weeks_ahead between 1 and 12),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint availability_rules_valid_window check (end_time > start_time),
  constraint availability_rules_shift_fields check (
    kind = 'visit' or (char_length(btrim(title)) between 1 and 100 and char_length(btrim(description)) between 1 and 2000)
  )
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  on_date date not null unique,
  reason text not null default '' check (char_length(reason) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  featured_pet_ids uuid[] not null default '{}' check (cardinality(featured_pet_ids) <= 30),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint events_valid_duration check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);

alter table public.visit_slots
  add column capacity integer not null default 1 check (capacity between 1 and 50),
  add column rule_id uuid references public.availability_rules(id) on delete set null,
  add column event_id uuid references public.events(id) on delete set null;
alter table public.volunteer_shifts
  add column rule_id uuid references public.availability_rules(id) on delete set null,
  add column event_id uuid references public.events(id) on delete set null;

create unique index visit_slots_rule_start_idx on public.visit_slots (rule_id, starts_at) where rule_id is not null;
create unique index volunteer_shifts_rule_start_idx on public.volunteer_shifts (rule_id, starts_at) where rule_id is not null;

-- ---------------------------------------------------------------------------
-- Visits: capacity, party size, and the pets a visitor wants to meet
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column party_size integer not null default 1 check (party_size between 1 and 6),
  add column reminder_sent_at timestamptz;
alter table public.volunteer_registrations add column reminder_sent_at timestamptz;

-- Several groups may now share one slot (up to its capacity); one member still cannot hold two bookings in a slot.
drop index public.appointments_one_booked_member_per_slot_idx;
create unique index appointments_one_booked_member_per_slot_idx
  on public.appointments (slot_id, member_id) where status = 'booked';

create table public.appointment_pets (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  pet_name text not null check (char_length(pet_name) between 1 and 100),
  primary key (appointment_id, pet_id)
);

-- ---------------------------------------------------------------------------
-- Foster pool, requests, and volunteer invitations
-- ---------------------------------------------------------------------------
create table public.foster_pool_optins (
  member_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.foster_requests (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index foster_requests_open_idx on public.foster_requests (created_at) where closed_at is null;

create table public.foster_request_responses (
  request_id uuid not null references public.foster_requests(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined')),
  notified_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (request_id, member_id)
);

create table public.foster_invitations (
  member_id uuid primary key references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  dismissed_at timestamptz
);

-- All of these tables are reached only through the definer functions below.
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.events enable row level security;
alter table public.appointment_pets enable row level security;
alter table public.foster_pool_optins enable row level security;
alter table public.foster_requests enable row level security;
alter table public.foster_request_responses enable row level security;
alter table public.foster_invitations enable row level security;
revoke all on public.availability_rules, public.availability_exceptions, public.events, public.appointment_pets,
  public.foster_pool_optins, public.foster_requests, public.foster_request_responses, public.foster_invitations
  from anon, authenticated;

grant select on public.appointment_pets to authenticated;
create policy "Members can read the pets on their own appointments"
on public.appointment_pets for select to authenticated
using (exists (select 1 from public.appointments a where a.id = appointment_id and a.member_id = (select auth.uid())));
create policy "Staff can read the pets on all appointments"
on public.appointment_pets for select to authenticated
using ((select public.is_staff()));

grant select on public.availability_rules, public.availability_exceptions, public.events,
  public.foster_requests, public.foster_request_responses, public.foster_pool_optins, public.foster_invitations to authenticated;
create policy "Staff can read rules" on public.availability_rules for select to authenticated using ((select public.is_staff()));
create policy "Staff can read exceptions" on public.availability_exceptions for select to authenticated using ((select public.is_staff()));
create policy "Staff can read events" on public.events for select to authenticated using ((select public.is_staff()));
create policy "Staff can read foster requests" on public.foster_requests for select to authenticated using ((select public.is_staff()));
create policy "Staff can read foster responses" on public.foster_request_responses for select to authenticated using ((select public.is_staff()));
create policy "Staff can read the foster pool" on public.foster_pool_optins for select to authenticated using ((select public.is_staff()));
create policy "Staff can read foster invitations" on public.foster_invitations for select to authenticated using ((select public.is_staff()));
create policy "Members can read their own foster responses" on public.foster_request_responses for select to authenticated using ((select auth.uid()) = member_id);
create policy "Members can read their own pool opt-in" on public.foster_pool_optins for select to authenticated using ((select auth.uid()) = member_id);
create policy "Members can read their own invitation" on public.foster_invitations for select to authenticated using ((select auth.uid()) = member_id);

-- ---------------------------------------------------------------------------
-- Visit RPCs (replaced in place; the old two-argument calls keep working)
-- ---------------------------------------------------------------------------
drop function public.list_visit_slots();
create function public.list_visit_slots()
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, available boolean, capacity integer, spots_left integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see available visit times.' using errcode = '28000';
  end if;

  return query
    select slot.id, slot.starts_at, slot.ends_at,
      booked.n < slot.capacity as available,
      slot.capacity,
      greatest(slot.capacity - booked.n, 0)::integer as spots_left
    from public.visit_slots slot
    cross join lateral (
      select count(*)::integer as n from public.appointments appointment
      where appointment.slot_id = slot.id and appointment.status = 'booked'
    ) booked
    where slot.status = 'published' and slot.starts_at > now()
    order by slot.starts_at;
end;
$$;

drop function public.list_my_appointments();
create function public.list_my_appointments()
returns table (
  id uuid,
  slot_id uuid,
  purpose text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  party_size integer,
  pets jsonb
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
    select appointment.id, appointment.slot_id, appointment.purpose, appointment.status, appointment.created_at, appointment.updated_at,
      slot.starts_at, slot.ends_at, appointment.party_size,
      coalesce((select jsonb_agg(jsonb_build_object('id', ap.pet_id, 'name', ap.pet_name) order by ap.pet_name)
        from public.appointment_pets ap where ap.appointment_id = appointment.id), '[]'::jsonb)
    from public.appointments appointment
    join public.visit_slots slot on slot.id = appointment.slot_id
    where appointment.member_id = auth.uid()
    order by slot.starts_at desc, appointment.created_at desc;
end;
$$;

drop function public.book_visit_slot(uuid, text);
create function public.book_visit_slot(
  p_slot_id uuid,
  p_purpose text,
  p_party_size integer default 1,
  p_pet_ids uuid[] default '{}'
)
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
  v_pet_ids uuid[] := coalesce(p_pet_ids, '{}');
  v_found integer;
begin
  if v_member_id is null then
    raise exception 'Log in before booking a visit.' using errcode = '28000';
  end if;
  if char_length(v_purpose) not between 1 and 500 then
    raise exception 'Tell the shelter why you would like to visit, using up to 500 characters.' using errcode = '22023';
  end if;
  if coalesce(p_party_size, 0) not between 1 and 6 then
    raise exception 'A visit can include 1 to 6 people.' using errcode = '22023';
  end if;
  if cardinality(v_pet_ids) > 5 then
    raise exception 'Choose up to 5 animals to meet.' using errcode = '22023';
  end if;
  if v_member_name is null or char_length(v_member_name) > 100 or v_member_email is null or char_length(v_member_email) > 254 then
    raise exception 'Your account profile is incomplete. Update it before booking a visit.' using errcode = '22023';
  end if;

  select * into v_slot from public.visit_slots where id = p_slot_id for update;
  if not found or v_slot.status <> 'published' or v_slot.starts_at <= now() then
    raise exception 'That visit time is no longer available.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.appointments where slot_id = v_slot.id and member_id = v_member_id and status = 'booked') then
    raise exception 'You already have a visit booked at that time.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.appointments where slot_id = v_slot.id and status = 'booked') >= v_slot.capacity then
    raise exception 'That visit time was just booked. Choose another available time.' using errcode = 'P0001';
  end if;

  if cardinality(v_pet_ids) > 0 then
    select count(*) into v_found from public.pets where id = any (v_pet_ids) and status = 'Available' and visits_open;
    if v_found <> cardinality(array(select distinct unnest(v_pet_ids))) then
      raise exception 'One of those animals is not available to visit right now.' using errcode = '22023';
    end if;
  end if;

  insert into public.appointments (member_id, member_name, member_email, slot_id, purpose, party_size)
  values (v_member_id, v_member_name, v_member_email, v_slot.id, v_purpose, p_party_size)
  returning id into v_appointment_id;

  insert into public.appointment_pets (appointment_id, pet_id, pet_name)
  select v_appointment_id, pet.id, pet.name from public.pets pet where pet.id = any (v_pet_ids);

  insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at)
  values (v_appointment_id, v_member_id, 'booked', v_slot.starts_at, v_slot.ends_at);

  return v_appointment_id;
end;
$$;

create or replace function public.reschedule_visit_appointment(p_appointment_id uuid, p_slot_id uuid)
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

  select * into v_appointment from public.appointments where id = p_appointment_id and member_id = v_member_id for update;
  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0001';
  end if;
  if v_appointment.status <> 'booked' then
    raise exception 'This appointment is already canceled.' using errcode = 'P0001';
  end if;
  if v_appointment.slot_id = p_slot_id then
    raise exception 'Choose a different available visit time.' using errcode = '22023';
  end if;

  -- Slots are locked in UUID order so crossed reschedules cannot deadlock.
  perform 1 from public.visit_slots where id in (v_appointment.slot_id, p_slot_id) order by id for update;

  select * into v_current_slot from public.visit_slots where id = v_appointment.slot_id;
  select * into v_destination_slot from public.visit_slots where id = p_slot_id;

  if v_current_slot.starts_at <= now() then
    raise exception 'Past appointments cannot be rescheduled online.' using errcode = 'P0001';
  end if;
  if not found or v_destination_slot.status <> 'published' or v_destination_slot.starts_at <= now() then
    raise exception 'That visit time is no longer available.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.appointments where slot_id = v_destination_slot.id and member_id = v_member_id and status = 'booked') then
    raise exception 'You already have a visit booked at that time.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.appointments where slot_id = v_destination_slot.id and status = 'booked') >= v_destination_slot.capacity then
    raise exception 'That visit time was just booked. Choose another available time.' using errcode = 'P0001';
  end if;

  update public.appointments set slot_id = v_destination_slot.id, updated_at = now(), reminder_sent_at = null where id = v_appointment.id;

  insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at)
  values (v_appointment.id, v_member_id, 'rescheduled', v_destination_slot.starts_at, v_destination_slot.ends_at);
end;
$$;

drop function public.publish_visit_slot(timestamptz, timestamptz);
create function public.publish_visit_slot(p_starts_at timestamptz, p_ends_at timestamptz, p_capacity integer default 1)
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
  if coalesce(p_capacity, 0) not between 1 and 50 then
    raise exception 'Visit capacity must be between 1 and 50 groups.' using errcode = '22023';
  end if;

  insert into public.visit_slots (starts_at, ends_at, created_by, capacity)
  values (p_starts_at, p_ends_at, v_actor_id, p_capacity)
  returning id into v_slot_id;
  return v_slot_id;
end;
$$;

create function public.set_visit_slot_capacity(p_slot_id uuid, p_capacity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change visit capacity.' using errcode = '42501';
  end if;
  if coalesce(p_capacity, 0) not between 1 and 50 then
    raise exception 'Visit capacity must be between 1 and 50 groups.' using errcode = '22023';
  end if;
  perform 1 from public.visit_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Visit time not found.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.appointments where slot_id = p_slot_id and status = 'booked') > p_capacity then
    raise exception 'More groups are already booked than that capacity allows.' using errcode = 'P0001';
  end if;
  update public.visit_slots set capacity = p_capacity where id = p_slot_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recurring hours: rules, exceptions, generation, copy-week
-- ---------------------------------------------------------------------------
create function public.save_availability_rule(
  p_id uuid,
  p_kind text,
  p_weekday integer,
  p_start_time time,
  p_end_time time,
  p_capacity integer,
  p_slot_minutes integer,
  p_title text,
  p_description text,
  p_requirements text,
  p_min_age integer,
  p_weeks_ahead integer,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change open hours.' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.availability_rules (kind, weekday, start_time, end_time, capacity, slot_minutes, title, description, requirements, min_age, weeks_ahead, active, created_by)
    values (p_kind, p_weekday, p_start_time, p_end_time, p_capacity, coalesce(p_slot_minutes, 30), btrim(coalesce(p_title, '')), btrim(coalesce(p_description, '')), btrim(coalesce(p_requirements, '')), coalesce(p_min_age, 0), coalesce(p_weeks_ahead, 6), coalesce(p_active, true), auth.uid())
    returning id into v_id;
  else
    update public.availability_rules set kind = p_kind, weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
      capacity = p_capacity, slot_minutes = coalesce(p_slot_minutes, 30), title = btrim(coalesce(p_title, '')),
      description = btrim(coalesce(p_description, '')), requirements = btrim(coalesce(p_requirements, '')),
      min_age = coalesce(p_min_age, 0), weeks_ahead = coalesce(p_weeks_ahead, 6), active = coalesce(p_active, true)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Open hours rule not found.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Check the day, times, capacity, and (for shifts) the title and duties.' using errcode = '22023';
end;
$$;

create function public.delete_availability_rule(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change open hours.' using errcode = '42501';
  end if;
  delete from public.availability_rules where id = p_id;
end;
$$;

-- Fills in visit slots and volunteer shifts for every active rule. Safe to run repeatedly: existing rows
-- (including ones staff edited or withdrew) are never touched. Callable by staff or by the scheduled job.
create function public.generate_availability()
returns table (visits_created integer, shifts_created integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.availability_rules%rowtype;
  v_day date;
  v_cursor timestamp;
  v_end timestamp;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_visits integer := 0;
  v_shifts integer := 0;
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_staff() then
    raise exception 'Staff access is required to generate open hours.' using errcode = '42501';
  end if;

  for v_rule in select * from public.availability_rules where active loop
    for v_day in select d::date from generate_series(v_today, v_today + v_rule.weeks_ahead * 7, interval '1 day') d loop
      continue when extract(dow from v_day) <> v_rule.weekday;
      continue when exists (select 1 from public.availability_exceptions where on_date = v_day);

      if v_rule.kind = 'visit' then
        v_cursor := v_day + v_rule.start_time;
        v_end := v_day + v_rule.end_time;
        while v_cursor + make_interval(mins => v_rule.slot_minutes) <= v_end loop
          v_start_at := v_cursor at time zone 'America/New_York';
          v_end_at := (v_cursor + make_interval(mins => v_rule.slot_minutes)) at time zone 'America/New_York';
          if v_start_at > now() then
            begin
              insert into public.visit_slots (starts_at, ends_at, capacity, rule_id, created_by)
              values (v_start_at, v_end_at, v_rule.capacity, v_rule.id, auth.uid())
              on conflict do nothing;
              get diagnostics v_count = row_count;
              v_visits := v_visits + v_count;
            exception when exclusion_violation then
              null; -- overlaps a time staff published by hand
            end;
          end if;
          v_cursor := v_cursor + make_interval(mins => v_rule.slot_minutes);
        end loop;
      else
        v_start_at := (v_day + v_rule.start_time) at time zone 'America/New_York';
        v_end_at := (v_day + v_rule.end_time) at time zone 'America/New_York';
        if v_start_at > now() then
          insert into public.volunteer_shifts (title, description, requirements, min_age, starts_at, ends_at, capacity, rule_id, created_by)
          values (v_rule.title, v_rule.description, v_rule.requirements, v_rule.min_age, v_start_at, v_end_at, v_rule.capacity, v_rule.id, auth.uid())
          on conflict do nothing;
          get diagnostics v_count = row_count;
          v_shifts := v_shifts + v_count;
        end if;
      end if;
    end loop;
  end loop;

  return query select v_visits, v_shifts;
end;
$$;

-- A blackout day removes generated times nobody has used. Anything already booked or signed up stays.
create function public.add_availability_exception(p_on_date date, p_reason text)
returns table (visits_removed integer, shifts_removed integer, kept integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visits integer;
  v_shifts integer;
  v_kept integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change open hours.' using errcode = '42501';
  end if;
  insert into public.availability_exceptions (on_date, reason, created_by)
  values (p_on_date, left(btrim(coalesce(p_reason, '')), 200), auth.uid())
  on conflict (on_date) do update set reason = excluded.reason;

  update public.visit_slots slot set status = 'withdrawn'
  where slot.rule_id is not null and slot.status = 'published' and slot.starts_at > now()
    and (slot.starts_at at time zone 'America/New_York')::date = p_on_date
    and not exists (select 1 from public.appointments a where a.slot_id = slot.id and a.status = 'booked');
  get diagnostics v_visits = row_count;

  update public.volunteer_shifts shift set status = 'canceled', updated_at = now()
  where shift.rule_id is not null and shift.status = 'published' and shift.starts_at > now()
    and (shift.starts_at at time zone 'America/New_York')::date = p_on_date
    and not exists (select 1 from public.volunteer_registrations r where r.shift_id = shift.id and r.status = 'registered');
  get diagnostics v_shifts = row_count;

  select
    (select count(*) from public.visit_slots slot where slot.rule_id is not null and slot.status = 'published' and slot.starts_at > now()
       and (slot.starts_at at time zone 'America/New_York')::date = p_on_date)
    + (select count(*) from public.volunteer_shifts shift where shift.rule_id is not null and shift.status = 'published' and shift.starts_at > now()
       and (shift.starts_at at time zone 'America/New_York')::date = p_on_date)
  into v_kept;

  return query select v_visits, v_shifts, v_kept;
end;
$$;

create function public.remove_availability_exception(p_on_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change open hours.' using errcode = '42501';
  end if;
  delete from public.availability_exceptions where on_date = p_on_date;
end;
$$;

-- Copies one week of published visit times and shifts onto another week (the same weekdays and local times).
create function public.copy_schedule_week(p_from_week date, p_to_week date)
returns table (visits_created integer, shifts_created integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offset integer := p_to_week - p_from_week;
  v_visits integer := 0;
  v_shifts integer := 0;
  v_slot public.visit_slots%rowtype;
  v_shift public.volunteer_shifts%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to copy a week.' using errcode = '42501';
  end if;
  if v_offset <= 0 or v_offset > 366 then
    raise exception 'Copy a week onto a later week.' using errcode = '22023';
  end if;

  for v_slot in
    select * from public.visit_slots
    where status = 'published' and event_id is null
      and (starts_at at time zone 'America/New_York')::date >= p_from_week
      and (starts_at at time zone 'America/New_York')::date < p_from_week + 7
  loop
    v_start := ((v_slot.starts_at at time zone 'America/New_York') + make_interval(days => v_offset)) at time zone 'America/New_York';
    v_end := ((v_slot.ends_at at time zone 'America/New_York') + make_interval(days => v_offset)) at time zone 'America/New_York';
    continue when v_start <= now();
    begin
      insert into public.visit_slots (starts_at, ends_at, capacity, created_by) values (v_start, v_end, v_slot.capacity, auth.uid());
      v_visits := v_visits + 1;
    exception when exclusion_violation then
      null;
    end;
  end loop;

  for v_shift in
    select * from public.volunteer_shifts
    where status = 'published' and event_id is null
      and (starts_at at time zone 'America/New_York')::date >= p_from_week
      and (starts_at at time zone 'America/New_York')::date < p_from_week + 7
  loop
    v_start := ((v_shift.starts_at at time zone 'America/New_York') + make_interval(days => v_offset)) at time zone 'America/New_York';
    v_end := ((v_shift.ends_at at time zone 'America/New_York') + make_interval(days => v_offset)) at time zone 'America/New_York';
    continue when v_start <= now();
    if not exists (select 1 from public.volunteer_shifts where title = v_shift.title and starts_at = v_start and status = 'published') then
      insert into public.volunteer_shifts (title, description, requirements, min_age, starts_at, ends_at, capacity, created_by)
      values (v_shift.title, v_shift.description, v_shift.requirements, v_shift.min_age, v_start, v_end, v_shift.capacity, auth.uid());
      v_shifts := v_shifts + 1;
    end if;
  end loop;

  return query select v_visits, v_shifts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Open-house events: visit capacity, volunteer roles, and featured pets in one step
-- ---------------------------------------------------------------------------
create function public.create_event(
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_visit_capacity integer,
  p_slot_minutes integer,
  p_roles jsonb,
  p_pet_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_event_id uuid;
  v_cursor timestamptz;
  v_role jsonb;
  v_minutes integer := coalesce(p_slot_minutes, 30);
begin
  if v_actor is null or not public.is_staff() then
    raise exception 'Staff access is required to create events.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '24 hours' then
    raise exception 'Choose a future event that ends after it starts and lasts no more than 24 hours.' using errcode = '22023';
  end if;
  if v_minutes not between 15 and 240 or coalesce(p_visit_capacity, 0) not between 0 and 50 then
    raise exception 'Check the visit length and capacity.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_roles, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_roles, '[]'::jsonb)) > 10 then
    raise exception 'Add up to 10 volunteer roles.' using errcode = '22023';
  end if;

  insert into public.events (title, description, starts_at, ends_at, featured_pet_ids, created_by)
  values (btrim(p_title), btrim(coalesce(p_description, '')), p_starts_at, p_ends_at, coalesce(p_pet_ids, '{}'), v_actor)
  returning id into v_event_id;

  if p_visit_capacity > 0 then
    -- The event replaces any unbooked hours it overlaps; booked ones block it.
    if exists (
      select 1 from public.visit_slots slot join public.appointments a on a.slot_id = slot.id and a.status = 'booked'
      where slot.status = 'published' and tstzrange(slot.starts_at, slot.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then
      raise exception 'Visits are already booked during that time. Choose another time.' using errcode = 'P0001';
    end if;
    update public.visit_slots set status = 'withdrawn'
    where status = 'published' and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');
    v_cursor := p_starts_at;
    while v_cursor + make_interval(mins => v_minutes) <= p_ends_at loop
      insert into public.visit_slots (starts_at, ends_at, capacity, event_id, created_by)
      values (v_cursor, v_cursor + make_interval(mins => v_minutes), p_visit_capacity, v_event_id, v_actor);
      v_cursor := v_cursor + make_interval(mins => v_minutes);
    end loop;
  end if;

  for v_role in select * from jsonb_array_elements(coalesce(p_roles, '[]'::jsonb)) loop
    insert into public.volunteer_shifts (title, description, requirements, min_age, starts_at, ends_at, capacity, event_id, created_by)
    values (
      btrim(v_role ->> 'title'), btrim(coalesce(nullif(v_role ->> 'description', ''), 'Help at ' || btrim(p_title) || '.')),
      btrim(coalesce(v_role ->> 'requirements', '')), coalesce((v_role ->> 'minAge')::integer, 0),
      p_starts_at, p_ends_at, coalesce((v_role ->> 'capacity')::integer, 1), v_event_id, v_actor
    );
  end loop;

  update public.pets set visits_open = true where id = any (coalesce(p_pet_ids, '{}'));
  return v_event_id;
exception
  when check_violation or not_null_violation or invalid_text_representation then
    raise exception 'Check the event title and each volunteer role (title, capacity, minimum age).' using errcode = '22023';
  when exclusion_violation then
    raise exception 'The event overlaps a visit time that could not be replaced.' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Pet quick actions (bulk). A null argument leaves that setting alone.
-- ---------------------------------------------------------------------------
create function public.set_pet_flags(
  p_pet_ids uuid[],
  p_foster_available boolean default null,
  p_visits_open boolean default null,
  p_needs_walkers boolean default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change pets.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_pet_ids), 0) not between 1 and 200 then
    raise exception 'Choose between 1 and 200 pets.' using errcode = '22023';
  end if;
  update public.pets set
    foster_available = coalesce(p_foster_available, foster_available),
    visits_open = coalesce(p_visits_open, visits_open),
    needs_walkers = coalesce(p_needs_walkers, needs_walkers),
    foster_urgent_at = case when p_foster_available is false then null else foster_urgent_at end
  where id = any (p_pet_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Foster pool: alerts, staff requests, one-click acceptance
-- ---------------------------------------------------------------------------
create function public.set_foster_alerts(p_opt_in boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in to change foster alerts.' using errcode = '28000';
  end if;
  if p_opt_in then
    if not exists (select 1 from public.foster_applications where applicant_id = auth.uid() and status = 'Approved') then
      raise exception 'Foster alerts are for approved fosters. Apply to foster a pet first.' using errcode = 'P0001';
    end if;
    insert into public.foster_pool_optins (member_id) values (auth.uid()) on conflict do nothing;
  else
    delete from public.foster_pool_optins where member_id = auth.uid();
  end if;
end;
$$;

-- Staff request: opens the pet for foster, marks it urgent, and returns the people to email.
create function public.create_foster_request(p_pet_id uuid, p_note text)
returns table (request_id uuid, member_id uuid, member_name text, member_email text, pet_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_pet public.pets%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to request fosters.' using errcode = '42501';
  end if;
  select * into v_pet from public.pets where id = p_pet_id for update;
  if not found or v_pet.status not in ('Available', 'Pending') then
    raise exception 'Choose a pet that is still in the shelter.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.foster_requests where pet_id = p_pet_id and closed_at is null) then
    raise exception 'A foster request for this pet is already open.' using errcode = 'P0001';
  end if;

  update public.pets set foster_available = true, foster_urgent_at = now() where id = p_pet_id;
  insert into public.foster_requests (pet_id, note, created_by) values (p_pet_id, left(btrim(coalesce(p_note, '')), 500), auth.uid())
  returning id into v_request_id;

  insert into public.foster_request_responses (request_id, member_id)
  select v_request_id, optin.member_id from public.foster_pool_optins optin;

  return query
    select v_request_id, u.id,
      coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email)::text,
      u.email::text, v_pet.name
    from public.foster_pool_optins optin
    join auth.users u on u.id = optin.member_id;
end;
$$;

create function public.close_foster_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pet_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to close foster requests.' using errcode = '42501';
  end if;
  update public.foster_requests set closed_at = now() where id = p_request_id and closed_at is null returning pet_id into v_pet_id;
  if v_pet_id is not null and not exists (select 1 from public.foster_requests where pet_id = v_pet_id and closed_at is null) then
    update public.pets set foster_urgent_at = null where id = v_pet_id;
  end if;
end;
$$;

create function public.list_my_foster_requests()
returns table (request_id uuid, pet_id uuid, pet_name text, pet_species text, note text, created_at timestamptz, response text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in to see foster requests.' using errcode = '28000';
  end if;
  return query
    select r.id, p.id, p.name, p.species, r.note, r.created_at, resp.response
    from public.foster_request_responses resp
    join public.foster_requests r on r.id = resp.request_id
    join public.pets p on p.id = r.pet_id
    where resp.member_id = auth.uid() and r.closed_at is null and p.status in ('Available', 'Pending')
    order by r.created_at desc;
end;
$$;

-- One-click acceptance: files a pre-filled application from the member's saved profile and
-- their most recent foster application. Staff still approve it like any other.
create function public.respond_foster_request(p_request_id uuid, p_accept boolean, p_available_from date, p_available_until date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := auth.uid();
  v_request public.foster_requests%rowtype;
  v_pet public.pets%rowtype;
  v_profile public.member_profiles%rowtype;
  v_prior public.foster_applications%rowtype;
  v_name text := coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''), auth.jwt() ->> 'email');
begin
  if v_member is null then
    raise exception 'Log in to answer a foster request.' using errcode = '28000';
  end if;
  select * into v_request from public.foster_requests where id = p_request_id and closed_at is null;
  if not found or not exists (select 1 from public.foster_request_responses where request_id = p_request_id and member_id = v_member) then
    raise exception 'That foster request is no longer open.' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.foster_request_responses set response = 'declined', responded_at = now() where request_id = p_request_id and member_id = v_member;
    return;
  end if;

  select * into v_pet from public.pets where id = v_request.pet_id;
  if v_pet.status not in ('Available', 'Pending') then
    raise exception 'That pet is no longer in the shelter.' using errcode = 'P0001';
  end if;
  select * into v_profile from public.member_profiles where user_id = v_member;
  select * into v_prior from public.foster_applications where applicant_id = v_member order by submitted_at desc limit 1;
  if v_prior.id is null or v_profile.phone is null or v_profile.address is null or v_profile.date_of_birth is null then
    raise exception 'Complete your saved profile and a foster application before accepting.' using errcode = 'P0001';
  end if;
  if p_available_from is null or p_available_until is null or p_available_until < p_available_from or p_available_until > p_available_from + 365 or p_available_from < current_date then
    raise exception 'Choose dates when you can foster, up to a year long.' using errcode = '22023';
  end if;

  insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth,
    pet_id, pet_name, household_summary, foster_experience, available_from, available_until, note)
  values (v_member, v_name, auth.jwt() ->> 'email', v_profile.phone, v_profile.address, v_profile.date_of_birth,
    v_pet.id, v_pet.name, v_prior.household_summary, v_prior.foster_experience, p_available_from, p_available_until, 'Accepted a foster request.')
  on conflict (applicant_id, pet_id) do nothing;

  update public.foster_request_responses set response = 'accepted', responded_at = now() where request_id = p_request_id and member_id = v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- Volunteer to foster
-- ---------------------------------------------------------------------------
create function public.volunteer_foster_candidates(p_min_shifts integer default 5)
returns table (member_id uuid, member_name text, member_email text, shifts integer, hours numeric, invited boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;
  return query
    select r.member_id, max(r.member_name), max(r.member_email), count(*)::integer,
      round(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0)::numeric, 1),
      exists (select 1 from public.foster_invitations i where i.member_id = r.member_id)
    from public.volunteer_registrations r
    join public.volunteer_shifts s on s.id = r.shift_id
    where r.status = 'registered' and s.status = 'published' and s.ends_at < now()
      and not exists (select 1 from public.foster_applications f where f.applicant_id = r.member_id)
    group by r.member_id
    having count(*) >= greatest(coalesce(p_min_shifts, 5), 1)
    order by count(*) desc;
end;
$$;

create function public.invite_volunteer_to_foster(p_member_id uuid)
returns table (member_name text, member_email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;
  insert into public.foster_invitations (member_id, invited_by) values (p_member_id, auth.uid())
  on conflict (member_id) do update set invited_by = excluded.invited_by, invited_at = now(), dismissed_at = null;
  return query select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email)::text, u.email::text from auth.users u where u.id = p_member_id;
end;
$$;

create function public.dismiss_foster_invitation()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.foster_invitations set dismissed_at = now() where member_id = auth.uid();
$$;

create function public.my_involvement()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Log in to see your involvement.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'volunteerShifts', (select count(*) from public.volunteer_registrations r join public.volunteer_shifts s on s.id = r.shift_id
      where r.member_id = v_uid and r.status = 'registered' and s.status = 'published' and s.ends_at < now()),
    'volunteerHours', coalesce((select round(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0)::numeric, 1)
      from public.volunteer_registrations r join public.volunteer_shifts s on s.id = r.shift_id
      where r.member_id = v_uid and r.status = 'registered' and s.status = 'published' and s.ends_at < now()), 0),
    'fosterAlerts', exists (select 1 from public.foster_pool_optins where member_id = v_uid),
    'approvedFoster', exists (select 1 from public.foster_applications where applicant_id = v_uid and status = 'Approved'),
    'fosterInvitation', exists (select 1 from public.foster_invitations where member_id = v_uid and dismissed_at is null)
      and not exists (select 1 from public.foster_applications where applicant_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Member schedule (visits, shifts, and foster placements in one timeline)
-- ---------------------------------------------------------------------------
create function public.list_my_schedule()
returns table (kind text, ref_id uuid, title text, detail text, starts_at timestamptz, ends_at timestamptz, all_day boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in to see your schedule.' using errcode = '28000';
  end if;
  return query
    select 'visit'::text, a.id, 'Shelter visit'::text,
      coalesce((select 'Meeting ' || string_agg(ap.pet_name, ', ' order by ap.pet_name) from public.appointment_pets ap where ap.appointment_id = a.id), a.purpose)::text,
      s.starts_at, s.ends_at, false
    from public.appointments a join public.visit_slots s on s.id = a.slot_id
    where a.member_id = auth.uid() and a.status = 'booked' and s.ends_at > now() - interval '1 day'
    union all
    select 'shift'::text, r.id, sh.title, sh.description, sh.starts_at, sh.ends_at, false
    from public.volunteer_registrations r join public.volunteer_shifts sh on sh.id = r.shift_id
    where r.member_id = auth.uid() and r.status = 'registered' and sh.status = 'published' and sh.ends_at > now() - interval '1 day'
    union all
    select 'foster'::text, f.id, 'Fostering ' || f.pet_name, 'Approved foster placement.',
      f.available_from::timestamp at time zone 'America/New_York',
      (f.available_until + 1)::timestamp at time zone 'America/New_York', true
    from public.foster_applications f
    where f.applicant_id = auth.uid() and f.status = 'Approved' and f.available_until >= current_date
    order by 5;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public "what is open" feed (no personal data)
-- ---------------------------------------------------------------------------
create function public.get_involved_feed()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'visits', coalesce((select jsonb_agg(v order by v ->> 'startsAt') from (
      select jsonb_build_object('startsAt', slot.starts_at, 'endsAt', slot.ends_at, 'spotsLeft', slot.capacity - booked.n) as v
      from public.visit_slots slot
      cross join lateral (select count(*)::integer n from public.appointments a where a.slot_id = slot.id and a.status = 'booked') booked
      where slot.status = 'published' and slot.starts_at > now() and slot.starts_at < now() + interval '14 days' and booked.n < slot.capacity
      order by slot.starts_at limit 12) q), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(v order by v ->> 'startsAt') from (
      select jsonb_build_object('id', sh.id, 'title', sh.title, 'startsAt', sh.starts_at, 'endsAt', sh.ends_at, 'spotsLeft', sh.capacity - reg.n) as v
      from public.volunteer_shifts sh
      cross join lateral (select count(*)::integer n from public.volunteer_registrations r where r.shift_id = sh.id and r.status = 'registered') reg
      where sh.status = 'published' and sh.starts_at > now() and sh.starts_at < now() + interval '14 days' and reg.n < sh.capacity
      order by sh.starts_at limit 12) q), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(v order by v ->> 'startsAt') from (
      select jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description, 'startsAt', e.starts_at, 'endsAt', e.ends_at,
        'pets', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) from public.pets p where p.id = any (e.featured_pet_ids) and p.status = 'Available'), '[]'::jsonb)) as v
      from public.events e where e.ends_at > now() and e.starts_at < now() + interval '60 days' order by e.starts_at limit 6) q), '[]'::jsonb),
    'foster', jsonb_build_object(
      'open', (select count(*) from public.pets where status = 'Available' and foster_available),
      'urgent', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) from public.pets p where p.status = 'Available' and p.foster_urgent_at is not null), '[]'::jsonb))
  );
$$;

-- ---------------------------------------------------------------------------
-- Staff "needs attention" report
-- ---------------------------------------------------------------------------
create function public.staff_attention(p_stale_days integer default 45)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_n integer;
  v_ids jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;

  select count(*) into v_n from public.visit_slots slot
  where slot.status = 'published' and slot.starts_at > now() and slot.starts_at < now() + interval '7 days'
    and (select count(*) from public.appointments a where a.slot_id = slot.id and a.status = 'booked') < slot.capacity;
  if v_n = 0 then
    v_items := v_items || jsonb_build_object('kind', 'no_visit_times', 'title', 'No open visit times in the next 7 days',
      'detail', 'Visitors cannot book until you add open hours or publish times.', 'action', 'generate');
  end if;

  for v_ids in
    select jsonb_build_object('kind', 'thin_shift', 'title', sh.title || ' has no volunteers yet',
      'detail', to_char(sh.starts_at at time zone 'America/New_York', 'Dy Mon DD HH12:MI AM') || ', ' || sh.capacity || ' spots', 'action', 'schedule', 'refId', sh.id)
    from public.volunteer_shifts sh
    where sh.status = 'published' and sh.starts_at > now() and sh.starts_at < now() + interval '7 days'
      and not exists (select 1 from public.volunteer_registrations r where r.shift_id = sh.id and r.status = 'registered')
    order by sh.starts_at limit 5
  loop
    v_items := v_items || v_ids;
  end loop;

  select count(*), coalesce(jsonb_agg(id), '[]'::jsonb) into v_n, v_ids from (
    select id from public.pets where status = 'Available' and not foster_available and source_name = ''
      and intake_date < current_date - greatest(coalesce(p_stale_days, 45), 1) order by intake_date limit 50) q;
  if v_n > 0 then
    v_items := v_items || jsonb_build_object('kind', 'stale_pets', 'title', v_n || ' pet' || case when v_n = 1 then '' else 's' end || ' here over ' || p_stale_days || ' days and not open to foster',
      'detail', 'Opening them to foster gets them out of the kennel sooner.', 'action', 'open_foster', 'petIds', v_ids);
  end if;

  for v_ids in
    select jsonb_build_object('kind', 'foster_ending', 'title', f.pet_name || ' foster window ends ' || to_char(f.available_until, 'Mon DD'),
      'detail', f.applicant_name || ' is fostering. Arrange a return or an extension.', 'action', 'fosters', 'refId', f.id)
    from public.foster_applications f
    where f.status = 'Approved' and f.available_until between current_date and current_date + 7
    order by f.available_until limit 5
  loop
    v_items := v_items || v_ids;
  end loop;

  for v_ids in
    select jsonb_build_object('kind', 'stale_request', 'title', 'Foster request for ' || p.name || ' has no takers after 48 hours',
      'detail', 'Close it or widen the search.', 'action', 'fosters', 'refId', r.id)
    from public.foster_requests r join public.pets p on p.id = r.pet_id
    where r.closed_at is null and r.created_at < now() - interval '48 hours'
      and not exists (select 1 from public.foster_request_responses x where x.request_id = r.id and x.response = 'accepted')
    order by r.created_at limit 5
  loop
    v_items := v_items || v_ids;
  end loop;

  select count(*) into v_n from public.volunteer_foster_candidates(5) c where not c.invited;
  if v_n > 0 then
    v_items := v_items || jsonb_build_object('kind', 'foster_candidates', 'title', v_n || ' volunteer' || case when v_n = 1 then '' else 's' end || ' could be invited to foster',
      'detail', 'They have completed several shifts and never applied to foster.', 'action', 'fosters');
  end if;

  return v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled job helpers (service role only)
-- ---------------------------------------------------------------------------
-- Claims reminders that are due: the visit or shift starts within 24 hours and was booked a while ago.
create function public.claim_due_reminders()
returns table (kind text, member_name text, member_email text, title text, starts_at timestamptz, ends_at timestamptz, detail text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the scheduled job can claim reminders.' using errcode = '42501';
  end if;
  return query
    with v as (
      update public.appointments a set reminder_sent_at = now()
      from public.visit_slots s
      where s.id = a.slot_id and a.status = 'booked' and a.reminder_sent_at is null
        and s.starts_at > now() and s.starts_at <= now() + interval '24 hours' and a.created_at < now() - interval '2 hours'
      returning a.id, a.member_name, a.member_email, s.starts_at, s.ends_at, a.purpose
    ), r as (
      update public.volunteer_registrations g set reminder_sent_at = now()
      from public.volunteer_shifts sh
      where sh.id = g.shift_id and g.status = 'registered' and sh.status = 'published' and g.reminder_sent_at is null
        and sh.starts_at > now() and sh.starts_at <= now() + interval '24 hours' and g.created_at < now() - interval '2 hours'
      returning g.member_name, g.member_email, sh.title, sh.starts_at, sh.ends_at, sh.description
    )
    select 'visit'::text, v.member_name, v.member_email, 'Shelter visit'::text, v.starts_at, v.ends_at, v.purpose from v
    union all
    select 'shift'::text, r.member_name, r.member_email, r.title, r.starts_at, r.ends_at, r.description from r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.list_visit_slots(), public.list_my_appointments(), public.book_visit_slot(uuid, text, integer, uuid[]), public.reschedule_visit_appointment(uuid, uuid),
  public.publish_visit_slot(timestamptz, timestamptz, integer), public.set_visit_slot_capacity(uuid, integer),
  public.save_availability_rule(uuid, text, integer, time, time, integer, integer, text, text, text, integer, integer, boolean),
  public.delete_availability_rule(uuid), public.generate_availability(), public.add_availability_exception(date, text),
  public.remove_availability_exception(date), public.copy_schedule_week(date, date),
  public.create_event(text, text, timestamptz, timestamptz, integer, integer, jsonb, uuid[]),
  public.set_pet_flags(uuid[], boolean, boolean, boolean), public.set_foster_alerts(boolean), public.create_foster_request(uuid, text),
  public.close_foster_request(uuid), public.list_my_foster_requests(), public.respond_foster_request(uuid, boolean, date, date),
  public.volunteer_foster_candidates(integer), public.invite_volunteer_to_foster(uuid), public.dismiss_foster_invitation(),
  public.my_involvement(), public.list_my_schedule(), public.get_involved_feed(), public.staff_attention(integer), public.claim_due_reminders()
  from public, anon, authenticated;

grant execute on function
  public.list_visit_slots(), public.list_my_appointments(), public.book_visit_slot(uuid, text, integer, uuid[]), public.reschedule_visit_appointment(uuid, uuid),
  public.publish_visit_slot(timestamptz, timestamptz, integer), public.set_visit_slot_capacity(uuid, integer),
  public.save_availability_rule(uuid, text, integer, time, time, integer, integer, text, text, text, integer, integer, boolean),
  public.delete_availability_rule(uuid), public.generate_availability(), public.add_availability_exception(date, text),
  public.remove_availability_exception(date), public.copy_schedule_week(date, date),
  public.create_event(text, text, timestamptz, timestamptz, integer, integer, jsonb, uuid[]),
  public.set_pet_flags(uuid[], boolean, boolean, boolean), public.set_foster_alerts(boolean), public.create_foster_request(uuid, text),
  public.close_foster_request(uuid), public.list_my_foster_requests(), public.respond_foster_request(uuid, boolean, date, date),
  public.volunteer_foster_candidates(integer), public.invite_volunteer_to_foster(uuid), public.dismiss_foster_invitation(),
  public.my_involvement(), public.list_my_schedule(), public.staff_attention(integer)
  to authenticated;

grant execute on function public.get_involved_feed() to anon, authenticated;
grant execute on function public.generate_availability(), public.claim_due_reminders() to service_role;
