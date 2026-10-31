begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wall-member@example.com', '', now(), '{}', '{"name":"Wall member"}', now(), now()),
  ('a9000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wall-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Wall staff"}', now(), now());

-- The expanded webhook RPC remains server-only.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$select public.record_donation('cs_wall_anon', null, 500, 'usd', 'succeeded', null, null, true, now(), true, 'Anon', null)$$,
  '42501', null,
  'an anonymous caller cannot add supporter-wall fields'
);

reset role;
set local role service_role;
select is(
  public.record_donation('cs_wall_live', 'pi_wall_live', 4000, 'USD', 'succeeded', 'Billing name stays private', 'private@example.com', true, '2026-10-30 12:00:00+00', true, ' Wall Friend ', ' For every paw! '),
  'succeeded',
  'the webhook can record an opted-in live donation'
);
select results_eq(
  $$select public_opt_in::text || '|' || public_display_name || '|' || public_message || '|' || public_status from public.donations where stripe_session_id = 'cs_wall_live'$$,
  array['true|Wall Friend|For every paw!|pending'],
  'opted-in display text is trimmed and begins awaiting review'
);
select is(
  public.record_donation('cs_wall_private', 'pi_wall_private', 3000, 'usd', 'succeeded', 'Private donor', 'private-donor@example.com', true, '2026-10-31 12:00:00+00', false, 'Do not retain', 'This must remain private'),
  'succeeded',
  'a donation can decline supporter-wall opt-in'
);
select results_eq(
  $$select public_opt_in::text || '|' || coalesce(public_display_name, '') || '|' || coalesce(public_message, '') || '|' || public_status from public.donations where stripe_session_id = 'cs_wall_private'$$,
  array['false|||private'],
  'unopted donation text is not retained'
);
select is(
  public.record_donation('cs_wall_test', 'pi_wall_test', 2000, 'usd', 'succeeded', 'Test donor', 'test@example.com', false, '2026-10-31 13:00:00+00', true, 'Test supporter', null),
  'succeeded',
  'a test-mode opt-in is recorded for moderation but not public display'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$select display_name from public.latest_public_donations()$$,
  array[]::text[],
  'nothing is public before staff approval'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"a9000000-0000-0000-0000-000000000001","email":"wall-member@example.com","app_metadata":{},"user_metadata":{"name":"Wall member"}}';
select throws_ok(
  $$select public.set_donation_publication((select id from public.donations where stripe_session_id = 'cs_wall_live'), 'published')$$,
  '42501', null,
  'a member cannot moderate the supporter wall'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"a9000000-0000-0000-0000-000000000002","email":"wall-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Wall staff"}}';
select is(
  public.set_donation_publication((select id from public.donations where stripe_session_id = 'cs_wall_live'), 'published'),
  'published',
  'staff can publish an eligible live donation'
);
select throws_ok(
  $$select public.set_donation_publication((select id from public.donations where stripe_session_id = 'cs_wall_test'), 'published')$$,
  'P0001', null,
  'staff cannot publish a test-mode donation'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$select display_name || '|' || coalesce(message, '') || '|' || amount_cents::text || '|' || currency from public.latest_public_donations()$$,
  array['Wall Friend|For every paw!|4000|usd'],
  'the public function exposes only the approved live projection'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"a9000000-0000-0000-0000-000000000002","email":"wall-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Wall staff"}}';
select is(
  public.set_donation_publication((select id from public.donations where stripe_session_id = 'cs_wall_live'), 'hidden'),
  'hidden',
  'staff can remove a published donation from the wall'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$select display_name from public.latest_public_donations()$$,
  array[]::text[],
  'a hidden donation is no longer returned publicly'
);

select * from finish();
rollback;
