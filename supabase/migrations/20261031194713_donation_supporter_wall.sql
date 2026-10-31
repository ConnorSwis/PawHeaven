-- Public supporter wall for donations. A donor must explicitly opt in at
-- Stripe Checkout, then staff review the display name and optional message
-- before a successful live-mode gift can be listed publicly.
--
-- Existing rows remain private, and the existing nine-argument
-- record_donation() function stays in place so the already-deployed webhook
-- remains compatible while this migration rolls out.

alter table public.donations
  add column public_opt_in boolean not null default false,
  add column public_display_name text check (public_display_name is null or char_length(public_display_name) between 1 and 80),
  add column public_message text check (public_message is null or char_length(public_message) between 1 and 240),
  add column public_status text not null default 'private' check (public_status in ('private', 'pending', 'published', 'hidden'));

create index donations_public_latest_idx
on public.donations (stripe_created_at desc)
where livemode and status = 'succeeded' and public_status = 'published';

-- A compatibility overload used by the new webhook. It deliberately invokes
-- the previous function first, preserving its proven idempotency and payment
-- status ordering, then enriches the same row with sanitized public fields.
create function public.record_donation(
  p_session_id text,
  p_payment_intent text,
  p_amount_cents integer,
  p_currency text,
  p_status text,
  p_donor_name text,
  p_donor_email text,
  p_livemode boolean,
  p_stripe_created_at timestamptz,
  p_public_opt_in boolean,
  p_public_display_name text,
  p_public_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_opted_in boolean := coalesce(p_public_opt_in, false);
  v_display_name text := nullif(btrim(p_public_display_name), '');
  v_message text := nullif(btrim(p_public_message), '');
begin
  if v_display_name is not null and char_length(v_display_name) > 80 then
    raise exception 'A public display name must be 80 characters or fewer.' using errcode = '22023';
  end if;
  if v_message is not null and char_length(v_message) > 240 then
    raise exception 'A public message must be 240 characters or fewer.' using errcode = '22023';
  end if;

  select public.record_donation(
    p_session_id, p_payment_intent, p_amount_cents, p_currency, p_status,
    p_donor_name, p_donor_email, p_livemode, p_stripe_created_at
  ) into v_status;

  -- Do not retain a requested public message without the donor's explicit
  -- opt-in. Replayed asynchronous events that omit custom fields also never
  -- erase information captured by the completed Checkout Session event.
  if v_opted_in then
    update public.donations
    set public_opt_in = true,
        public_display_name = coalesce(v_display_name, public_display_name),
        public_message = coalesce(v_message, public_message),
        public_status = case when public_status = 'private' then 'pending' else public_status end,
        updated_at = now()
    where stripe_session_id = p_session_id;
  end if;

  return v_status;
end;
$$;

revoke execute on function public.record_donation(text, text, integer, text, text, text, text, boolean, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.record_donation(text, text, integer, text, text, text, text, boolean, timestamptz, boolean, text, text) to service_role;

-- This intentionally runs with table-owner privileges because anonymous
-- visitors are never granted table access. It exposes a fixed, sanitized
-- projection only: approved live donations, newest first, with no ids, email,
-- Stripe references, billing name, or test-mode records.
create function public.latest_public_donations()
returns table (
  display_name text,
  message text,
  amount_cents integer,
  currency text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select donation.public_display_name, donation.public_message, donation.amount_cents, donation.currency, donation.stripe_created_at
  from public.donations donation
  where donation.livemode
    and donation.status = 'succeeded'
    and donation.public_status = 'published'
    and donation.public_opt_in
    and donation.public_display_name is not null
  order by donation.stripe_created_at desc
  limit 6;
$$;

revoke execute on function public.latest_public_donations() from public;
grant execute on function public.latest_public_donations() to anon, authenticated;

-- Staff may decide whether an eligible submission becomes public, but cannot
-- edit donor wording. Keeping the original text immutable preserves the
-- donor's meaning and gives staff a simple publish/hide moderation action.
create function public.set_donation_publication(p_donation_id uuid, p_public_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_donation public.donations%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff access is required to moderate supporter-wall submissions.' using errcode = '42501';
  end if;
  if p_public_status not in ('published', 'hidden') then
    raise exception 'Choose Published or Hidden.' using errcode = '22023';
  end if;

  select * into v_donation from public.donations where id = p_donation_id for update;
  if not found then
    raise exception 'Donation not found.' using errcode = 'P0002';
  end if;
  if p_public_status = 'published' and (
    not v_donation.livemode
    or v_donation.status <> 'succeeded'
    or not v_donation.public_opt_in
    or v_donation.public_display_name is null
  ) then
    raise exception 'Only opted-in, successful live donations with a display name can be published.' using errcode = 'P0001';
  end if;

  update public.donations
  set public_status = p_public_status,
      updated_at = now()
  where id = p_donation_id;
  return p_public_status;
end;
$$;

revoke execute on function public.set_donation_publication(uuid, text) from public, anon;
grant execute on function public.set_donation_publication(uuid, text) to authenticated;

comment on function public.latest_public_donations() is
  'The six newest staff-approved, opted-in live donations. Returns only public supporter-wall fields.';
