-- Local demo data only. `npm run db:reset` recreates these records in Docker;
-- none of these email addresses or passwords belong in a hosted environment.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, raw_app_meta_data, raw_user_meta_data, created_at,
  updated_at
)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo.applicant@pawheaven.local',
    extensions.crypt('DemoApplicant-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo Applicant","email":"demo.applicant@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000001"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo.staff@pawheaven.local',
    extensions.crypt('DemoStaff-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"Demo Staff","email":"demo.staff@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000002"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo.superuser@pawheaven.local',
    extensions.crypt('DemoSuperuser-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"superuser"}'::jsonb,
    '{"name":"Demo Superuser","email":"demo.superuser@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000003"}'::jsonb,
    now(), now()
  );

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '{"sub":"a1000000-0000-0000-0000-000000000001","email":"demo.applicant@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    '{"sub":"a1000000-0000-0000-0000-000000000002","email":"demo.staff@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    '{"sub":"a1000000-0000-0000-0000-000000000003","email":"demo.superuser@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  );

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary)
values
  (
    'b1000000-0000-0000-0000-000000000001', 'Baxter', 'Dog', 'Bernese Mountain Dog mix', '4 years', '2026-07-08',
    array['big-dog', 'gentle', 'good-with-kids'], 'Available',
    'Baxter is a steady, affectionate dog who enjoys leisurely walks, brushing, and relaxed time with people.'
  ),
  (
    'b1000000-0000-0000-0000-000000000002', 'Cleo', 'Cat', 'Domestic shorthair', '2 years', '2026-08-19',
    array['indoor', 'calm'], 'Available',
    'Cleo is an observant indoor cat who settles quickly into quiet rooms and enjoys a sunny window perch.'
  ),
  (
    'b1000000-0000-0000-0000-000000000003', 'Juniper', 'Dog', 'Australian Cattle Dog mix', '1 year', '2026-09-11',
    array['active', 'training'], 'Available',
    'Juniper is a bright young dog looking for an active home that enjoys training games and regular exercise.'
  ),
  (
    'b1000000-0000-0000-0000-000000000004', 'Rosie', 'Rabbit', 'Lionhead mix', '3 years', '2026-08-03',
    array['indoor', 'quiet'], 'Pending',
    'Rosie is meeting a prospective family and is not accepting new adoption applications at this time.'
  ),
  (
    'b1000000-0000-0000-0000-000000000005', 'Theo', 'Cat', 'Siamese mix', '5 years', '2026-06-28',
    array['social', 'indoor'], 'Adopted',
    'Theo has found a home and remains in the demo data only to verify that adopted pets stay out of public results.'
  ),
  (
    'b1000000-0000-0000-0000-000000000006', 'Wren', 'Dog', 'Beagle mix', '6 years', '2026-07-25',
    array['small-dog', 'friendly'], 'Available',
    'Wren is a friendly companion who likes neighborhood walks, familiar routines, and greeting new visitors.'
  );

-- Sprint 4 pet details: public medical summaries, foster eligibility, and the
-- additional Fostered and Unavailable statuses.
update public.pets set
  medical_history = 'Vaccinations current. Neutered. Treated for seasonal skin allergies in 2026; no ongoing medication.',
  foster_available = true
where id = 'b1000000-0000-0000-0000-000000000001';
update public.pets set
  medical_history = 'Spayed and microchipped. Vaccinations current. Tested negative for FIV and FeLV.'
where id = 'b1000000-0000-0000-0000-000000000002';
update public.pets set
  medical_history = 'Vaccinations current. Neutered. Completed basic obedience evaluation with staff.',
  foster_available = true
where id = 'b1000000-0000-0000-0000-000000000003';
update public.pets set
  medical_history = 'Spayed. Senior wellness exam complete; manages mild arthritis with a daily supplement.'
where id = 'b1000000-0000-0000-0000-000000000006';

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, medical_history, foster_available)
values
  (
    'b1000000-0000-0000-0000-000000000007', 'Arlo', 'Dog', 'Labrador Retriever mix', '2 years', '2026-09-02',
    array['big-dog', 'playful', 'good-with-kids'], 'Available',
    'Arlo is an enthusiastic young Lab mix who loves fetch, water, and being part of whatever the family is doing.',
    'Vaccinations current. Neutered. Healed fracture of the left foreleg in 2026; cleared for normal exercise.', true
  ),
  (
    'b1000000-0000-0000-0000-000000000008', 'Miso', 'Cat', 'Orange tabby', '1 year', '2026-10-01',
    array['playful', 'indoor'], 'Available',
    'Miso is a curious kitten-at-heart who chases feather toys and curls up on laps once the play is over.',
    'Vaccinations current. Neutered. Treated for ear mites; fully recovered.', true
  ),
  (
    'b1000000-0000-0000-0000-000000000009', 'Poppy', 'Dog', 'Pug mix', '7 years', '2026-05-20',
    array['small-dog', 'calm', 'senior'], 'Available',
    'Poppy is a relaxed senior who is happiest on a soft bed near her people and enjoys short, slow walks.',
    'Spayed. Vaccinations current. Dental cleaning completed in September 2026.', false
  ),
  (
    'b1000000-0000-0000-0000-000000000010', 'Daisy', 'Dog', 'Border Collie mix', '3 years', '2026-08-28',
    array['active', 'training', 'big-dog'], 'Fostered',
    'Daisy is currently in a foster home and is not accepting new applications while she settles in.',
    'Spayed. Vaccinations current.', false
  ),
  (
    'b1000000-0000-0000-0000-000000000011', 'Pearl', 'Cat', 'Russian Blue mix', '4 years', '2026-09-15',
    array['quiet', 'indoor'], 'Unavailable',
    'Pearl is receiving veterinary care and will be listed again when she is ready for visitors.',
    'Recovering from a dental procedure; recheck scheduled.', false
  );

-- Relative future visit times keep the local scheduling demo usable after the
-- seed date. They are stored as America/New_York instants, matching the UI.
insert into public.visit_slots (id, starts_at, ends_at, created_by)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    ((timezone('America/New_York', now())::date + 1 + time '10:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 1 + time '10:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    ((timezone('America/New_York', now())::date + 1 + time '11:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 1 + time '11:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    ((timezone('America/New_York', now())::date + 2 + time '14:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 2 + time '14:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  );

-- Volunteer demo shifts, relative to the seed date in the shelter timezone.
-- The kennel shift and the laundry shift overlap so the time-conflict message
-- can be shown; the adoption-event shift is already full (staff and a
-- superuser account stand in as volunteers); the dog-walking shift has an
-- 18+ minimum age.
insert into public.volunteer_shifts (id, title, description, requirements, min_age, starts_at, ends_at, capacity, created_by)
values
  (
    'd1000000-0000-0000-0000-000000000001', 'Kennel care',
    'Clean and refill kennels, fresh water, and bedding for the dogs and cats.',
    'Closed-toe shoes. No experience needed; staff will train you.', 0,
    ((timezone('America/New_York', now())::date + 3 + time '09:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 3 + time '12:00') at time zone 'America/New_York'),
    4, 'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'd1000000-0000-0000-0000-000000000002', 'Dog walking',
    'Walk shelter dogs on the trail behind the building and log how each walk went.',
    'Comfortable handling large dogs. Volunteers must be 18 or older.', 18,
    ((timezone('America/New_York', now())::date + 4 + time '10:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 4 + time '12:00') at time zone 'America/New_York'),
    6, 'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'd1000000-0000-0000-0000-000000000003', 'Adoption event greeter',
    'Welcome visitors at the weekend adoption event and hand out information sheets.',
    '', 16,
    ((timezone('America/New_York', now())::date + 5 + time '13:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 5 + time '16:00') at time zone 'America/New_York'),
    1, 'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'd1000000-0000-0000-0000-000000000004', 'Laundry and supplies',
    'Wash blankets and towels and restock the supply closet.',
    '', 0,
    ((timezone('America/New_York', now())::date + 3 + time '11:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 3 + time '13:00') at time zone 'America/New_York'),
    3, 'a1000000-0000-0000-0000-000000000002'
  );

insert into public.volunteer_registrations (shift_id, member_id, member_name, member_email, member_phone, member_date_of_birth)
values
  (
    'd1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
    'Demo Superuser', 'demo.superuser@pawheaven.local', '(404) 555-0100', date '1985-06-15'
  );

-- Recorded pet attributes, so "black dog" search, the pet page, and the matching
-- quiz have real data to work with. Anything not listed stays "not recorded".
update public.pets as pet
set sex = data.sex, size = data.size, color = data.color, weight_lbs = data.weight,
    spayed_neutered = data.fixed, good_with_kids = data.kids, good_with_dogs = data.dogs,
    good_with_cats = data.cats, energy_level = data.energy
from (values
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'Male',   'Large',  'Black, white and tan', 82, 'Yes', 'Yes',     'Yes',     'Unknown', 'Low'),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 'Female', 'Small',  'Gray tabby',            9, 'Yes', 'Yes',     'Unknown', 'Yes',     'Medium'),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 'Female', 'Medium', 'Brindle',              48, 'Yes', 'Yes',     'Yes',     'No',      'High'),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 'Female', 'Small',  'White',                 4, 'No',  'Unknown', 'Unknown', 'Unknown', 'Medium'),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 'Male',   'Medium', 'Black',                 11, 'Yes', 'Yes',     'Unknown', 'Yes',     'Medium'),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 'Female', 'Medium', 'Tan and white',         24, 'Yes', 'Yes',     'Yes',     'Unknown', 'Medium'),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 'Male',   'Large',  'Cream',                 68, 'Yes', 'Yes',     'Yes',     'Unknown', 'High'),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 'Male',   'Small',  'Orange tabby',           8, 'Yes', 'Yes',     'Unknown', 'Yes',     'High'),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 'Female', 'Small',  'Fawn',                  21, 'Yes', 'Unknown', 'Yes',     'Unknown', 'Low'),
  ('b1000000-0000-0000-0000-000000000010'::uuid, 'Female', 'Medium', 'Black and white',       41, 'Yes', 'Yes',     'Yes',     'Unknown', 'High'),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 'Female', 'Small',  'Blue-gray',              8, 'Yes', 'Unknown', 'Unknown', 'Unknown', 'Low')
) as data (id, sex, size, color, weight, fixed, kids, dogs, cats, energy)
where pet.id = data.id;
