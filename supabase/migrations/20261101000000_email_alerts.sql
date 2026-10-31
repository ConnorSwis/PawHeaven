-- Email pipeline, saved animals and searches, alerts, and the newsletter.
--
-- One queue (notification_outbox) holds every optional email: new-match digests, changes to saved
-- animals, newsletter issues. Preferences are checked when a row is queued, and the hourly Worker
-- job drains the queue. Visit and shift reminders and foster-pool emails keep their existing paths.
--
-- Expand-only: new tables and functions, a trigger on pets, and staff_attention(integer) keeps its
-- signature and only gains an item. No table here is readable by guests; guests reach only the
-- narrow functions the API calls with the service role.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- "Baby, young, adult, or senior" from a free-text age such as "6 years 10 months". Mirrors the
-- website's ageBand(): senior is 7 and older.
create function public.age_band(p_age text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := lower(coalesce(p_age, ''));
  v_years numeric := 0;
  v_found boolean := false;
  v_match text[];
begin
  for v_match in select regexp_matches(v_text, '(\d+(?:\.\d+)?)\s*(year|yr|y|month|mo|week|wk|day)', 'g') loop
    v_found := true;
    v_years := v_years + case
      when v_match[2] like 'y%' then v_match[1]::numeric
      when v_match[2] like 'mo%' then v_match[1]::numeric / 12
      when v_match[2] like 'w%' then v_match[1]::numeric / 52
      else v_match[1]::numeric / 365 end;
  end loop;
  if not v_found then
    if v_text ~ 'puppy|kitten|baby' then v_years := 0.5;
    elsif v_text ~ 'senior' then v_years := 7;
    else return null; end if;
  end if;
  return case when v_years < 1 then 'baby' when v_years < 3 then 'young' when v_years < 7 then 'adult' else 'senior' end;
end;
$$;

-- The next 8 am in the shelter's time zone, when daily digests go out.
create function public.next_digest_time()
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := date_trunc('day', timezone('America/New_York', now())) + interval '8 hours';
  v_at timestamptz := timezone('America/New_York', v_local);
begin
  if v_at <= now() then
    v_at := timezone('America/New_York', v_local + interval '1 day');
  end if;
  return v_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Outbox
-- ---------------------------------------------------------------------------
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('match', 'saved_change', 'newsletter')),
  email text not null check (char_length(email) between 3 and 254),
  member_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4000),
  dedupe_key text unique,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_at timestamptz not null default now()
);
create index notification_outbox_due_idx on public.notification_outbox (send_after) where sent_at is null;
create index notification_outbox_member_idx on public.notification_outbox (member_id) where sent_at is null;
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
comment on table public.notification_outbox is 'Queued optional email. Written by triggers and staff functions, drained by the hourly Worker job with the service role.';

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
create table public.member_email_prefs (
  member_id uuid primary key references auth.users(id) on delete cascade,
  match_digest boolean not null default true,
  saved_changes boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.member_email_prefs enable row level security;
revoke all on public.member_email_prefs from anon, authenticated;
comment on table public.member_email_prefs is 'Optional-email choices. A member with no row has the defaults. Newsletter lives in email_subscribers; foster alerts in foster_pool_optins.';

-- ---------------------------------------------------------------------------
-- Saved animals and saved searches (members only; guests keep hearts in the browser)
-- ---------------------------------------------------------------------------
create table public.saved_pets (
  member_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, pet_id)
);
create index saved_pets_pet_idx on public.saved_pets (pet_id);
alter table public.saved_pets enable row level security;
revoke all on public.saved_pets from anon, authenticated;

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  filters jsonb not null check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 1000),
  created_at timestamptz not null default now(),
  unique (member_id, filters)
);
create index saved_searches_member_idx on public.saved_searches (member_id);
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from anon, authenticated;
comment on column public.saved_searches.filters is
  'Directory filters: species (dog, cat, other), size, age (baby, young, adult, senior), sex, energy, and the booleans kids, dogs, cats, foster set to true.';

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------
create table public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  member_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  requested_at timestamptz not null default now()
);
create unique index email_subscribers_email_idx on public.email_subscribers (lower(email));
alter table public.email_subscribers enable row level security;
revoke all on public.email_subscribers from anon, authenticated;
grant select on public.email_subscribers to authenticated;
create policy "Staff can read newsletter subscribers"
on public.email_subscribers for select to authenticated
using ((select public.is_staff()));

create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(btrim(subject)) between 1 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  blocks text[] not null default '{}' check (blocks <@ array['help', 'newest', 'events', 'shifts']),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.newsletters enable row level security;
revoke all on public.newsletters from anon, authenticated;
grant select, insert, update, delete on public.newsletters to authenticated;
create policy "Staff can read newsletters" on public.newsletters for select to authenticated using ((select public.is_staff()));
create policy "Staff can write drafts" on public.newsletters for insert to authenticated with check ((select public.is_staff()) and status = 'draft');
create policy "Staff can edit drafts" on public.newsletters for update to authenticated using ((select public.is_staff()) and status = 'draft') with check ((select public.is_staff()) and status = 'draft');
create policy "Staff can delete drafts" on public.newsletters for delete to authenticated using ((select public.is_staff()) and status = 'draft');

-- ---------------------------------------------------------------------------
-- Matching: one definition of "this animal fits that search"
-- ---------------------------------------------------------------------------
create function public.pet_matches_search(p_pet public.pets, p_filters jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    (coalesce(p_filters ->> 'species', '') = '' or lower(public.species_group(p_pet.species)) = p_filters ->> 'species')
    and (coalesce(p_filters ->> 'size', '') = '' or lower(replace(p_pet.size, ' ', '-')) = p_filters ->> 'size')
    and (coalesce(p_filters ->> 'age', '') = '' or public.age_band(p_pet.age_label) = p_filters ->> 'age')
    and (coalesce(p_filters ->> 'sex', '') = '' or lower(p_pet.sex) = p_filters ->> 'sex')
    and (coalesce(p_filters ->> 'energy', '') = '' or lower(p_pet.energy_level) = p_filters ->> 'energy')
    and (coalesce(p_filters ->> 'kids', '') <> 'true' or p_pet.good_with_kids = 'Yes')
    and (coalesce(p_filters ->> 'dogs', '') <> 'true' or p_pet.good_with_dogs = 'Yes')
    and (coalesce(p_filters ->> 'cats', '') <> 'true' or p_pet.good_with_cats = 'Yes')
    and (coalesce(p_filters ->> 'foster', '') <> 'true' or p_pet.foster_available);
$$;

-- ---------------------------------------------------------------------------
-- Queue alerts when an animal arrives or changes
-- ---------------------------------------------------------------------------
create function public.pets_queue_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Available' and (tg_op = 'INSERT' or old.status is distinct from 'Available') then
    insert into public.notification_outbox (kind, email, member_id, payload, dedupe_key, send_after)
    select distinct on (s.member_id) 'match', u.email, s.member_id,
      jsonb_build_object('petId', new.id, 'petName', new.name, 'searchLabel', s.label),
      'match:' || s.member_id || ':' || new.id, public.next_digest_time()
    from public.saved_searches s
    join auth.users u on u.id = s.member_id
    left join public.member_email_prefs pref on pref.member_id = s.member_id
    where coalesce(pref.match_digest, true) and u.email is not null and public.pet_matches_search(new, s.filters)
    order by s.member_id, s.created_at
    on conflict (dedupe_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('Available', 'Pending', 'Adopted') then
    insert into public.notification_outbox (kind, email, member_id, payload, dedupe_key, send_after)
    select 'saved_change', u.email, sp.member_id,
      jsonb_build_object('petId', new.id, 'petName', new.name, 'status', new.status),
      'saved:' || sp.member_id || ':' || new.id || ':' || new.status || ':' || current_date, public.next_digest_time()
    from public.saved_pets sp
    join auth.users u on u.id = sp.member_id
    left join public.member_email_prefs pref on pref.member_id = sp.member_id
    where sp.pet_id = new.id and coalesce(pref.saved_changes, true) and u.email is not null
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;

create trigger pets_queue_alerts
after insert or update of status on public.pets
for each row execute function public.pets_queue_alerts();

-- ---------------------------------------------------------------------------
-- Member functions
-- ---------------------------------------------------------------------------
create function public.list_saved_pets()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Log in to see your saved animals.' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(pet_id order by created_at desc) from public.saved_pets where member_id = auth.uid()), '[]'::jsonb);
end;
$$;

-- Adds animals to the member's saved list (unknown ids are ignored; the list holds up to 100) and returns it.
create function public.merge_saved_pets(p_pet_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Log in to save animals.' using errcode = '28000'; end if;
  if coalesce(cardinality(p_pet_ids), 0) > 100 then raise exception 'Save up to 100 animals at a time.' using errcode = '22023'; end if;
  insert into public.saved_pets (member_id, pet_id)
  select v_uid, p.id from public.pets p
  where p.id = any (coalesce(p_pet_ids, '{}')) and (select count(*) from public.saved_pets where member_id = v_uid) < 100
  on conflict do nothing;
  return public.list_saved_pets();
end;
$$;

create function public.unsave_pet(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Log in to change your saved animals.' using errcode = '28000'; end if;
  delete from public.saved_pets where member_id = auth.uid() and pet_id = p_pet_id;
  return public.list_saved_pets();
end;
$$;

create function public.list_my_searches()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Log in to see your saved searches.' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'filters', filters, 'createdAt', created_at) order by created_at desc)
    from public.saved_searches where member_id = auth.uid()), '[]'::jsonb);
end;
$$;

create function public.create_saved_search(p_label text, p_filters jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Log in to save a search.' using errcode = '28000'; end if;
  if (select count(*) from public.saved_searches where member_id = v_uid) >= 10 then
    raise exception 'You can keep up to 10 saved searches. Remove one first.' using errcode = '22023';
  end if;
  insert into public.saved_searches (member_id, label, filters) values (v_uid, btrim(p_label), p_filters)
  on conflict (member_id, filters) do nothing;
  return public.list_my_searches();
end;
$$;

create function public.delete_saved_search(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Log in to change your saved searches.' using errcode = '28000'; end if;
  delete from public.saved_searches where id = p_id and member_id = auth.uid();
  return public.list_my_searches();
end;
$$;

create function public.get_my_email_prefs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'Log in to see your email choices.' using errcode = '28000'; end if;
  select email into v_email from auth.users where id = v_uid;
  return jsonb_build_object(
    'matchDigest', coalesce((select match_digest from public.member_email_prefs where member_id = v_uid), true),
    'savedChanges', coalesce((select saved_changes from public.member_email_prefs where member_id = v_uid), true),
    'newsletter', exists (select 1 from public.email_subscribers where lower(email) = lower(v_email) and status = 'confirmed'),
    'fosterAlerts', exists (select 1 from public.foster_pool_optins where member_id = v_uid),
    'approvedFoster', exists (select 1 from public.foster_applications where applicant_id = v_uid and status = 'Approved'),
    'savedSearches', (select count(*) from public.saved_searches where member_id = v_uid),
    'savedAnimals', (select count(*) from public.saved_pets where member_id = v_uid)
  );
end;
$$;

-- A null argument leaves that choice alone. Turning the newsletter on subscribes the account email
-- (already verified at sign-up, so no confirmation email); turning it off unsubscribes it.
create function public.set_my_email_prefs(p_match_digest boolean default null, p_saved_changes boolean default null, p_newsletter boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'Log in to change your email choices.' using errcode = '28000'; end if;
  select email into v_email from auth.users where id = v_uid;
  insert into public.member_email_prefs (member_id, match_digest, saved_changes)
  values (v_uid, coalesce(p_match_digest, true), coalesce(p_saved_changes, true))
  on conflict (member_id) do update set
    match_digest = coalesce(p_match_digest, public.member_email_prefs.match_digest),
    saved_changes = coalesce(p_saved_changes, public.member_email_prefs.saved_changes),
    updated_at = now();
  if p_match_digest is false then
    delete from public.notification_outbox where member_id = v_uid and kind = 'match' and sent_at is null;
  end if;
  if p_saved_changes is false then
    delete from public.notification_outbox where member_id = v_uid and kind = 'saved_change' and sent_at is null;
  end if;
  if p_newsletter is true and v_email is not null then
    insert into public.email_subscribers (email, member_id, status, confirmed_at)
    values (lower(v_email), v_uid, 'confirmed', now())
    on conflict (lower(email)) do update set status = 'confirmed', member_id = v_uid, confirmed_at = now(), unsubscribed_at = null;
  elsif p_newsletter is false and v_email is not null then
    update public.email_subscribers set status = 'unsubscribed', unsubscribed_at = now() where lower(email) = lower(v_email) and status <> 'unsubscribed';
    delete from public.notification_outbox where member_id = v_uid and kind = 'newsletter' and sent_at is null;
  end if;
  return public.get_my_email_prefs();
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest newsletter and unsubscribe (service role only: the API signs and verifies the links)
-- ---------------------------------------------------------------------------
create function public.subscribe_newsletter(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.email_subscribers;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  select * into v_row from public.email_subscribers where lower(email) = v_email;
  if found and v_row.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed');
  elsif found and v_row.requested_at > now() - interval '10 minutes' then
    -- A confirmation email went out moments ago: do not send another, so the form cannot be used to flood an inbox.
    return jsonb_build_object('status', 'pending');
  elsif found then
    update public.email_subscribers set status = 'pending', unsubscribed_at = null, requested_at = now(), token = replace(gen_random_uuid()::text, '-', '')
    where id = v_row.id returning * into v_row;
  else
    insert into public.email_subscribers (email, member_id) values (v_email, (select id from auth.users where lower(email) = v_email limit 1))
    returning * into v_row;
  end if;
  return jsonb_build_object('status', 'pending', 'token', v_row.token);
end;
$$;

create function public.confirm_newsletter(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_subscribers set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), unsubscribed_at = null
  where token = p_token and status in ('pending', 'confirmed');
  return found;
end;
$$;

-- Scope: newsletter, alerts (new-match digest and saved-animal changes), or all optional email.
create function public.unsubscribe_email(p_email text, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_member uuid;
begin
  if p_scope not in ('newsletter', 'alerts', 'all') then
    raise exception 'Choose newsletter, alerts, or all.' using errcode = '22023';
  end if;
  select id into v_member from auth.users where lower(email) = v_email limit 1;
  if p_scope in ('newsletter', 'all') then
    update public.email_subscribers set status = 'unsubscribed', unsubscribed_at = now() where lower(email) = v_email and status <> 'unsubscribed';
    delete from public.notification_outbox where lower(email) = v_email and kind = 'newsletter' and sent_at is null;
  end if;
  if p_scope in ('alerts', 'all') and v_member is not null then
    insert into public.member_email_prefs (member_id, match_digest, saved_changes) values (v_member, false, false)
    on conflict (member_id) do update set match_digest = false, saved_changes = false, updated_at = now();
    delete from public.notification_outbox where member_id = v_member and kind in ('match', 'saved_change') and sent_at is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker job helpers (service role only)
-- ---------------------------------------------------------------------------
create function public.claim_notifications(p_limit integer default 200)
returns setof public.notification_outbox
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select id from public.notification_outbox
    where sent_at is null and attempts < 3 and send_after <= now() and (claimed_at is null or claimed_at < now() - interval '15 minutes')
    order by send_after, created_at
    limit greatest(least(coalesce(p_limit, 200), 500), 1)
    for update skip locked
  )
  update public.notification_outbox o set claimed_at = now(), attempts = o.attempts + 1
  from picked where o.id = picked.id
  returning o.*;
$$;

-- Marks rows sent (no error) or failed (they retry on a later run until three attempts are used).
-- A newsletter turns "sent" once none of its rows can still be delivered.
create function public.finish_notifications(p_ids uuid[], p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error is null then
    update public.notification_outbox set sent_at = now(), last_error = null, claimed_at = null where id = any (p_ids);
  else
    update public.notification_outbox set last_error = left(p_error, 300), claimed_at = null where id = any (p_ids);
  end if;
  update public.newsletters n set status = 'sent', sent_at = now()
  where n.status = 'sending'
    and n.id in (select (payload ->> 'newsletterId')::uuid from public.notification_outbox where id = any (p_ids) and kind = 'newsletter')
    and not exists (
      select 1 from public.notification_outbox o
      where o.kind = 'newsletter' and o.payload ->> 'newsletterId' = n.id::text and o.sent_at is null and o.attempts < 3);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------
-- Queues a draft for every confirmed subscriber and locks the draft. Returns how many people it goes to.
create function public.queue_newsletter(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to send a newsletter.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.newsletters where id = p_id and status = 'draft') then
    raise exception 'Only a draft can be sent.' using errcode = '22023';
  end if;
  insert into public.notification_outbox (kind, email, member_id, payload, dedupe_key, send_after)
  select 'newsletter', s.email, s.member_id, jsonb_build_object('newsletterId', p_id), 'nl:' || p_id || ':' || s.id, now()
  from public.email_subscribers s where s.status = 'confirmed'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no confirmed subscribers yet.' using errcode = '22023';
  end if;
  update public.newsletters set status = 'sending', recipient_count = v_count, updated_at = now() where id = p_id;
  return v_count;
end;
$$;

create function public.remove_subscriber(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to change subscribers.' using errcode = '42501';
  end if;
  update public.email_subscribers set status = 'unsubscribed', unsubscribed_at = now() where id = p_id and status <> 'unsubscribed';
  delete from public.notification_outbox where kind = 'newsletter' and sent_at is null
    and lower(email) = (select lower(email) from public.email_subscribers where id = p_id);
end;
$$;

create function public.outreach_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'subscribers', jsonb_build_object(
      'confirmed', (select count(*) from public.email_subscribers where status = 'confirmed'),
      'pending', (select count(*) from public.email_subscribers where status = 'pending'),
      'unsubscribed', (select count(*) from public.email_subscribers where status = 'unsubscribed')),
    'searches', jsonb_build_object(
      'total', (select count(*) from public.saved_searches),
      'members', (select count(distinct member_id) from public.saved_searches),
      'bySpecies', coalesce((select jsonb_agg(jsonb_build_object('species', species, 'count', n) order by n desc) from (
        select coalesce(nullif(filters ->> 'species', ''), 'any') as species, count(*) n from public.saved_searches group by 1) q), '[]'::jsonb)),
    'savedAnimals', (select count(*) from public.saved_pets),
    'outbox', jsonb_build_object(
      'queued', (select count(*) from public.notification_outbox where sent_at is null and attempts < 3),
      'failed', (select count(*) from public.notification_outbox where sent_at is null and attempts >= 3),
      'sentLast7Days', (select count(*) from public.notification_outbox where sent_at > now() - interval '7 days'))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff "needs attention" report: one new item (full body, signature unchanged)
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

  -- Email that failed to send after three tries.
  select count(*) into v_n from public.notification_outbox where sent_at is null and attempts >= 3;
  if v_n > 0 then
    v_items := v_items || jsonb_build_object('kind', 'emails_failing', 'title', v_n || ' email' || case when v_n = 1 then '' else 's' end || ' could not be sent',
      'detail', 'Alert or newsletter messages failed three times. Check the email service, then ask engineering to retry.', 'action', 'outreach');
  end if;

  return v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.age_band(text), public.next_digest_time(), public.pet_matches_search(public.pets, jsonb), public.pets_queue_alerts(),
  public.list_saved_pets(), public.merge_saved_pets(uuid[]), public.unsave_pet(uuid),
  public.list_my_searches(), public.create_saved_search(text, jsonb), public.delete_saved_search(uuid),
  public.get_my_email_prefs(), public.set_my_email_prefs(boolean, boolean, boolean),
  public.subscribe_newsletter(text), public.confirm_newsletter(text), public.unsubscribe_email(text, text),
  public.claim_notifications(integer), public.finish_notifications(uuid[], text),
  public.queue_newsletter(uuid), public.remove_subscriber(uuid), public.outreach_summary()
  from public, anon, authenticated;

grant execute on function
  public.list_saved_pets(), public.merge_saved_pets(uuid[]), public.unsave_pet(uuid),
  public.list_my_searches(), public.create_saved_search(text, jsonb), public.delete_saved_search(uuid),
  public.get_my_email_prefs(), public.set_my_email_prefs(boolean, boolean, boolean),
  public.queue_newsletter(uuid), public.remove_subscriber(uuid), public.outreach_summary()
  to authenticated;

grant execute on function
  public.subscribe_newsletter(text), public.confirm_newsletter(text), public.unsubscribe_email(text, text),
  public.claim_notifications(integer), public.finish_notifications(uuid[], text)
  to service_role;
