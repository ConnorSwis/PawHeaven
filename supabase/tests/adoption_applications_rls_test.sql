begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@example.com', '', now(), '{}', '{"name":"Member"}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', '', now(), '{}', '{"name":"Other member"}', now(), now()),
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', '', now(), '{"role":"admin"}', '{"name":"Admin"}', now(), now());

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary)
values
  ('20000000-0000-0000-0000-000000000001', 'Available pet', 'Dog', 'Mixed', 'Adult', current_date, '{}', 'Available', 'Ready to meet applicants'),
  ('20000000-0000-0000-0000-000000000002', 'Pending pet', 'Dog', 'Mixed', 'Adult', current_date, '{}', 'Pending', 'Not open for applications');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"30000000-0000-0000-0000-000000000001","email":"member@example.com","app_metadata":{}}';

select lives_ok(
  $$insert into public.adoption_applications (applicant_id, applicant_name, applicant_email, pet_id, pet_name, household_summary)
    values ('30000000-0000-0000-0000-000000000001', 'Member', 'member@example.com', '20000000-0000-0000-0000-000000000001', 'Available pet', 'We have a calm home, a fenced yard, and time for daily walks together.')$$,
  'a member can apply for an available pet'
);

select results_eq(
  $$select pet_name from public.adoption_applications order by pet_name$$,
  array['Available pet'],
  'a member can read their own application'
);

select throws_ok(
  $$insert into public.adoption_applications (applicant_id, applicant_name, applicant_email, pet_id, pet_name, household_summary)
    values ('30000000-0000-0000-0000-000000000001', 'Member', 'member@example.com', '20000000-0000-0000-0000-000000000002', 'Pending pet', 'We have a calm home, a fenced yard, and time for daily walks together.')$$,
  '42501', null,
  'a member cannot apply for a non-available pet'
);

select throws_ok(
  $$insert into public.adoption_applications (applicant_id, applicant_name, applicant_email, pet_id, pet_name, household_summary)
    values ('30000000-0000-0000-0000-000000000001', 'Member', 'different@example.com', '20000000-0000-0000-0000-000000000001', 'Available pet', 'We have a calm home, a fenced yard, and time for daily walks together.')$$,
  '42501', null,
  'a member cannot substitute a different contact email'
);

select throws_ok(
  $$update public.adoption_applications set status = 'Approved'$$,
  '42501', null,
  'a member cannot decide their own application'
);

set local role postgres;
insert into public.adoption_applications (id, applicant_id, applicant_name, applicant_email, pet_id, pet_name, household_summary)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Other member', 'other@example.com', '20000000-0000-0000-0000-000000000001', 'Available pet', 'Our household has discussed the responsibility and is ready for daily care.');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"30000000-0000-0000-0000-000000000001","email":"member@example.com","app_metadata":{}}';

select results_eq(
  $$select applicant_email from public.adoption_applications order by applicant_email$$,
  array['member@example.com'],
  'a member cannot read another member application'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"50000000-0000-0000-0000-000000000001","email":"admin@example.com","app_metadata":{"role":"admin"}}';

select results_eq(
  $$select count(*)::integer from public.adoption_applications$$,
  array[2],
  'an administrator can read all applications'
);

select lives_ok(
  $$update public.adoption_applications
    set status = 'In review', reviewed_at = now(), reviewed_by = '50000000-0000-0000-0000-000000000001'
    where applicant_email = 'member@example.com'$$,
  'an administrator can record an application review'
);

select results_eq(
  $$select status from public.adoption_applications where applicant_email = 'member@example.com'$$,
  array['In review'],
  'the recorded application outcome is visible to an administrator'
);

select * from finish();
rollback;
