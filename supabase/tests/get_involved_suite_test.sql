begin;
select plan(49);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-admin@example.com', '', now(), '{"role":"admin"}', '{"name":"GI Admin"}', now(), now()),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-one@example.com', '', now(), '{}', '{"name":"GI One"}', now(), now()),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-two@example.com', '', now(), '{}', '{"name":"GI Two"}', now(), now()),
  ('e1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-three@example.com', '', now(), '{}', '{"name":"GI Three"}', now(), now()),
  ('e1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-foster@example.com', '', now(), '{}', '{"name":"GI Foster"}', now(), now()),
  ('e1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi-volunteer@example.com', '', now(), '{}', '{"name":"GI Volunteer"}', now(), now());

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, foster_available)
values
  ('e2000000-0000-0000-0000-000000000001', 'Gi Meet', 'Dog', 'Mixed', '2 years', current_date - 5, '{}', 'Available', 'A pet to meet during a visit.', false),
  ('e2000000-0000-0000-0000-000000000002', 'Gi Stale', 'Cat', 'Mixed', '3 years', current_date - 90, '{}', 'Available', 'In the shelter for a long time.', false),
  ('e2000000-0000-0000-0000-000000000003', 'Gi Urgent', 'Dog', 'Mixed', '1 year', current_date - 3, '{}', 'Available', 'Needs a foster home right away.', false);

-- An approved foster with a saved profile, and a volunteer with five finished shifts.
insert into public.member_profiles (user_id, phone, address, date_of_birth)
values ('e1000000-0000-0000-0000-000000000005', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01');
insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until, status, reviewed_at, reviewed_by)
values ('e1000000-0000-0000-0000-000000000005', 'GI Foster', 'gi-foster@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', 'e2000000-0000-0000-0000-000000000001', 'Gi Meet', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date, current_date + 5, 'Approved', now(), 'e1000000-0000-0000-0000-000000000001');
insert into public.volunteer_shifts (id, title, description, starts_at, ends_at, capacity, status)
select ('e3000000-0000-0000-0000-00000000000' || n)::uuid, 'Past shift ' || n, 'Finished shift for the volunteer.', now() - make_interval(days => n + 1), now() - make_interval(days => n + 1) + interval '2 hours', 5, 'published'
from generate_series(1, 5) n;
insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth)
select ('e3000000-0000-0000-0000-00000000000' || n)::uuid, 'e1000000-0000-0000-0000-000000000006', 'GI Volunteer', 'gi-volunteer@example.com', '404-555-0142', date '1990-01-01'
from generate_series(1, 5) n;

-- Members -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000002","email":"gi-one@example.com","app_metadata":{},"user_metadata":{"name":"GI One"}}';

select throws_ok($$select * from public.generate_availability()$$, '42501', null, 'a member cannot generate open hours');
select throws_ok($$select public.save_availability_rule(null, 'visit', 2, time '10:00', time '12:00', 2, 30, '', '', '', 0, 4, true)$$, '42501', null, 'a member cannot save an open-hours rule');
select throws_ok($$select public.set_pet_flags(array['e2000000-0000-0000-0000-000000000001']::uuid[], true, null, null)$$, '42501', null, 'a member cannot change pet flags');
select throws_ok($$select public.staff_attention()$$, '42501', null, 'a member cannot read the attention report');
select throws_ok($$select public.create_foster_request('e2000000-0000-0000-0000-000000000003', '')$$, '42501', null, 'a member cannot request fosters');
select throws_ok($$select public.set_foster_alerts(true)$$, 'P0001', null, 'foster alerts are only for approved fosters');
select throws_ok($$select public.claim_due_reminders()$$, '42501', null, 'a member cannot claim reminders');
select results_eq($$select count(*)::integer from public.availability_rules$$, array[0], 'a member cannot read open-hours rules');

-- Administrator: rules, generation, exceptions ------------------------------
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000001","email":"gi-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"GI Admin"}}';

select lives_ok(
  $$select public.save_availability_rule(null, 'visit', extract(dow from (now() + interval '9 days'))::integer, time '06:00', time '07:00', 2, 30, '', '', '', 0, 3, true)$$,
  'an administrator can save a weekly visit rule'
);
select lives_ok(
  $$select public.save_availability_rule(null, 'shift', extract(dow from (now() + interval '9 days'))::integer, time '09:00', time '12:00', 4, 30, 'Gi rule shift', 'Walk the dogs on the trail.', '', 16, 3, true)$$,
  'an administrator can save a weekly shift rule'
);
select throws_ok(
  $$select public.save_availability_rule(null, 'shift', 1, time '09:00', time '12:00', 4, 30, '', '', '', 0, 3, true)$$,
  '22023', null, 'a shift rule needs a title and duties'
);
select lives_ok($$select * from public.generate_availability()$$, 'an administrator can generate open hours');
select ok(
  (select count(*) from public.visit_slots where rule_id in (select id from public.availability_rules where created_by = 'e1000000-0000-0000-0000-000000000001')) >= 4,
  'generation created two half-hour visit slots for each matching day'
);
select ok((select count(*) from public.volunteer_shifts where title = 'Gi rule shift') >= 2, 'generation created the shifts');
select results_eq(
  $$select visits_created + shifts_created from public.generate_availability()$$,
  array[0],
  'generating again creates nothing new'
);
select results_eq(
  $$select count(*)::integer from public.visit_slots where rule_id in (select id from public.availability_rules where created_by = 'e1000000-0000-0000-0000-000000000001') and capacity <> 2$$,
  array[0],
  'generated visit slots carry the rule capacity'
);
select results_eq(
  $$select count(*)::integer from public.visit_slots where rule_id in (select id from public.availability_rules where created_by = 'e1000000-0000-0000-0000-000000000001') and (starts_at at time zone 'America/New_York')::time not in (time '06:00', time '06:30')$$,
  array[0],
  'generated times are the shelter local times, across daylight saving'
);

-- Exceptions remove untouched generated times.
create temp table gi_day as
  select (min(starts_at) at time zone 'America/New_York')::date as d from public.visit_slots where rule_id in (select id from public.availability_rules where created_by = 'e1000000-0000-0000-0000-000000000001');
grant select on gi_day to authenticated;
select lives_ok(
  $$select * from public.add_availability_exception((select d from gi_day), 'Holiday')$$,
  'an administrator can add a blackout day'
);
select results_eq(
  $$select count(*)::integer from public.visit_slots where rule_id in (select id from public.availability_rules where created_by = 'e1000000-0000-0000-0000-000000000001') and status = 'published' and (starts_at at time zone 'America/New_York')::date = (select d from gi_day)$$,
  array[0],
  'a blackout day withdraws unused generated visit times'
);
select results_eq(
  $$select visits_created from public.generate_availability()$$,
  array[0],
  'a blackout day is not regenerated'
);

-- Capacity, party size, pets -------------------------------------------------
select lives_ok(
  $$select public.publish_visit_slot(now() + interval '130 days', now() + interval '130 days 1 hour', 2)$$,
  'an administrator can publish a visit time with capacity two'
);
create temp table gi_slot as select id from public.visit_slots where capacity = 2 and rule_id is null and created_by = 'e1000000-0000-0000-0000-000000000001' and starts_at > now() + interval '129 days' limit 1;
grant select on gi_slot to authenticated;

set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000002","email":"gi-one@example.com","app_metadata":{},"user_metadata":{"name":"GI One"}}';
select lives_ok(
  $$select public.book_visit_slot((select id from gi_slot), 'Meet Gi Meet', 3, array['e2000000-0000-0000-0000-000000000001']::uuid[])$$,
  'a member can book with a party size and a pet'
);
select throws_ok(
  $$select public.book_visit_slot((select id from gi_slot), 'Again', 1, '{}')$$,
  'P0001', null, 'the same member cannot book one slot twice'
);
select throws_ok(
  $$select public.book_visit_slot((select id from gi_slot), 'Too many', 9, '{}')$$,
  '22023', null, 'a party is limited to six people'
);
select results_eq(
  $$select spots_left from public.list_visit_slots() where id = (select id from gi_slot)$$,
  array[1], 'the slot shows one spot left'
);
select results_eq(
  $$select count(*)::integer from public.appointment_pets$$,
  array[1], 'a member sees the pets on their own booking'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000003","email":"gi-two@example.com","app_metadata":{},"user_metadata":{"name":"GI Two"}}';
select results_eq($$select count(*)::integer from public.appointment_pets$$, array[0], 'another member cannot see those pets');
select lives_ok(
  $$select public.book_visit_slot((select id from gi_slot), 'Second group', 1, '{}')$$,
  'a second group fits in a capacity-two slot'
);
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000004","email":"gi-three@example.com","app_metadata":{},"user_metadata":{"name":"GI Three"}}';
select throws_ok(
  $$select public.book_visit_slot((select id from gi_slot), 'Third group', 1, '{}')$$,
  'P0001', null, 'a third group is turned away once the slot is full'
);
select results_eq(
  $$select available from public.list_visit_slots() where id = (select id from gi_slot)$$,
  array[false], 'a full slot is no longer available'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000001","email":"gi-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"GI Admin"}}';
select throws_ok(
  $$select public.set_visit_slot_capacity((select id from gi_slot), 1)$$,
  'P0001', null, 'capacity cannot drop below the groups already booked'
);

-- Events -------------------------------------------------------------------
select lives_ok(
  $$select public.create_event('Gi Open House', 'Meet the animals.', now() + interval '150 days', now() + interval '150 days 2 hours', 3, 30,
      '[{"title":"Greeter","description":"Welcome visitors at the door.","capacity":2},{"title":"Walker","capacity":3,"minAge":16}]'::jsonb,
      array['e2000000-0000-0000-0000-000000000001']::uuid[])$$,
  'an administrator can create an open house'
);
select results_eq(
  $$select count(*)::integer from public.visit_slots where event_id in (select id from public.events where title = 'Gi Open House') and capacity = 3$$,
  array[4], 'the event created four half-hour visit slots with capacity three'
);
select results_eq(
  $$select count(*)::integer from public.volunteer_shifts where event_id in (select id from public.events where title = 'Gi Open House')$$,
  array[2], 'the event created its volunteer roles'
);

-- Pet flags ---------------------------------------------------------------
select results_eq(
  $$select public.set_pet_flags(array['e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003']::uuid[], true, null, true)$$,
  array[2], 'an administrator can open several pets for foster at once'
);
select results_eq(
  $$select count(*)::integer from public.pets where id in ('e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003') and foster_available and needs_walkers$$,
  array[2], 'the flags were applied'
);

-- Attention report ---------------------------------------------------------
select ok(
  exists (select 1 from jsonb_array_elements(public.staff_attention(45)) item where item ->> 'kind' = 'foster_candidates'),
  'the attention report suggests inviting the volunteer to foster'
);

-- Foster pool --------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000005","email":"gi-foster@example.com","app_metadata":{},"user_metadata":{"name":"GI Foster"}}';
select lives_ok($$select public.set_foster_alerts(true)$$, 'an approved foster can opt in to alerts');

set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000001","email":"gi-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"GI Admin"}}';
select results_eq(
  $$select member_email::text from public.create_foster_request('e2000000-0000-0000-0000-000000000003', 'Needs out by Friday') where member_email like 'gi-%'$$,
  array['gi-foster@example.com'], 'a foster request goes to the opted-in pool'
);
select throws_ok($$select public.create_foster_request('e2000000-0000-0000-0000-000000000003', '')$$, 'P0001', null, 'a pet cannot have two open requests');

set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000005","email":"gi-foster@example.com","app_metadata":{},"user_metadata":{"name":"GI Foster"}}';
select results_eq($$select count(*)::integer from public.list_my_foster_requests()$$, array[1], 'the pool member sees the request');
select lives_ok(
  $$select public.respond_foster_request((select request_id from public.list_my_foster_requests() limit 1), true, current_date + 1, current_date + 30)$$,
  'the pool member can accept in one step'
);
select results_eq(
  $$select status from public.foster_applications where applicant_id = 'e1000000-0000-0000-0000-000000000005' and pet_id = 'e2000000-0000-0000-0000-000000000003'$$,
  array['Pending'], 'accepting files a pending application for staff to approve'
);

-- Schedule, involvement, feed -----------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000002","email":"gi-one@example.com","app_metadata":{},"user_metadata":{"name":"GI One"}}';
select results_eq(
  $$select detail from public.list_my_schedule() where kind = 'visit'$$,
  array['Meeting Gi Meet'], 'the member schedule lists the visit with the pet'
);
set local request.jwt.claims = '{"role":"authenticated","sub":"e1000000-0000-0000-0000-000000000006","email":"gi-volunteer@example.com","app_metadata":{},"user_metadata":{"name":"GI Volunteer"}}';
select results_eq(
  $$select (public.my_involvement() ->> 'volunteerShifts')::integer$$,
  array[5], 'involvement counts finished volunteer shifts'
);

set local role anon;
select ok(jsonb_typeof(public.get_involved_feed() -> 'visits') = 'array', 'anyone can read the public what-is-open feed');
select throws_ok($$select public.my_involvement()$$, '42501', null, 'anonymous visitors cannot read involvement');

-- Reminders (service role) ---------------------------------------------------
reset role;
update public.visit_slots set status = 'withdrawn' where id <> (select id from gi_slot) and tstzrange(starts_at, ends_at, '[)') && tstzrange(now() + interval '5 hours', now() + interval '6 hours', '[)');
update public.visit_slots set starts_at = now() + interval '5 hours', ends_at = now() + interval '6 hours' where id = (select id from gi_slot);
update public.appointments set created_at = now() - interval '1 day' where slot_id = (select id from gi_slot);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select results_eq($$select count(*)::integer from public.claim_due_reminders() where kind = 'visit'$$, array[2], 'the scheduled job claims reminders for visits within a day');
select results_eq($$select count(*)::integer from public.claim_due_reminders() where kind = 'visit'$$, array[0], 'each reminder is claimed only once');

select * from finish();
rollback;
