begin;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visit-member@example.com', '', now(), '{}', '{"name":"Visit member"}', now(), now()),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-visit-member@example.com', '', now(), '{}', '{"name":"Other visit member"}', now(), now()),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visit-admin@example.com', '', now(), '{"role":"staff"}', '{"name":"Visit admin"}', now(), now()),
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visit-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Visit staff"}', now(), now());

insert into public.visit_slots (id, starts_at, ends_at, created_by)
values
  ('62000000-0000-0000-0000-000000000001', now() + interval '122 days', now() + interval '122 days 30 minutes', '61000000-0000-0000-0000-000000000003'),
  ('62000000-0000-0000-0000-000000000002', now() + interval '122 days 1 hour', now() + interval '122 days 1 hour 30 minutes', '61000000-0000-0000-0000-000000000003'),
  ('62000000-0000-0000-0000-000000000003', now() + interval '123 days', now() + interval '123 days 30 minutes', '61000000-0000-0000-0000-000000000003');

set local role anon;
select throws_ok(
  $$select public.list_visit_slots()$$,
  '42501', null,
  'an anonymous visitor cannot call the availability RPC'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000001","email":"visit-member@example.com","app_metadata":{},"user_metadata":{"name":"Visit member"}}';

select lives_ok(
  $$select public.list_visit_slots()$$,
  'a member can list sanitized future availability'
);

select results_eq(
  $$select available::text from public.list_visit_slots() where id = '62000000-0000-0000-0000-000000000001'$$,
  array['true'],
  'an open visit time is marked available'
);

select throws_ok(
  $$insert into public.appointments (member_id, member_name, member_email, slot_id, purpose)
    values ('61000000-0000-0000-0000-000000000001', 'Visit member', 'visit-member@example.com', '62000000-0000-0000-0000-000000000001', 'Trying to bypass the booking RPC')$$,
  '42501', null,
  'a member cannot write appointments directly'
);

select throws_ok(
  $$select public.publish_visit_slot(now() + interval '124 days', now() + interval '124 days 30 minutes')$$,
  '42501', null,
  'a member cannot publish visit times'
);

select lives_ok(
  $$select public.book_visit_slot('62000000-0000-0000-0000-000000000001', 'I would like to meet the animals and learn about the adoption process.')$$,
  'a member can book an available slot'
);

select results_eq(
  $$select count(*)::integer from public.appointments where member_id = '61000000-0000-0000-0000-000000000001' and status = 'booked'$$,
  array[1],
  'booking creates one active appointment'
);

select results_eq(
  $$select event_type from public.appointment_events where member_id = '61000000-0000-0000-0000-000000000001' order by created_at$$,
  array['booked'],
  'booking creates an account-visible confirmation event'
);

select results_eq(
  $$select available::text from public.list_visit_slots() where id = '62000000-0000-0000-0000-000000000001'$$,
  array['false'],
  'a booked visit time is marked unavailable without visitor details'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000002","email":"other-visit-member@example.com","app_metadata":{},"user_metadata":{"name":"Other visit member"}}';

select results_eq(
  $$select count(*)::integer from public.list_my_appointments()$$,
  array[0],
  'a member cannot read another member appointment through the account RPC'
);

select throws_ok(
  $$select public.book_visit_slot('62000000-0000-0000-0000-000000000001', 'I am attempting to reserve an already booked time.')$$,
  'P0001', null,
  'a second member cannot book the same slot'
);

select throws_ok(
  $$select public.cancel_visit_appointment((select id from public.appointments where member_id = '61000000-0000-0000-0000-000000000001'))$$,
  'P0001', null,
  'a member cannot cancel another member appointment'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000001","email":"visit-member@example.com","app_metadata":{},"user_metadata":{"name":"Visit member"}}';

select lives_ok(
  $$select public.reschedule_visit_appointment((select id from public.appointments where member_id = '61000000-0000-0000-0000-000000000001'), '62000000-0000-0000-0000-000000000002')$$,
  'a member can reschedule to another open slot'
);

select results_eq(
  $$select event_type from public.appointment_events where member_id = '61000000-0000-0000-0000-000000000001' order by event_type$$,
  array['booked', 'rescheduled'],
  'rescheduling keeps the original confirmation and adds a new event'
);

select lives_ok(
  $$select public.cancel_visit_appointment((select id from public.appointments where member_id = '61000000-0000-0000-0000-000000000001'))$$,
  'a member can cancel their future appointment'
);

select results_eq(
  $$select status from public.appointments where member_id = '61000000-0000-0000-0000-000000000001'$$,
  array['canceled'],
  'cancellation preserves the appointment record'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000002","email":"other-visit-member@example.com","app_metadata":{},"user_metadata":{"name":"Other visit member"}}';

select lives_ok(
  $$select public.book_visit_slot('62000000-0000-0000-0000-000000000002', 'I would like to visit after the first member canceled their booking.')$$,
  'cancellation frees the slot for another member'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000003","email":"visit-admin@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Visit admin"}}';

select results_eq(
  $$select count(*)::integer from public.appointments where status = 'booked' and slot_id::text like '62000000-%'$$,
  array[1],
  'a staff member can see the current booking schedule'
);

select throws_ok(
  $$select public.withdraw_visit_slot('62000000-0000-0000-0000-000000000002')$$,
  'P0001', null,
  'a staff member cannot withdraw a booked visit time'
);

select throws_ok(
  $$select public.publish_visit_slot(now() + interval '123 days 15 minutes', now() + interval '123 days 45 minutes')$$,
  '23P01', null,
  'overlapping published visit times are rejected'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"61000000-0000-0000-0000-000000000004","email":"visit-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Visit staff"}}';

select lives_ok(
  $$select public.publish_visit_slot(now() + interval '125 days', now() + interval '125 days 30 minutes')$$,
  'staff can publish a visit time'
);

select results_eq(
  $$select count(*)::integer from public.appointments where status = 'booked' and slot_id::text like '62000000-%'$$,
  array[1],
  'staff can see the current booking schedule'
);

select * from finish();
rollback;
