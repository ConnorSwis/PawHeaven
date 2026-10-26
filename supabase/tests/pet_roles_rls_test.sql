begin;
select plan(13);

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary)
values
  ('10000000-0000-0000-0000-000000000001', 'Public pet', 'Dog', 'Mixed', 'Adult', current_date, array['friendly'], 'Available', 'Visible to visitors'),
  ('10000000-0000-0000-0000-000000000002', 'Pending pet', 'Dog', 'Mixed', 'Adult', current_date, array['private'], 'Pending', 'Visible only to administrators');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select results_eq(
  $$select name from public.pets where id = '10000000-0000-0000-0000-000000000002'$$,
  array['Pending pet'],
  'admin can read a non-public pet'
);

select lives_ok(
  $$insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary)
    values ('10000000-0000-0000-0000-000000000003', 'Admin created pet', 'Cat', 'Mixed', 'Young', current_date, array['new'], 'Available', 'Created by an admin')$$,
  'admin can create a pet'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"superuser"}}';

select lives_ok(
  $$update public.pets set status = 'Adopted' where id = '10000000-0000-0000-0000-000000000002'$$,
  'superuser can update a pet'
);

select results_eq(
  $$select status from public.pets where id = '10000000-0000-0000-0000-000000000002'$$,
  array['Adopted'],
  'superuser can read a non-public pet'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select results_eq(
  $$select name from public.pets where id = '10000000-0000-0000-0000-000000000002'$$,
  array[]::text[],
  'ordinary users cannot read non-public pets'
);

select throws_ok(
  $$insert into public.pets (name, species, breed, age_label, intake_date, tags, status, summary)
    values ('Unauthorized pet', 'Dog', 'Mixed', 'Adult', current_date, '{}', 'Available', 'Must be denied')$$,
  '42501',
  null,
  'ordinary users cannot create pets'
);

set local role postgres;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select results_eq(
  $$select name from public.pets where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003') order by name$$,
  array['Admin created pet', 'Public pet'],
  'visitors see only available pets'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"staff"}}';

select results_eq(
  $$select name from public.pets where id = '10000000-0000-0000-0000-000000000002'$$,
  array['Pending pet'],
  'staff can read a non-public pet'
);

select lives_ok(
  $$update public.pets set status = 'Fostered', foster_available = false, medical_history = 'Vaccinations current.' where id = '10000000-0000-0000-0000-000000000002'$$,
  'staff can mark a pet fostered and record its medical history'
);

select throws_ok(
  $$update public.pets set status = 'Missing' where id = '10000000-0000-0000-0000-000000000002'$$,
  '23514', null,
  'an unknown pet status is rejected by the database'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"viewer"}}';

select results_eq(
  $$select name from public.pets where id = '10000000-0000-0000-0000-000000000002'$$,
  array[]::text[],
  'an unrecognized role claim has no administrative access'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('pet-images', 'rls-test/admin.jpg')$$,
  'admin can upload a pet image'
);

set local role postgres;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('pet-images', 'rls-test/member.jpg')$$,
  '42501',
  null,
  'ordinary users cannot upload a pet image'
);

select * from finish();
rollback;
