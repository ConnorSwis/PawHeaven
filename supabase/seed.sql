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
