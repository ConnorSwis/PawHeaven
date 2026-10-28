begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profile-one@example.com', '', now(), '{}', '{"name":"Profile one"}', now(), now()),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profile-two@example.com', '', now(), '{}', '{"name":"Profile two"}', now(), now()),
  ('b2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profile-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"Profile staff"}', now(), now());

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary)
values ('b3000000-0000-0000-0000-000000000001', 'Default Pet', 'Dog', 'Mixed', '2 years', current_date - 3, '{}', 'Available', 'A pet with no recorded attributes.');

set local role anon;
select throws_ok(
  $$select count(*) from public.member_profiles$$,
  '42501', null,
  'an anonymous visitor cannot read profiles'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"b2000000-0000-0000-0000-000000000001","email":"profile-one@example.com","app_metadata":{},"user_metadata":{"name":"Profile one"}}';

select lives_ok(
  $$insert into public.member_profiles (user_id, phone, address, date_of_birth) values ('b2000000-0000-0000-0000-000000000001', '404-555-0142', '55 Park Place NE, Atlanta', date '1990-04-12')$$,
  'a member can create their own profile'
);
select throws_ok(
  $$insert into public.member_profiles (user_id, phone) values ('b2000000-0000-0000-0000-000000000002', '404-555-0199')$$,
  '42501', null,
  'a member cannot create a profile for someone else'
);
select throws_ok(
  $$insert into public.member_profiles (user_id, phone) values ('b2000000-0000-0000-0000-000000000001', '404-555-0111')$$,
  '23505', null,
  'a member has at most one profile'
);
select lives_ok(
  $$update public.member_profiles set phone = '404-555-0100', updated_at = now() where user_id = 'b2000000-0000-0000-0000-000000000001'$$,
  'a member can update their profile'
);
select lives_ok(
  $$insert into public.member_profiles (user_id, phone) values ('b2000000-0000-0000-0000-000000000001', '404-555-0123') on conflict (user_id) do update set user_id = excluded.user_id, phone = excluded.phone, updated_at = now()$$,
  'an upsert (how the API saves) updates the member''s own profile'
);
select throws_ok(
  $$update public.member_profiles set user_id = 'b2000000-0000-0000-0000-000000000002' where user_id = 'b2000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a member cannot hand their profile to another member'
);
select throws_ok(
  $$update public.member_profiles set phone = '12' where user_id = 'b2000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'an invalid phone number is rejected by the database'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"b2000000-0000-0000-0000-000000000002","email":"profile-two@example.com","app_metadata":{},"user_metadata":{"name":"Profile two"}}';
select results_eq(
  $$select count(*)::integer from public.member_profiles$$,
  array[0],
  'another member cannot read the profile'
);
select results_eq(
  $$with changed as (update public.member_profiles set phone = '404-555-0000' returning 1) select count(*)::integer from changed$$,
  array[0],
  'another member cannot update the profile'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"b2000000-0000-0000-0000-000000000003","email":"profile-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"Profile staff"}}';
select results_eq(
  $$select count(*)::integer from public.member_profiles$$,
  array[0],
  'even staff cannot read member profiles'
);

reset role;
select throws_ok(
  $$update public.pets set size = 'Gigantic' where id = 'b3000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a pet size outside the allowed list is rejected'
);
select is(
  (select spayed_neutered || '/' || good_with_kids || '/' || sex from public.pets where id = 'b3000000-0000-0000-0000-000000000001'),
  'Unknown/Unknown/',
  'existing pets default every new attribute to not recorded'
);

select * from finish();
rollback;
