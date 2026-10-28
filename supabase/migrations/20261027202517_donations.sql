-- Sprint 3 use case 9 / requirement 9: donations recorded only after Stripe
-- confirms them. Expand-only: a new table and functions; nothing the
-- previously deployed API reads or writes changes.
--
-- Rows are written only by the API's signature-verified Stripe webhook, using
-- the server-side service role through record_donation(). Members and
-- anonymous visitors can neither read nor write this table. Card data never
-- reaches PawHeaven: Stripe's hosted checkout collects it.
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique check (char_length(stripe_session_id) between 5 and 255),
  stripe_payment_intent text check (stripe_payment_intent is null or char_length(stripe_payment_intent) <= 255),
  amount_cents integer not null check (amount_cents between 0 and 100000000),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  donor_name text check (donor_name is null or char_length(donor_name) <= 200),
  donor_email text check (donor_email is null or char_length(donor_email) <= 254),
  livemode boolean not null,
  stripe_created_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index donations_created_idx on public.donations (stripe_created_at desc);
create index donations_status_livemode_idx on public.donations (status, livemode);

alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.donations to authenticated;

create policy "Staff can read donations"
on public.donations for select to authenticated
using ((select public.is_staff()));

-- Inserts and updates go through this function only. Stripe can deliver events
-- more than once and out of order, so the function is idempotent and never moves
-- a donation backwards (succeeded never reverts to pending or failed).
create function public.record_donation(
  p_session_id text,
  p_payment_intent text,
  p_amount_cents integer,
  p_currency text,
  p_status text,
  p_donor_name text,
  p_donor_email text,
  p_livemode boolean,
  p_stripe_created_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.donations%rowtype;
  v_rank_new integer := case p_status when 'pending' then 0 when 'failed' then 1 when 'succeeded' then 2 else null end;
  v_rank_old integer;
begin
  if v_rank_new is null then
    raise exception 'Unknown donation status.' using errcode = '22023';
  end if;

  select * into v_existing from public.donations where stripe_session_id = p_session_id for update;
  if not found then
    insert into public.donations (stripe_session_id, stripe_payment_intent, amount_cents, currency, status, donor_name, donor_email, livemode, stripe_created_at)
    values (p_session_id, p_payment_intent, p_amount_cents, lower(p_currency), p_status, nullif(btrim(p_donor_name), ''), nullif(btrim(p_donor_email), ''), p_livemode, p_stripe_created_at);
    return p_status;
  end if;

  v_rank_old := case v_existing.status when 'pending' then 0 when 'failed' then 1 else 2 end;
  update public.donations
  set status = case when v_rank_new >= v_rank_old then p_status else status end,
      amount_cents = case when v_rank_new >= v_rank_old then p_amount_cents else amount_cents end,
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent),
      donor_name = coalesce(nullif(btrim(p_donor_name), ''), donor_name),
      donor_email = coalesce(nullif(btrim(p_donor_email), ''), donor_email),
      updated_at = now()
  where id = v_existing.id
  returning status into p_status;
  return p_status;
end;
$$;

-- Totals for the staff portal. SECURITY INVOKER, so row-level security applies
-- and anyone who is not staff sees no rows. Test-mode and live gifts are kept apart.
create function public.donation_summary()
returns table (livemode boolean, currency text, donation_count bigint, total_cents bigint)
language sql
stable
set search_path = ''
as $$
  select donation.livemode, donation.currency, count(*), coalesce(sum(donation.amount_cents), 0)::bigint
  from public.donations donation
  where donation.status = 'succeeded'
  group by donation.livemode, donation.currency
  order by donation.livemode desc, donation.currency;
$$;

revoke execute on function public.record_donation(text, text, integer, text, text, text, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.record_donation(text, text, integer, text, text, text, text, boolean, timestamptz) to service_role;
revoke execute on function public.donation_summary() from public, anon;
grant execute on function public.donation_summary() to authenticated;

comment on table public.donations is
  'Stripe Checkout payments confirmed by the signature-verified webhook. Written only by record_donation(); readable by staff only.';
