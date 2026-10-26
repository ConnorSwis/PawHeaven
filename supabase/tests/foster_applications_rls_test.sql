begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'foster-member@example.com', '', now(), '{}', '{"name":"Foster member"}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-foster-member@example.com', '', now(), '{}', '{"name":"Other foster member"}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'foster-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Foster staff"}', now(), now());

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, foster_available)
values
  ('72000000-0000-0000-0000-000000000001', 'Fosterable', 'Dog', 'Mixed', '2 years', current_date - 5, '{}', 'Available', 'Open to foster placement for testing.', true),
  ('72000000-0000-0000-0000-000000000002', 'Adopt Only', 'Cat', 'Mixed', '3 years', current_date - 5, '{}', 'Available', 'Not open to foster placement for testing.', false),
  ('72000000-0000-0000-0000-000000000003', 'Held Pet', 'Dog', 'Mixed', '4 years', current_date - 5, '{}', 'Pending', 'Foster flag set but the pet is not public.', true);

set local role anon;
select throws_ok(
  $$select count(*) from public.foster_applications$$,
  '42501', null,
  'an anonymous visitor cannot read foster applications'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000001","email":"foster-member@example.com","app_metadata":{},"user_metadata":{"name":"Foster member"}}';

select lives_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000001', 'Foster member', 'foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  'a member can apply to foster an available fosterable pet'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000001', 'Foster member', 'foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  '23505', null,
  'a member cannot apply twice to foster the same pet'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000001', 'Foster member', 'foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000002', 'Adopt Only', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  '42501', null,
  'a pet that is not open to foster cannot receive a foster application'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000001', 'Foster member', 'foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000003', 'Held Pet', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  '42501', null,
  'a pet that is not Available cannot receive a foster application'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000002', 'Someone else', 'other-foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  '42501', null,
  'a member cannot submit an application on behalf of another member'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000002","email":"other-foster-member@example.com","app_metadata":{},"user_metadata":{"name":"Other foster member"}}';

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000002', 'Other foster member', 'other-foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', current_date - interval '17 years', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 7, current_date + 60)$$,
  '42501', null,
  'an applicant under 18 is rejected by the database'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000002', 'Other foster member', 'other-foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 30, current_date + 10)$$,
  '23514', null,
  'an availability window that ends before it starts is rejected'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000002', 'Other foster member', 'other-foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date + 1, current_date + 500)$$,
  '23514', null,
  'an availability window longer than a year is rejected'
);

select throws_ok(
  $$insert into public.foster_applications (applicant_id, applicant_name, applicant_email, applicant_phone, applicant_address, applicant_date_of_birth, pet_id, pet_name, household_summary, foster_experience, available_from, available_until)
    values ('71000000-0000-0000-0000-000000000002', 'Other foster member', 'other-foster-member@example.com', '404-555-0142', '10 Peachtree St, Atlanta, GA', date '1990-01-01', '72000000-0000-0000-0000-000000000001', 'Fosterable', 'Two adults, a fenced yard, and a quiet routine.', 'I fostered two dogs for a local rescue last year.', current_date - 10, current_date + 20)$$,
  '42501', null,
  'an availability window that started in the past is rejected'
);

select results_eq(
  $$select count(*)::integer from public.foster_applications where pet_id::text like '72000000-%'$$,
  array[0],
  'a member cannot read another member foster application'
);

update public.foster_applications set status = 'Approved', reviewed_at = now(), reviewed_by = '71000000-0000-0000-0000-000000000002' where pet_id::text like '72000000-%';

select results_eq(
  $$select count(*)::integer from public.foster_applications where pet_id::text like '72000000-%'$$,
  array[0],
  'a member update does not reach another member foster application'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"71000000-0000-0000-0000-000000000003","email":"foster-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Foster staff"}}';

select results_eq(
  $$select status from public.foster_applications where pet_id::text like '72000000-%'$$,
  array['Pending'],
  'staff can read every foster application and the member update changed nothing'
);

select throws_ok(
  $$update public.foster_applications set status = 'Approved', reviewed_at = now(), reviewed_by = '71000000-0000-0000-0000-000000000001' where pet_id::text like '72000000-%'$$,
  '42501', null,
  'staff cannot record an outcome as another reviewer'
);

select throws_ok(
  $$update public.foster_applications set status = 'Pending', reviewed_at = now(), reviewed_by = '71000000-0000-0000-0000-000000000003' where pet_id::text like '72000000-%'$$,
  '42501', null,
  'staff cannot return a reviewed application to Pending with review data'
);

select throws_ok(
  $$update public.foster_applications set applicant_phone = '404-555-9999' where pet_id::text like '72000000-%'$$,
  '42501', null,
  'staff cannot edit applicant-submitted columns'
);

select lives_ok(
  $$update public.foster_applications set status = 'Approved', reviewed_at = now(), reviewed_by = '71000000-0000-0000-0000-000000000003' where pet_id::text like '72000000-%'$$,
  'staff can record a foster application outcome'
);

select results_eq(
  $$select p.status from public.pets p where p.id = '72000000-0000-0000-0000-000000000001'$$,
  array['Available'],
  'approving a foster application never changes pet availability'
);

select * from finish();
rollback;
