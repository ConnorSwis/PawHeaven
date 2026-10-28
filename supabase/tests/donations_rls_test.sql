begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'donation-member@example.com', '', now(), '{}', '{"name":"Donation member"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'donation-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Donation staff"}', now(), now());

-- Only the service role may record donations.
set local role anon;
select throws_ok(
  $$select public.record_donation('cs_test_anon', null, 500, 'usd', 'succeeded', 'Anon', 'anon@example.com', false, now())$$,
  '42501', null,
  'an anonymous caller cannot record a donation'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"a2000000-0000-0000-0000-000000000001","email":"donation-member@example.com","app_metadata":{},"user_metadata":{"name":"Donation member"}}';
select throws_ok(
  $$select public.record_donation('cs_test_member', null, 500, 'usd', 'succeeded', 'Member', 'member@example.com', false, now())$$,
  '42501', null,
  'a signed-in member cannot record a donation'
);
select throws_ok(
  $$insert into public.donations (stripe_session_id, amount_cents, currency, status, livemode, stripe_created_at) values ('cs_test_direct', 500, 'usd', 'succeeded', false, now())$$,
  '42501', null,
  'a member cannot write the donations table directly'
);

reset role;
set local role service_role;
select is(
  public.record_donation('cs_test_one', 'pi_one', 2500, 'USD', 'pending', 'Pat Donor', 'pat@example.com', false, now()),
  'pending',
  'the service role records a pending donation'
);
select is(
  public.record_donation('cs_test_one', 'pi_one', 2500, 'usd', 'succeeded', null, null, false, now()),
  'succeeded',
  'a later success event upgrades the donation and keeps the donor details'
);
select is(
  public.record_donation('cs_test_one', null, 2500, 'usd', 'pending', null, null, false, now()),
  'succeeded',
  'a late pending event never downgrades a succeeded donation'
);
select is(
  public.record_donation('cs_test_one', 'pi_one', 2500, 'usd', 'succeeded', null, null, false, now()),
  'succeeded',
  'replaying the same event is harmless'
);
select results_eq(
  $$select count(*)::integer from public.donations where stripe_session_id = 'cs_test_one'$$,
  array[1],
  'a session is recorded once however many events arrive'
);
select results_eq(
  $$select donor_name || ' ' || donor_email || ' ' || currency from public.donations where stripe_session_id = 'cs_test_one'$$,
  array['Pat Donor pat@example.com usd'],
  'donor details survive later events that omit them, and the currency is normalized'
);
select throws_ok(
  $$select public.record_donation('cs_test_bad', null, 500, 'usd', 'refunded', null, null, false, now())$$,
  '22023', null,
  'an unknown status is rejected'
);
select throws_ok(
  $$select public.record_donation('cs_test_neg', null, -5, 'usd', 'succeeded', null, null, false, now())$$,
  '23514', null,
  'a negative amount is rejected'
);
select is(
  public.record_donation('cs_live_two', 'pi_two', 10000, 'usd', 'succeeded', 'Sam Donor', 'sam@example.com', true, now()),
  'succeeded',
  'a live-mode donation is recorded'
);
select is(
  public.record_donation('cs_test_fail', null, 700, 'usd', 'failed', null, null, false, now()),
  'failed',
  'an asynchronous payment failure is recorded'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"a2000000-0000-0000-0000-000000000001","email":"donation-member@example.com","app_metadata":{},"user_metadata":{"name":"Donation member"}}';
select results_eq(
  $$select count(*)::integer from public.donations$$,
  array[0],
  'a member cannot read any donation'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"a2000000-0000-0000-0000-000000000002","email":"donation-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Donation staff"}}';
select results_eq(
  $$select count(*)::integer from public.donations where stripe_session_id in ('cs_test_one', 'cs_live_two', 'cs_test_fail')$$,
  array[3],
  'staff can read donations'
);
select is(
  (select sum(total_cents)::bigint from public.donation_summary() where not livemode),
  (select sum(amount_cents)::bigint from public.donations where status = 'succeeded' and not livemode),
  'the summary total equals the succeeded test-mode donations and excludes pending and failed ones'
);

select * from finish();
rollback;
