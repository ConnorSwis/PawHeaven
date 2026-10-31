-- Local demo data only. Makes the database look lived in: twelve demo members,
-- a fortnight of visit times (some booked), three weeks of volunteer shifts with
-- sign-ups, applications in every status, lost-pet inquiries, quiz results, and
-- test-mode donations. Everything is dated relative to the day of `db reset`.
-- Members sign in with DemoMember-2026! and never exist outside the local stack.

create temp table m as
select n,
  ('a3000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid as id,
  first || ' ' || last as name,
  lower(first || '.' || last) || '@pawheaven.local' as email,
  phone,
  (date '1984-03-09' + n * 700) as dob,
  address
from (values
  (1, 'Maya', 'Chen', '(404) 555-0111', '210 Peachtree Ave NE, Atlanta, GA 30303'),
  (2, 'Jordan', 'Patel', '(404) 555-0112', '48 Ponce de Leon Ave, Atlanta, GA 30308'),
  (3, 'Sam', 'Rivera', '(678) 555-0113', '902 Moreland Ave SE, Atlanta, GA 30316'),
  (4, 'Priya', 'Nair', '(470) 555-0114', '15 Clairmont Rd, Decatur, GA 30030'),
  (5, 'Marcus', 'Johnson', '(404) 555-0115', '77 Memorial Dr SE, Atlanta, GA 30312'),
  (6, 'Elena', 'Rossi', '(678) 555-0116', '311 Lullwater Rd NE, Atlanta, GA 30307'),
  (7, 'Tyrone', 'Brooks', '(404) 555-0117', '640 Boulevard NE, Atlanta, GA 30308'),
  (8, 'Hannah', 'Kim', '(470) 555-0118', '23 Candler St, Decatur, GA 30030'),
  (9, 'Diego', 'Alvarez', '(404) 555-0119', '508 Glenwood Ave SE, Atlanta, GA 30316'),
  (10, 'Aisha', 'Khan', '(678) 555-0120', '19 Church St, Decatur, GA 30030'),
  (11, 'Liam', 'Oconnor', '(404) 555-0121', '256 Edgewood Ave SE, Atlanta, GA 30312'),
  (12, 'Grace', 'Thompson', '(470) 555-0122', '88 Ansley Dr NE, Atlanta, GA 30309')
) as t (n, first, last, phone, address);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
  extensions.crypt('DemoMember-2026!', extensions.gen_salt('bf')), now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', name, 'email', email, 'email_verified', true, 'phone_verified', false, 'sub', id::text),
  now() - (n * 5 || ' days')::interval, now()
from m;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()
from m;

-- Saved contact details for most members.
insert into public.member_profiles (user_id, phone, address, date_of_birth)
select id, phone, address, dob from m where n <= 9;

-- Pets: every animal not already placed is in the shelter, and several are open to foster.
update public.pets set housing = 'Shelter' where housing = '';
update public.pets set foster_available = true where name in ('Cleo', 'Wren', 'Miso', 'Juniper');

-- Visit times: past and next two weeks (days 1 to 2 are the original demo slots), about two thirds booked.
with days as (select d from generate_series(-7, 16) as d where d not in (0, 1, 2)),
  times as (select t from unnest(array['11:00', '12:00', '13:00', '14:00', '15:00', '16:00']::time[]) as t),
  new_slots as (
    insert into public.visit_slots (starts_at, ends_at, created_by)
    select ((timezone('America/New_York', now())::date + d + t) at time zone 'America/New_York'),
      ((timezone('America/New_York', now())::date + d + t + interval '30 minutes') at time zone 'America/New_York'),
      'a1000000-0000-0000-0000-000000000002'
    from days, times
    returning id, starts_at, ends_at
  ),
  ranked as (select id, starts_at, ends_at, row_number() over (order by starts_at) as rn from new_slots),
  booked as (
    insert into public.appointments (member_id, member_name, member_email, slot_id, purpose, created_at, updated_at)
    select m.id, m.name, m.email, r.id,
      (array['Meet a dog I saw online', 'Learn about fostering', 'Meet the cats before adopting', 'Bring my kids to meet a few dogs', 'Ask about senior pets', 'Tour the shelter and meet staff'])[1 + (r.rn % 6)::int],
      r.starts_at - interval '3 days', r.starts_at - interval '3 days'
    from ranked r join m on m.n = 1 + (r.rn % 12)::int
    where r.rn % 3 <> 0
    returning id, member_id, slot_id
  )
insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at, created_at)
select b.id, b.member_id, 'booked', r.starts_at, r.ends_at, r.starts_at - interval '3 days'
from booked b join ranked r on r.id = b.slot_id;

-- Volunteer shifts for the past ten days and next three weeks, filled by members without double-booking anyone.
do $$
declare
  shift_row record;
  member_row record;
  v_shift_id uuid;
  v_count integer;
  v_target integer;
  v_index integer := 0;
begin
  for shift_row in
    select defs.title, defs.descr, defs.req, defs.min_age, defs.capacity, days.d,
      ((timezone('America/New_York', now())::date + days.d + defs.start_time::time) at time zone 'America/New_York') as starts_at,
      ((timezone('America/New_York', now())::date + days.d + defs.start_time::time + (defs.hours || ' hours')::interval) at time zone 'America/New_York') as ends_at
    from generate_series(-10, 21) as days(d)
    join (values
      ('Kennel care', 'Clean and refill kennels, fresh water, and bedding for the dogs and cats.', 'Closed-toe shoes. Training provided on your first shift.', 0, '08:00', 3, 5, array[1, 2, 3, 4, 5]),
      ('Dog walking', 'Walk shelter dogs on the trail and log how each walk went.', 'Comfortable handling large dogs. Volunteers must be 18 or older.', 18, '13:00', 2, 6, array[1, 2, 3, 4, 5, 6, 7]),
      ('Cat socialization', 'Spend time with the cats: gentle play, brushing, and quiet company.', 'Wash your hands before and after. Volunteers must be 16 or older.', 16, '16:00', 2, 4, array[2, 4]),
      ('Laundry and supplies', 'Wash blankets and towels and restock the supply closet.', '', 0, '11:30', 2, 3, array[1, 3, 5]),
      ('Adoption event greeter', 'Welcome visitors at the weekend adoption event and hand out information sheets.', 'Friendly and patient. Volunteers must be 14 or older.', 14, '10:00', 4, 8, array[6]),
      ('Volunteer orientation', 'Learn the shelter routines, safety rules, and how shifts work. Required before your first dog-walking shift.', 'Volunteers must be 14 or older.', 14, '09:00', 1, 12, array[6]),
      ('Foster training workshop', 'A practical session for people thinking about fostering: supplies, routines, and what to expect.', 'Open to anyone 18 or older. No experience needed.', 18, '14:00', 2, 15, array[7])
    ) as defs (title, descr, req, min_age, start_time, hours, capacity, dows)
      on extract(isodow from (timezone('America/New_York', now())::date + days.d))::int = any (defs.dows)
    order by 7, 1
  loop
    v_index := v_index + 1;
    insert into public.volunteer_shifts (title, description, requirements, min_age, starts_at, ends_at, capacity, created_by)
    values (shift_row.title, shift_row.descr, shift_row.req, shift_row.min_age, shift_row.starts_at, shift_row.ends_at, shift_row.capacity, 'a1000000-0000-0000-0000-000000000002')
    returning id into v_shift_id;

    -- Past shifts were well attended; upcoming ones vary from empty to full, and a few soon-to-start shifts have nobody yet.
    if shift_row.d < 0 then v_target := greatest(1, round(shift_row.capacity * 0.8)::int);
    elsif shift_row.d between 3 and 5 and v_index % 5 = 0 then v_target := 0;
    else v_target := least(shift_row.capacity, round(shift_row.capacity * (0.2 + ((v_index * 37) % 85) / 100.0))::int);
    end if;

    v_count := 0;
    for member_row in select * from m order by (n + v_index) % 12 loop
      exit when v_count >= v_target;
      if exists (
        select 1 from public.volunteer_registrations registration
        join public.volunteer_shifts other on other.id = registration.shift_id
        where registration.member_id = member_row.id and registration.status = 'registered'
          and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(shift_row.starts_at, shift_row.ends_at, '[)')
      ) then continue; end if;
      insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth, created_at, updated_at)
      values (v_shift_id, member_row.id, member_row.name, member_row.email, member_row.phone, member_row.dob, shift_row.starts_at - interval '6 days', shift_row.starts_at - interval '6 days');
      v_count := v_count + 1;
    end loop;
  end loop;
end $$;

-- A few members changed their minds.
update public.volunteer_registrations
set status = 'canceled', canceled_reason = 'member', updated_at = now()
where abs(hashtext(id::text)) % 11 = 0
  and shift_id::text not like 'd1000000-%'
  and shift_id in (select id from public.volunteer_shifts where starts_at > now() + interval '1 day');

-- Adoption applications in every status.
with a (n, pet, status, days_ago, household, experience, note) as (values
  (1, 'Jett', 'Pending', 6, 'Two adults and a fenced yard in Decatur. One of us works from home most days.', 'Raised dogs growing up and fostered two rescues last year.', 'Happy to arrange a meet and greet this week.'),
  (2, 'Cadillac', 'Pending', 4, 'Apartment with a dog park next door; household of two adults.', 'Had a lab for twelve years and know how to train with treats.', ''),
  (3, 'Chadwick', 'Pending', 2, 'Small house, one other adult, flexible schedule, no other pets.', 'First dog as an adult, but I have read and watched a lot about training.', 'I would love a calm older dog.'),
  (4, 'Padma Patil', 'In review', 9, 'Quiet household of two adults in a ground-floor condo.', 'Have adopted two seniors from shelters before.', 'Senior dogs are my favorite.'),
  (5, 'Carlton', 'In review', 8, 'Family of four with a nine-year-old; we are looking for a laid-back cat.', 'Our last cat lived to nineteen.', ''),
  (6, 'Hollie', 'Approved', 12, 'Two adults and a large fenced yard, no other pets right now.', 'Experienced with shy dogs and patient with training.', 'We can pick up any weekday.'),
  (7, 'Fuerte', 'Approved', 11, 'Two adults, quiet home, an older dog would suit us best.', 'Cared for my parents'' senior dog for years.', ''),
  (8, 'Sombra', 'Declined', 14, 'Studio apartment, long work hours, no outdoor space.', 'This would be my first pet, and I am eager to learn.', 'Hoping for an active young dog.'),
  (9, 'Cookie Crisp', 'Approved', 18, 'Couple with a sunny apartment, both working from home.', 'Grew up with cats and have owned two.', ''),
  (10, 'Arlo', 'Pending', 1, 'Family of five with a big backyard and two kids over ten.', 'Our family dog passed last spring and we are ready for a new one.', 'The kids are excited to meet him.'),
  (11, 'Mika', 'In review', 5, 'Apartment, two adults, one adult cat already.', 'Slow introductions worked well with our current cat.', '')
)
insert into public.adoption_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, adoption_experience, note, status, submitted_at, reviewed_at, reviewed_by)
select m.id, m.name, m.email, m.phone, m.address, m.dob, p.id, p.name, a.household, a.experience, a.note, a.status,
  now() - (a.days_ago || ' days')::interval,
  case when a.status = 'Pending' then null else now() - ((a.days_ago - 1) || ' days')::interval end,
  case when a.status = 'Pending' then null else 'a1000000-0000-0000-0000-000000000002'::uuid end
from a join m on m.n = a.n join lateral (select id, name from public.pets where name = a.pet limit 1) p on true;

-- Approved adoptions move those animals along.
update public.pets set status = 'Pending' where name in ('Hollie', 'Fuerte');
update public.pets set status = 'Adopted' where name = 'Cookie Crisp';

-- Foster applications.
with f (n, pet, status, days_ago, start_in, length_days, household, experience, note) as (values
  (2, 'Cleo', 'Pending', 3, 5, 45, 'Apartment, two adults, a spare room for a cat to settle into.', 'Fostered four kittens through a local rescue.', ''),
  (5, 'Sombra', 'In review', 7, 10, 60, 'House with a fenced yard and one calm dog.', 'Fostered two young dogs for a local rescue.', 'Happy to continue his training.'),
  (7, 'Juniper', 'Approved', 13, 2, 30, 'Family home, kids over twelve, big yard.', 'Raised three litters of puppies.', ''),
  (9, 'Wren', 'Declined', 16, 7, 90, 'Studio apartment, new job with irregular hours.', 'None yet, but eager to learn.', ''),
  (10, 'Miso', 'Pending', 1, 14, 40, 'Two adults, quiet home, no other pets.', 'Cared for cats of friends and family.', 'Happy to take medication-needing cats.'),
  (11, 'Chesney', 'In review', 6, 9, 35, 'House with a fenced yard, work from home.', 'Fostered a hound mix for three months.', '')
)
insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until, note, status, submitted_at, reviewed_at, reviewed_by)
select m.id, m.name, m.email, m.phone, m.address, m.dob, p.id, p.name, f.household, f.experience,
  current_date + f.start_in, current_date + f.start_in + f.length_days, f.note, f.status,
  now() - (f.days_ago || ' days')::interval,
  case when f.status = 'Pending' then null else now() - ((f.days_ago - 1) || ' days')::interval end,
  case when f.status = 'Pending' then null else 'a1000000-0000-0000-0000-000000000002'::uuid end
from f join m on m.n = f.n join lateral (select id, name from public.pets where name = f.pet limit 1) p on true;

-- Lost-pet searches and inquiries (the members' photos are not seeded, so staff see the inquiry without images).
with s as (
  insert into public.lost_pet_searches (member_id, species, description, photo_paths, result, created_at, expires_at)
  select m.id, v.species, v.description, '{}', jsonb_build_array(jsonb_build_object('petId', p.id, 'confidence', v.confidence, 'reason', v.reason)),
    now() - (v.days_ago || ' days')::interval, now() + interval '25 days'
  from (values
    (3, 'Dog', 'Black and white, about 45 pounds, no collar', 'Black and white coat with a similar build.', 70, 'Sombra', 2),
    (8, 'Dog', 'Tan beagle mix with a white chest', 'Tan and white coat and a similar muzzle.', 78, 'Wren', 5),
    (12, 'Cat', 'Gray tabby, very shy', 'Similar tabby markings and size.', 64, 'Carlton', 9)
  ) as v (n, species, description, reason, confidence, pet, days_ago)
  join m on m.n = v.n
  join lateral (select id from public.pets where name = v.pet limit 1) p on true
  returning id, member_id, result
)
insert into public.lost_pet_inquiries (search_id, member_id, member_name, member_email, member_phone, pet_id, pet_name, message, status, staff_note, handled_by, handled_at, created_at)
select s.id, m.id, m.name, m.email, m.phone, (s.result -> 0 ->> 'petId')::uuid, p.name,
  case m.n when 3 then 'I think Sombra is my dog, he went missing near Moreland on Friday night. Can someone check for a microchip?'
           when 8 then 'Wren looks just like my beagle mix who disappeared two weeks ago. She has a white patch on her chest.'
           else 'This looks like my cat Pepper. She is very shy and was last seen near Ansley Park on Sunday.' end,
  case m.n when 3 then 'New' when 8 then 'In progress' else 'Resolved' end,
  case m.n when 3 then '' when 8 then 'Called her. Scheduled a visit tomorrow to confirm the chest patch.' else 'Not a match; owner found Pepper at a neighbor''s.' end,
  case when m.n = 3 then null else 'a1000000-0000-0000-0000-000000000002'::uuid end,
  case when m.n = 3 then null else now() - interval '1 day' end,
  now() - (case m.n when 3 then 1 when 8 then 4 else 8 end || ' days')::interval
from s join m on m.id = s.member_id join public.pets p on p.id = (s.result -> 0 ->> 'petId')::uuid;

-- Quiz results.
insert into public.quiz_responses (user_id, answers, recommendations, created_at)
select m.id,
  jsonb_build_object('livingSpace', 'apartment', 'household', 'adults', 'otherPets', 'none', 'activityLevel', 'low', 'hoursAlone', '4-8', 'experience', 'some', 'species', 'dog', 'size', 'any', 'age', 'senior', 'traits', jsonb_build_array('calm', 'cuddly'), 'notes', ''),
  jsonb_build_array(
    jsonb_build_object('petId', (select id from public.pets where name = 'Poppy' limit 1), 'score', 92, 'reason', 'A calm senior who suits a quiet apartment and a relaxed routine.'),
    jsonb_build_object('petId', (select id from public.pets where name = 'Padma Patil' limit 1), 'score', 81, 'reason', 'A gentle, loving senior who would be happy with a pile of soft blankets.')),
  now() - (m.n || ' days')::interval
from m where m.n in (4, 6, 8, 10, 12);

-- Test-mode donations over the last month.
insert into public.donations (stripe_session_id, stripe_payment_intent, amount_cents, currency, status, donor_name, donor_email, livemode, stripe_created_at)
select 'cs_test_seed_' || g, 'pi_test_seed_' || g,
  (array[1000, 2500, 2000, 5000, 1500, 10000, 3000, 2500, 7500, 2000, 4000, 1000, 2500, 6000])[g],
  'usd', case when g = 13 then 'pending' when g = 14 then 'failed' else 'succeeded' end,
  case when g % 4 = 0 then null else (select name from m where m.n = 1 + (g % 12)) end,
  case when g % 4 = 0 then null else (select email from m where m.n = 1 + (g % 12)) end,
  false, now() - ((g * 2) || ' days')::interval - ((g * 53 % 900) || ' minutes')::interval
from generate_series(1, 14) as g;

-- Open hours: weekly patterns that keep the next six weeks filled in, one blackout day, and an open house.
insert into public.availability_rules (kind, weekday, start_time, end_time, capacity, slot_minutes, title, description, requirements, min_age, weeks_ahead)
values
  ('visit', 2, time '16:00', time '19:00', 2, 30, '', '', '', 0, 9),
  ('visit', 4, time '16:00', time '19:00', 2, 30, '', '', '', 0, 9),
  ('visit', 6, time '09:00', time '13:00', 3, 30, '', '', '', 0, 9),
  ('shift', 6, time '09:00', time '12:00', 4, 30, 'Saturday dog walkers', 'Walk dogs on the trail behind the shelter and report how they did.', 'Closed-toe shoes. Handle a leash confidently.', 16, 9),
  ('shift', 0, time '13:00', time '16:00', 3, 30, 'Sunday cat socializers', 'Spend time with the cats so they stay friendly and ready for visitors.', 'Be calm and gentle around cats.', 14, 9);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select * from public.generate_availability();
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a1000000-0000-0000-0000-000000000002","email":"admin@pawheaven.local","app_metadata":{"role":"admin"}}', true);
select * from public.add_availability_exception(current_date + 19, 'Staff training day');
select public.create_event(
  'Fall Open House', 'Come meet the animals, tour the shelter, and ask us anything. Free treats for the dogs.',
  date_trunc('day', now() + interval '22 days') + interval '14 hours', date_trunc('day', now() + interval '22 days') + interval '18 hours',
  3, 30,
  '[{"title":"Greeters","description":"Welcome visitors at the door and hand out maps.","capacity":3},{"title":"Dog handlers","description":"Walk dogs out to meet visitors.","capacity":4,"minAge":16},{"title":"Treat table","description":"Run the donation and treat table.","capacity":2}]'::jsonb,
  array(select id from public.pets where name in ('Arlo', 'Hollie', 'Padma Patil', 'Poppy') and status = 'Available'));
select set_config('request.jwt.claims', '', true);

-- More events across the next two months (each replaces unbooked visit times it overlaps).
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a1000000-0000-0000-0000-000000000002","email":"admin@pawheaven.local","app_metadata":{"role":"admin"}}', true);
select public.create_event('Adopt-a-thon', 'Reduced adoption fees all afternoon, with staff on hand to answer questions and help with paperwork.',
  date_trunc('day', now() + interval '36 days') + interval '17 hours', date_trunc('day', now() + interval '36 days') + interval '21 hours', 4, 30,
  '[{"title":"Adoption counselors","description":"Walk visitors through the adoption process.","capacity":3,"minAge":18},{"title":"Dog handlers","description":"Bring dogs out to meet visitors.","capacity":4,"minAge":16},{"title":"Check-in desk","description":"Sign visitors in and hand out maps.","capacity":2}]'::jsonb,
  array(select id from public.pets where status = 'Available' and source_name <> '' order by intake_date limit 6));
select public.create_event('Volunteer Orientation', 'New volunteers: learn the routines, meet the team, and try your first shift.',
  date_trunc('day', now() + interval '45 days') + interval '23 hours', date_trunc('day', now() + interval '45 days') + interval '25 hours', 0, 30,
  '[{"title":"Orientation trainees","description":"Attend the orientation and shadow a volunteer.","capacity":15,"minAge":16},{"title":"Orientation mentors","description":"Lead a small group through the shelter.","capacity":4,"minAge":18}]'::jsonb, '{}');
select public.create_event('Holiday Pet Photos', 'Bring the whole family. Photos with our animals benefit the shelter.',
  date_trunc('day', now() + interval '56 days') + interval '15 hours', date_trunc('day', now() + interval '56 days') + interval '19 hours', 3, 30,
  '[{"title":"Photo helpers","description":"Keep animals calm and happy during photos.","capacity":4}]'::jsonb,
  array(select id from public.pets where status = 'Available' and species = 'Cat' order by intake_date desc limit 4));
select set_config('request.jwt.claims', '', true);

-- Two months of activity: members fill the generated visit times and shifts, with names, party sizes, and pets.
do $$
declare
  v_slot record;
  v_member record;
  v_shift record;
  v_appointment_id uuid;
  v_target integer;
  v_count integer;
  v_i integer := 0;
begin
  for v_slot in
    select s.id, s.starts_at, s.ends_at, s.capacity from public.visit_slots s
    where s.status = 'published' and s.starts_at between now() + interval '2 days' and now() + interval '60 days'
    order by s.starts_at
  loop
    v_i := v_i + 1;
    -- Roughly half of the times are taken, some twice, so the calendar looks busy but not full.
    v_target := case when v_i % 4 = 0 then 0 when v_i % 4 = 1 then 1 when v_i % 4 = 2 then 1 else least(v_slot.capacity, 2) end;
    v_count := 0;
    for v_member in select * from m order by (n * 7 + v_i) % 12 loop
      exit when v_count >= v_target;
      continue when exists (select 1 from public.appointments a where a.slot_id = v_slot.id and a.member_id = v_member.id and a.status = 'booked');
      continue when (select count(*) from public.appointments a where a.slot_id = v_slot.id and a.status = 'booked') >= v_slot.capacity;
      insert into public.appointments (member_id, member_name, member_email, slot_id, purpose, party_size, created_at, updated_at)
      values (v_member.id, v_member.name, v_member.email, v_slot.id,
        (array['Meet a dog I saw online', 'Learn about fostering', 'Meet the cats before adopting', 'Bring my kids to meet a few dogs', 'Ask about senior pets', 'Tour the shelter and meet staff', 'Second visit before we decide'])[1 + (v_i + v_member.n) % 7],
        1 + (v_i + v_member.n) % 4, now() - make_interval(days => 1 + (v_i % 6)), now() - make_interval(days => 1 + (v_i % 6)))
      returning id into v_appointment_id;
      insert into public.appointment_events (appointment_id, member_id, event_type, slot_starts_at, slot_ends_at, created_at)
      values (v_appointment_id, v_member.id, 'booked', v_slot.starts_at, v_slot.ends_at, now() - make_interval(days => 1 + (v_i % 6)));
      if v_i % 2 = 0 then
        insert into public.appointment_pets (appointment_id, pet_id, pet_name)
        select v_appointment_id, p.id, p.name from public.pets p where p.status = 'Available' and p.visits_open
        order by md5(p.id::text || v_i::text) limit 1 + v_i % 3
        on conflict do nothing;
      end if;
      v_count := v_count + 1;
    end loop;
  end loop;

  v_i := 0;
  for v_shift in
    select sh.id, sh.starts_at, sh.ends_at, sh.capacity, sh.min_age from public.volunteer_shifts sh
    where sh.status = 'published' and sh.starts_at between now() + interval '2 days' and now() + interval '60 days'
      and sh.id::text not like 'd1000000-%' -- the original demo shifts keep their known sign-up counts for the verifier
    order by sh.starts_at
  loop
    v_i := v_i + 1;
    v_target := case when v_i % 5 = 0 then 0 else least(v_shift.capacity, 1 + (v_i * 7) % greatest(v_shift.capacity, 1)) end;
    -- Count sign-ups already on the shift so it never ends up over capacity.
    select count(*) into v_count from public.volunteer_registrations r where r.shift_id = v_shift.id and r.status = 'registered';
    v_target := least(v_target + v_count, v_shift.capacity);
    for v_member in select * from m order by (n * 5 + v_i) % 12 loop
      exit when v_count >= v_target;
      continue when extract(year from age(v_member.dob)) < v_shift.min_age;
      continue when exists (select 1 from public.volunteer_registrations r where r.shift_id = v_shift.id and r.member_id = v_member.id);
      continue when exists (
        select 1 from public.volunteer_registrations r join public.volunteer_shifts o on o.id = r.shift_id
        where r.member_id = v_member.id and r.status = 'registered' and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(v_shift.starts_at, v_shift.ends_at, '[)'));
      insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth, created_at, updated_at)
      values (v_shift.id, v_member.id, v_member.name, v_member.email, v_member.phone, v_member.dob, now() - make_interval(days => 1 + (v_i % 9)), now() - make_interval(days => 1 + (v_i % 9)));
      v_count := v_count + 1;
    end loop;
  end loop;
end $$;

-- Pet quick actions: a few dogs need walkers, one animal is not offered for visits.
update public.pets set needs_walkers = true where name in ('Arlo', 'Padma Patil', 'Fuerte') and species = 'Dog';
update public.pets set visits_open = false where name = 'Sombra';

-- Visits name the animals people want to meet.
insert into public.appointment_pets (appointment_id, pet_id, pet_name)
select a.id, p.id, p.name
from (select id, row_number() over (order by created_at) as r from public.appointments where status = 'booked') a
join (select id, name, row_number() over (order by name) as r from public.pets where status = 'Available' and source_name <> '' and visits_open) p
  on p.r = a.r
where a.r <= 8;
update public.appointments set party_size = 1 + (abs(hashtext(id::text)) % 4);

-- Foster pool: approved fosters opted in; one open request for a long-stay pet, with a decline and one pending.
insert into public.foster_pool_optins (member_id)
select distinct f.applicant_id from public.foster_applications f where f.status = 'Approved';
with stale as (
  select id from public.pets where status = 'Available' and source_name <> '' and housing = 'Shelter' order by intake_date limit 1
), r as (
  insert into public.foster_requests (pet_id, note, created_by, created_at)
  select id, 'Kennel stress is showing. A quiet home for two weeks would help a lot.', 'a1000000-0000-0000-0000-000000000002', now() - interval '3 days' from stale returning id, pet_id
)
insert into public.foster_request_responses (request_id, member_id, response, notified_at, responded_at)
select r.id, o.member_id, case when row_number() over () = 1 then 'declined' else 'pending' end, now() - interval '3 days',
  case when row_number() over () = 1 then now() - interval '2 days' end
from r cross join public.foster_pool_optins o;
update public.pets set foster_available = true, foster_urgent_at = now() - interval '3 days' where id in (select pet_id from public.foster_requests where closed_at is null);

-- A volunteer with many finished shifts who has never fostered, and an invitation already sent to another.
insert into public.foster_invitations (member_id, invited_by, invited_at)
select m.id, 'a1000000-0000-0000-0000-000000000002', now() - interval '2 days' from m where m.n = 12;

-- Email alerts and newsletter: subscribers (some pending or gone), saved searches and animals,
-- one member who turned the digest off, a sent issue, and a draft.
insert into public.email_subscribers (email, member_id, status, confirmed_at, unsubscribed_at, created_at)
select lower(m.email), m.id,
  case when m.n <= 8 then 'confirmed' when m.n = 9 then 'pending' else 'unsubscribed' end,
  case when m.n <= 8 then now() - make_interval(days => 40 - m.n * 3) end,
  case when m.n = 10 then now() - interval '5 days' end,
  now() - make_interval(days => 45 - m.n * 3)
from m where m.n <= 10
on conflict do nothing;
insert into public.email_subscribers (email, status, confirmed_at, created_at)
values
  ('delivered+neighbor.one@resend.dev', 'confirmed', now() - interval '20 days', now() - interval '21 days'),
  ('delivered+neighbor.two@resend.dev', 'confirmed', now() - interval '9 days', now() - interval '10 days'),
  ('delivered+neighbor.three@resend.dev', 'pending', null, now() - interval '1 day')
on conflict do nothing;

insert into public.saved_searches (member_id, label, filters, created_at)
select m.id, v.label, v.filters::jsonb, now() - make_interval(days => 20 - m.n)
from m join (values
  (1, 'Dogs, good with kids', '{"species":"dog","kids":true}'),
  (2, 'Cats', '{"species":"cat"}'),
  (3, 'Senior, open to foster', '{"age":"senior","foster":true}'),
  (4, 'Small dogs', '{"species":"dog","size":"small"}'),
  (5, 'Young animals', '{"age":"young"}'),
  (5, 'Good with dogs and cats', '{"dogs":true,"cats":true}')
) v(n, label, filters) on v.n = m.n
on conflict do nothing;

insert into public.saved_pets (member_id, pet_id, created_at)
select m.id, p.id, now() - make_interval(days => p.rn::integer + m.n::integer)
from m
cross join lateral (select id, row_number() over (order by md5(id::text || m.n::text)) rn from public.pets where status = 'Available') p
where m.n <= 6 and p.rn <= 2
on conflict do nothing;

insert into public.member_email_prefs (member_id, match_digest, saved_changes)
select id, false, true from m where n = 7
on conflict do nothing;

insert into public.newsletters (subject, body, blocks, status, recipient_count, created_at, updated_at, sent_at)
values ('Fall adoption news', E'Thank you for a wonderful October. Eleven animals went home, and a few are still waiting for their person.\n\nOur Fall Open House is coming up. Bring the family and meet the animals.', '{help,events}', 'sent', 8, now() - interval '13 days', now() - interval '12 days', now() - interval '12 days');
insert into public.newsletters (subject, body, blocks)
values ('Holiday open house and photos', E'Holiday Pet Photos is on the calendar, and we need volunteers to help the animals look their best.\n\nHere is who needs a home before the holidays.', '{help,newest,shifts}');

drop table m;

-- Shelter status: kennel counts sized from today's animals (dogs about 90 percent full, cats and
-- others roomy), and a handful of animals flagged as needing help with different reasons.
update public.shelter_capacity c set
  kennels = case c.species_group when 'Dog' then greatest(ceil(u.used / 0.9)::integer, 1) when 'Cat' then greatest(u.used * 4, 12) else 10 end,
  held_back = 0, updated_at = now()
from (
  select public.species_group(species) as species_group, count(*)::integer as used
  from public.pets where status in ('Available', 'Pending') and housing <> 'Foster home' group by 1
) u
where u.species_group = c.species_group;

with ranked as (
  select id, row_number() over (order by intake_date, name) as n
  from public.pets where status = 'Available' and housing <> 'Foster home' and species = 'Dog'
)
update public.pets p set help_reason = case when r.n <= 2 then 'long_stay' when r.n = 3 then 'home_soon' else 'medical' end
from ranked r where p.id = r.id and r.n <= 4;
update public.pets set help_reason = 'foster' where foster_urgent_at is not null and status = 'Available' and help_reason = '';
