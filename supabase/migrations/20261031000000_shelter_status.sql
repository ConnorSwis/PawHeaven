-- Shelter status and "needs help" animals.
--
-- Staff set kennel capacity per species group, and flag animals who need help with a reason from a
-- fixed list. The public site shows how full each group is and puts flagged animals first. Nothing
-- private is added to a public table: the flag is a reason code and a date, with no notes.
--
-- Expand-only: new columns are defaulted, new tables and functions are additive, and
-- staff_attention(integer) keeps its signature and only gains items.

-- ---------------------------------------------------------------------------
-- "Needs help" flag on pets
-- ---------------------------------------------------------------------------
alter table public.pets
  add column help_reason text not null default '' check (help_reason in ('', 'home_soon', 'foster', 'long_stay', 'medical')),
  add column help_since timestamptz;

comment on column public.pets.help_reason is
  'Why staff flagged the animal as needing help: home_soon, foster, long_stay, or medical. Empty means not flagged. Public.';
comment on column public.pets.help_since is 'When the current flag was set; kept in step with help_reason by a trigger.';

create index pets_help_since_idx on public.pets (help_since) where help_reason <> '';

-- Keeps help_since honest however the flag is changed, and drops the flag when the animal is no longer here.
create function public.pets_keep_help_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status not in ('Available', 'Pending') then
    new.help_reason := '';
  end if;
  if new.help_reason = '' then
    new.help_since := null;
  elsif tg_op = 'INSERT' then
    new.help_since := now();
  elsif old.help_reason = '' then
    new.help_since := now();
  else
    new.help_since := old.help_since;
  end if;
  return new;
end;
$$;

create trigger pets_keep_help_state
before insert or update of help_reason, status on public.pets
for each row execute function public.pets_keep_help_state();

-- ---------------------------------------------------------------------------
-- Kennel capacity
-- ---------------------------------------------------------------------------
create table public.shelter_capacity (
  species_group text primary key check (species_group in ('Dog', 'Cat', 'Other')),
  kennels integer not null default 0 check (kennels between 0 and 500),
  held_back integer not null default 0 check (held_back between 0 and 500),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint shelter_capacity_held_back_fits check (held_back <= kennels)
);

comment on table public.shelter_capacity is
  'Kennels per species group. Zero kennels means not set, so no meter or banner is shown for that group.';

insert into public.shelter_capacity (species_group) values ('Dog'), ('Cat'), ('Other');

alter table public.shelter_capacity enable row level security;
revoke all on public.shelter_capacity from anon, authenticated;
grant select on public.shelter_capacity to authenticated;
create policy "Staff can read kennel capacity"
on public.shelter_capacity for select to authenticated
using ((select public.is_staff()));

-- The group a species is counted in: Dog, Cat, or Other.
create function public.species_group(p_species text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(p_species)) when 'dog' then 'Dog' when 'cat' then 'Cat' else 'Other' end;
$$;

-- ---------------------------------------------------------------------------
-- Public status: counts and levels only, nothing about individual animals
-- ---------------------------------------------------------------------------
create function public.get_shelter_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(g.row order by g.ord) from (
        select s.ord, jsonb_build_object(
          'group', s.species_group, 'kennels', s.kennels, 'heldBack', s.held_back, 'used', s.used, 'ready', s.ready,
          'percent', case when s.usable > 0 then round(100.0 * s.used / s.usable)::integer end,
          'level', case
            when s.usable <= 0 then 'unset'
            when s.used > s.usable then 'over'
            when s.used = s.usable then 'full'
            when s.used * 100 >= s.usable * 85 then 'busy'
            else 'ok' end
        ) as row
        from (
          select c.species_group, c.kennels, c.held_back, c.kennels - c.held_back as usable,
            case c.species_group when 'Dog' then 1 when 'Cat' then 2 else 3 end as ord,
            (select count(*)::integer from public.pets p where public.species_group(p.species) = c.species_group
              and p.status in ('Available', 'Pending') and p.housing <> 'Foster home') as used,
            (select count(*)::integer from public.pets p where public.species_group(p.species) = c.species_group
              and p.status = 'Available') as ready
          from public.shelter_capacity c
        ) s
      ) g), '[]'::jsonb),
    'needHelp', (select count(*)::integer from public.pets where status = 'Available' and help_reason <> '')
  );
$$;

comment on function public.get_shelter_status() is
  'How full each species group is (percent and level) plus the number of animals who need help. No individual records.';

-- ---------------------------------------------------------------------------
-- Staff changes
-- ---------------------------------------------------------------------------
create function public.set_shelter_capacity(p_group text, p_kennels integer, p_held_back integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change capacity.' using errcode = '42501';
  end if;
  if p_group not in ('Dog', 'Cat', 'Other') then
    raise exception 'Choose Dog, Cat, or Other.' using errcode = '22023';
  end if;
  if p_kennels is null or p_kennels not between 0 and 500 then
    raise exception 'Kennels must be between 0 and 500.' using errcode = '22023';
  end if;
  if p_held_back is null or p_held_back not between 0 and p_kennels then
    raise exception 'Held-back kennels must be between 0 and the number of kennels.' using errcode = '22023';
  end if;
  update public.shelter_capacity
  set kennels = p_kennels, held_back = p_held_back, updated_by = auth.uid(), updated_at = now()
  where species_group = p_group;
end;
$$;

-- Flags animals as needing help, or clears the flag with an empty reason.
create function public.set_pet_help(p_pet_ids uuid[], p_reason text)
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
  if p_reason is null or p_reason not in ('', 'home_soon', 'foster', 'long_stay', 'medical') then
    raise exception 'Choose a reason from the list.' using errcode = '22023';
  end if;
  update public.pets set help_reason = p_reason
  where id = any (p_pet_ids) and (p_reason = '' or status in ('Available', 'Pending'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff "needs attention" report: three new items (full body, signature unchanged)
-- ---------------------------------------------------------------------------
create or replace function public.staff_attention(p_stale_days integer default 45)
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

  -- Shelter status: kennels nearly full, and animals who need help but have no takers.
  for v_ids in
    select jsonb_build_object('kind', 'capacity_high', 'title', initcap(s.species_group) || ' kennels are ' || s.pct || '% full',
      'detail', 'Mark animals who need help, open them to foster, or ask the foster pool.', 'action', 'animals')
    from (
      select c.species_group, round(100.0 * u.used / (c.kennels - c.held_back))::integer as pct
      from public.shelter_capacity c
      cross join lateral (select count(*) used from public.pets p where public.species_group(p.species) = c.species_group
        and p.status in ('Available', 'Pending') and p.housing <> 'Foster home') u
      where c.kennels - c.held_back > 0 and u.used * 100 >= (c.kennels - c.held_back) * 90
    ) s
  loop
    v_items := v_items || v_ids;
  end loop;

  select count(*), coalesce(jsonb_agg(id), '[]'::jsonb) into v_n, v_ids from (
    select p.id from public.pets p
    where p.status = 'Available' and p.help_reason <> '' and p.help_since < now() - interval '7 days'
      and not exists (select 1 from public.adoption_applications a where a.pet_id = p.id and a.status in ('Pending', 'In review', 'Approved'))
      and not exists (select 1 from public.foster_requests r where r.pet_id = p.id and r.closed_at is null)
    order by p.help_since limit 50) q;
  if v_n > 0 then
    v_items := v_items || jsonb_build_object('kind', 'help_unattended', 'title', v_n || ' animal' || case when v_n = 1 then '' else 's' end || ' flagged for help over a week with no applications',
      'detail', 'Ask the foster pool, feature them in a newsletter, or check their listing.', 'action', 'animals', 'petIds', v_ids);
  end if;

  select count(*), coalesce(jsonb_agg(id), '[]'::jsonb) into v_n, v_ids from (
    select p.id from public.pets p
    where p.status = 'Available' and p.help_reason = '' and p.source_name = '' and p.intake_date < current_date - 90
      and not exists (select 1 from public.adoption_applications a where a.pet_id = p.id and a.status in ('Pending', 'In review', 'Approved'))
    order by p.intake_date limit 50) q;
  if v_n > 0 then
    v_items := v_items || jsonb_build_object('kind', 'long_stay_help', 'title', v_n || ' animal' || case when v_n = 1 then '' else 's' end || ' here over 90 days with no application',
      'detail', 'Marking them as needing help shows them first on the website.', 'action', 'mark_help', 'petIds', v_ids);
  end if;

  return v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.species_group(text), public.get_shelter_status(), public.set_shelter_capacity(text, integer, integer), public.set_pet_help(uuid[], text)
  from public, anon, authenticated;

grant execute on function public.species_group(text) to anon, authenticated;
grant execute on function public.get_shelter_status() to anon, authenticated;
grant execute on function public.set_shelter_capacity(text, integer, integer), public.set_pet_help(uuid[], text) to authenticated;
