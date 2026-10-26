begin;
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'volunteer-one@example.com', '', now(), '{}', '{"name":"Volunteer one"}', now(), now()),
  ('81000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'volunteer-two@example.com', '', now(), '{}', '{"name":"Volunteer two"}', now(), now()),
  ('81000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'volunteer-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Volunteer staff"}', now(), now());

insert into public.volunteer_shifts (id, title, description, requirements, min_age, starts_at, ends_at, capacity, created_by)
values
  ('82000000-0000-0000-0000-000000000001', 'Kennel care', 'Clean kennels and refill water.', '', 0, now() + interval '2 days', now() + interval '2 days 3 hours', 1, '81000000-0000-0000-0000-000000000003'),
  ('82000000-0000-0000-0000-000000000002', 'Dog walking', 'Walk dogs on the trail.', 'Closed-toe shoes.', 18, now() + interval '3 days', now() + interval '3 days 2 hours', 5, '81000000-0000-0000-0000-000000000003'),
  ('82000000-0000-0000-0000-000000000003', 'Overlapping shift', 'Overlaps kennel care.', '', 0, now() + interval '2 days 1 hour', now() + interval '2 days 4 hours', 5, '81000000-0000-0000-0000-000000000003');

set local role anon;
select throws_ok(
  $$select public.list_volunteer_shifts()$$,
  '42501', null,
  'an anonymous visitor cannot list volunteer shifts'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"81000000-0000-0000-0000-000000000001","email":"volunteer-one@example.com","app_metadata":{},"user_metadata":{"name":"Volunteer one"}}';

select results_eq(
  $$select count(*)::integer from public.volunteer_shifts$$,
  array[0],
  'a member cannot read the shift table directly'
);

select results_eq(
  $$select count(*)::integer from public.list_volunteer_shifts() where id::text like '82000000-%'$$,
  array[3],
  'a member can list upcoming published shifts through the RPC'
);

select throws_ok(
  $$insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth)
    values ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Volunteer one', 'volunteer-one@example.com', '404-555-0142', date '1990-01-01')$$,
  '42501', null,
  'a member cannot write registrations directly'
);

select throws_ok(
  $$select public.create_volunteer_shift('Sneaky', 'Members cannot publish shifts.', '', 0, now() + interval '5 days', now() + interval '5 days 2 hours', 3)$$,
  '42501', null,
  'a member cannot publish a volunteer shift'
);

select lives_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000001', '404-555-0142', date '1990-01-01')$$,
  'a member can register for an open shift'
);

select results_eq(
  $$select spots_remaining from public.list_volunteer_shifts() where id = '82000000-0000-0000-0000-000000000001'$$,
  array[0],
  'registering reduces remaining capacity'
);

select results_eq(
  $$select registered::text from public.list_volunteer_shifts() where id = '82000000-0000-0000-0000-000000000001'$$,
  array['true'],
  'the listing marks the shift the caller is registered for'
);

select throws_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000001', '404-555-0142', date '1990-01-01')$$,
  'P0001', 'You are already registered for this shift.',
  'a member cannot register twice for the same shift'
);

select throws_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000003', '404-555-0142', date '1990-01-01')$$,
  'P0001', 'You are already registered for another shift that overlaps this time.',
  'a member cannot register for an overlapping shift'
);

select lives_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000002', '404-555-0142', date '1990-01-01')$$,
  'a member can register for a second, non-overlapping shift'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"81000000-0000-0000-0000-000000000002","email":"volunteer-two@example.com","app_metadata":{},"user_metadata":{"name":"Volunteer two"}}';

select throws_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000001', '404-555-0199', date '1992-02-02')$$,
  'P0001', 'This shift is full. Choose another opportunity.',
  'a full shift rejects further registrations'
);

select throws_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000002', '404-555-0199', (current_date - interval '16 years')::date)$$,
  'P0001', 'This shift requires volunteers to be at least 18 years old.',
  'a volunteer below the minimum age is rejected'
);

select throws_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000002', '12', date '1992-02-02')$$,
  '22023', null,
  'an invalid phone number is rejected'
);

select results_eq(
  $$select count(*)::integer from public.list_my_volunteer_registrations()$$,
  array[0],
  'a member cannot see another member registrations'
);

select throws_ok(
  $$select public.cancel_volunteer_registration((select id from public.volunteer_registrations limit 1))$$,
  'P0001', 'Volunteer registration not found.',
  'a member cannot cancel another member registration'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"81000000-0000-0000-0000-000000000001","email":"volunteer-one@example.com","app_metadata":{},"user_metadata":{"name":"Volunteer one"}}';

select lives_ok(
  $$select public.cancel_volunteer_registration((select mine.id from public.list_my_volunteer_registrations() as mine where mine.shift_id = '82000000-0000-0000-0000-000000000001'))$$,
  'a member can cancel their own registration'
);

select results_eq(
  $$select spots_remaining from public.list_volunteer_shifts() where id = '82000000-0000-0000-0000-000000000001'$$,
  array[1],
  'cancellation frees capacity'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"81000000-0000-0000-0000-000000000002","email":"volunteer-two@example.com","app_metadata":{},"user_metadata":{"name":"Volunteer two"}}';

select lives_ok(
  $$select public.register_for_volunteer_shift('82000000-0000-0000-0000-000000000001', '404-555-0199', date '1992-02-02')$$,
  'a freed spot can be taken by another member'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"81000000-0000-0000-0000-000000000003","email":"volunteer-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Volunteer staff"}}';

select results_eq(
  $$select count(*)::integer from public.volunteer_registrations where status = 'registered' and shift_id::text like '82000000-%'$$,
  array[2],
  'staff can read the participant list'
);

select lives_ok(
  $$select public.create_volunteer_shift('Adoption event', 'Greet visitors at the adoption event.', 'Friendly and patient.', 16, now() + interval '6 days', now() + interval '6 days 4 hours', 10)$$,
  'staff can publish a shift'
);

select throws_ok(
  $$select public.create_volunteer_shift('Bad capacity', 'Capacity must be positive.', '', 0, now() + interval '7 days', now() + interval '7 days 2 hours', 0)$$,
  '22023', null,
  'a shift with zero capacity is rejected'
);

select throws_ok(
  $$select public.update_volunteer_shift('82000000-0000-0000-0000-000000000001', 'Kennel care', 'Clean kennels and refill water.', '', 0, now() + interval '2 days', now() + interval '2 days 3 hours', 0)$$,
  'P0001', null,
  'capacity cannot drop below the volunteers already registered'
);

select throws_ok(
  $$select public.update_volunteer_shift('82000000-0000-0000-0000-000000000001', 'Kennel care', 'Clean kennels and refill water.', '', 0, now() + interval '2 days 1 hour', now() + interval '2 days 4 hours', 2)$$,
  'P0001', null,
  'the time of a shift with volunteers cannot change'
);

select lives_ok(
  $$select public.update_volunteer_shift('82000000-0000-0000-0000-000000000001', 'Kennel care and laundry', 'Clean kennels, refill water, and do laundry.', '', 0, (select starts_at from public.volunteer_shifts where id = '82000000-0000-0000-0000-000000000001'), (select ends_at from public.volunteer_shifts where id = '82000000-0000-0000-0000-000000000001'), 3)$$,
  'staff can edit details and raise capacity for a shift with volunteers'
);

select results_eq(
  $$select email from (select member_email as email from public.cancel_volunteer_shift('82000000-0000-0000-0000-000000000001')) as affected$$,
  array['volunteer-two@example.com'],
  'canceling a shift returns the volunteers who must be notified'
);

select results_eq(
  $$select status || ':' || coalesce(canceled_reason, '') from public.volunteer_registrations where shift_id = '82000000-0000-0000-0000-000000000001' and member_id = '81000000-0000-0000-0000-000000000002'$$,
  array['canceled:shift_canceled'],
  'canceling a shift cancels its active registrations'
);

select * from finish();
rollback;
