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
    'authenticated', 'authenticated', 'demo.admin@pawheaven.local',
    extensions.crypt('DemoAdmin-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"Demo Administrator","email":"demo.admin@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000002"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo.review@pawheaven.local',
    extensions.crypt('DemoReview-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo Review Applicant","email":"demo.review@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000003"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'demo.visitor@pawheaven.local',
    extensions.crypt('DemoVisitor-2026!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo Scheduled Visitor","email":"demo.visitor@pawheaven.local","email_verified":true,"phone_verified":false,"sub":"a1000000-0000-0000-0000-000000000004"}'::jsonb,
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
    '{"sub":"a1000000-0000-0000-0000-000000000002","email":"demo.admin@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    '{"sub":"a1000000-0000-0000-0000-000000000003","email":"demo.review@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000004',
    '{"sub":"a1000000-0000-0000-0000-000000000004","email":"demo.visitor@pawheaven.local","email_verified":true,"phone_verified":false}'::jsonb,
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
  ),
  (
    'b1000000-0000-0000-0000-000000000007', 'Arlo', 'Dog', 'Labrador Retriever mix', '8 years', '2026-04-17',
    array['senior', 'gentle', 'walks'], 'Available',
    'Arlo is a gentle older dog who enjoys short walks, soft beds, and being close to his people.'
  ),
  (
    'b1000000-0000-0000-0000-000000000008', 'Daisy', 'Cat', 'Domestic longhair', '6 months', '2026-09-23',
    array['kitten', 'playful', 'indoor'], 'Available',
    'Daisy is a curious young cat who loves wand toys, climbing posts, and a patient introduction to a new home.'
  ),
  (
    'b1000000-0000-0000-0000-000000000009', 'Miso', 'Cat', 'Tabby', '3 years', '2026-05-30',
    array['social', 'indoor', 'lap-cat'], 'Available',
    'Miso is a social tabby who greets visitors at the door and appreciates a predictable indoor routine.'
  ),
  (
    'b1000000-0000-0000-0000-000000000010', 'Nimbus', 'Rabbit', 'Dutch mix', '2 years', '2026-08-07',
    array['quiet', 'indoor', 'gentle'], 'Available',
    'Nimbus is a calm rabbit who enjoys a roomy pen, daily hay, and gentle interaction at her own pace.'
  ),
  (
    'b1000000-0000-0000-0000-000000000011', 'Poppy', 'Dog', 'American Staffordshire Terrier mix', '5 years', '2026-03-12',
    array['affectionate', 'training', 'medium-dog'], 'Available',
    'Poppy is an affectionate dog who knows her basic cues and would enjoy continued positive-reinforcement training.'
  ),
  (
    'b1000000-0000-0000-0000-000000000012', 'Ranger', 'Dog', 'German Shepherd mix', '7 years', '2026-02-28',
    array['loyal', 'active', 'experienced-home'], 'Available',
    'Ranger is a loyal companion who thrives with consistent routines, enrichment, and an experienced dog home.'
  ),
  (
    'b1000000-0000-0000-0000-000000000013', 'Saffron', 'Cat', 'Calico', '9 years', '2026-01-19',
    array['senior', 'quiet', 'indoor'], 'Available',
    'Saffron is a relaxed senior cat looking for a quiet home with sunny places to nap and gentle companionship.'
  ),
  (
    'b1000000-0000-0000-0000-000000000014', 'Zola', 'Guinea pig', 'American guinea pig', '1 year', '2026-09-02',
    array['small-pet', 'gentle', 'bonded-pair-ready'], 'Available',
    'Zola is an alert little guinea pig who enjoys fresh vegetables, hideouts, and calm daily social time.'
  );

-- Relative future visit times keep the local scheduling demo usable after the
-- seed date. They are stored as America/New_York instants, matching the UI.
insert into public.visit_slots (id, starts_at, ends_at, created_by)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    ((timezone('America/New_York', now())::date + 7 + time '10:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 7 + time '10:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    ((timezone('America/New_York', now())::date + 7 + time '11:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 7 + time '11:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    ((timezone('America/New_York', now())::date + 8 + time '14:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 8 + time '14:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    ((timezone('America/New_York', now())::date + 9 + time '10:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 9 + time '10:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    ((timezone('America/New_York', now())::date + 10 + time '14:00') at time zone 'America/New_York'),
    ((timezone('America/New_York', now())::date + 10 + time '14:30') at time zone 'America/New_York'),
    'a1000000-0000-0000-0000-000000000002'
  );

update public.visit_slots
set status = 'withdrawn'
where id = 'c1000000-0000-0000-0000-000000000005';

-- These records make the staff views useful immediately, while the primary
-- demo applicant remains free to submit an application and book a visit live.
insert into public.adoption_applications (
  id, applicant_id, applicant_name, applicant_email, pet_id, pet_name,
  household_summary, adoption_experience, note, submitted_at
)
values (
  'd1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000003',
  'Demo Review Applicant',
  'demo.review@pawheaven.local',
  'b1000000-0000-0000-0000-000000000011',
  'Poppy',
  'Our household has a calm daily routine, a fenced exercise area, and time for training and enrichment.',
  'We have cared for medium-sized dogs and will follow the shelter’s transition guidance before bringing Poppy home.',
  'We would be happy to arrange a meet and greet after our application is reviewed.',
  now() - interval '2 hours'
);

insert into public.appointments (
  id, member_id, member_name, member_email, slot_id, purpose, created_at, updated_at
)
values (
  'e1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000004',
  'Demo Scheduled Visitor',
  'demo.visitor@pawheaven.local',
  'c1000000-0000-0000-0000-000000000004',
  'We would like to meet several pets and learn how the shelter adoption process works.',
  now() - interval '1 hour',
  now() - interval '1 hour'
);

insert into public.appointment_events (
  id, appointment_id, member_id, event_type, slot_starts_at, slot_ends_at, created_at
)
values (
  'f1000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000004',
  'booked',
  ((timezone('America/New_York', now())::date + 9 + time '10:00') at time zone 'America/New_York'),
  ((timezone('America/New_York', now())::date + 9 + time '10:30') at time zone 'America/New_York'),
  now() - interval '1 hour'
);
