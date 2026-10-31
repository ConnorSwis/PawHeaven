begin;
select plan(39);

-- Start from a database with no kennel counts set, as it is after the migration.
update public.shelter_capacity set kennels = 0, held_back = 0;

-- Only the pets made here count: everything already in the database is moved out of the kennels.
update public.pets set status = 'Adopted' where status in ('Available', 'Pending', 'Unavailable');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ss-admin@example.com', '', now(), '{"role":"admin"}', '{"name":"SS Admin"}', now(), now()),
  ('e5000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ss-member@example.com', '', now(), '{}', '{"name":"SS Member"}', now(), now());

-- Seven dogs in kennels (six Available, one Pending), one Available dog in a foster home, one adopted dog,
-- one available cat, and one rabbit. Dog 'Ss Long' has been here 120 days.
insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, housing)
select ('e6000000-0000-0000-0000-00000000010' || n)::uuid, 'Ss Dog ' || n, 'Dog', 'Mixed', '2 years', current_date - 5, '{}', 'Available', 'A dog in a kennel.', ''
from generate_series(1, 5) n;
insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, housing)
values
  ('e6000000-0000-0000-0000-000000000106', 'Ss Long', 'Dog', 'Mixed', '4 years', current_date - 120, '{}', 'Available', 'Has been here a long time.', ''),
  ('e6000000-0000-0000-0000-000000000107', 'Ss Pending', 'Dog', 'Mixed', '3 years', current_date - 9, '{}', 'Pending', 'Adoption in progress.', 'Shelter'),
  ('e6000000-0000-0000-0000-000000000108', 'Ss Fostered Dog', 'dog', 'Mixed', '1 year', current_date - 9, '{}', 'Available', 'Lives in a foster home.', 'Foster home'),
  ('e6000000-0000-0000-0000-000000000109', 'Ss Adopted', 'Dog', 'Mixed', '1 year', current_date - 30, '{}', 'Adopted', 'Went home.', ''),
  ('e6000000-0000-0000-0000-000000000201', 'Ss Cat', 'Cat', 'Mixed', '1 year', current_date - 4, '{}', 'Available', 'A cat.', ''),
  ('e6000000-0000-0000-0000-000000000301', 'Ss Rabbit', 'Rabbit', 'Mixed', '1 year', current_date - 4, '{}', 'Available', 'A rabbit.', '');

-- Guests ----------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select ok(has_function_privilege('anon', 'public.get_shelter_status()', 'execute'), 'guests can read the shelter status');
select throws_ok($$select public.set_shelter_capacity('Dog', 10, 0)$$, '42501', null, 'a guest cannot change capacity');
select throws_ok($$select public.set_pet_help(array['e6000000-0000-0000-0000-000000000101']::uuid[], 'foster')$$, '42501', null, 'a guest cannot flag a pet');
select is(public.get_shelter_status() -> 'groups' -> 0 ->> 'level', 'unset', 'a group with no kennels set reports unset');
select ok(public.get_shelter_status() -> 'groups' -> 0 -> 'percent' = 'null'::jsonb, 'an unset group has no percent');

-- Members ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e5000000-0000-0000-0000-000000000002","email":"ss-member@example.com","app_metadata":{},"user_metadata":{"name":"SS Member"}}';

select throws_ok($$select public.set_shelter_capacity('Dog', 10, 0)$$, '42501', null, 'a member cannot change capacity');
select throws_ok($$select public.set_pet_help(array['e6000000-0000-0000-0000-000000000101']::uuid[], 'foster')$$, '42501', null, 'a member cannot flag a pet');
select throws_ok($$select public.staff_attention()$$, '42501', null, 'a member cannot read the attention report');
select results_eq($$select count(*)::integer from public.shelter_capacity$$, array[0], 'a member cannot read the capacity table');

-- Staff: capacity and levels ------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","sub":"e5000000-0000-0000-0000-000000000001","email":"ss-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"SS Admin"}}';

select results_eq($$select count(*)::integer from public.shelter_capacity$$, array[3], 'staff can read the capacity table');
select throws_ok($$select public.set_shelter_capacity('Bird', 10, 0)$$, '22023', null, 'capacity needs a known group');
select throws_ok($$select public.set_shelter_capacity('Dog', 501, 0)$$, '22023', null, 'capacity is limited to 500 kennels');
select throws_ok($$select public.set_shelter_capacity('Dog', 5, 6)$$, '22023', null, 'held-back kennels cannot exceed kennels');

select lives_ok($$select public.set_shelter_capacity('Dog', 10, 0)$$, 'staff can set dog capacity');
select is(
  (select g ->> 'used' from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), '7',
  'dogs in kennels are counted (foster-home and adopted dogs are not)'
);
select is(
  (select g ->> 'level' from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), 'ok',
  '7 of 10 kennels is ok'
);

select lives_ok($$select public.set_shelter_capacity('Dog', 8, 0)$$, 'setup: public.set_shelter_capacity(Dog, 8, 0)');
select is(
  (select g ->> 'level' || ':' || (g ->> 'percent') from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), 'busy:88',
  '7 of 8 kennels is busy at 88 percent'
);
select lives_ok($$select public.set_shelter_capacity('Dog', 7, 0)$$, 'setup: public.set_shelter_capacity(Dog, 7, 0)');
select is(
  (select g ->> 'level' from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), 'full',
  '7 of 7 kennels is full'
);
select lives_ok($$select public.set_shelter_capacity('Dog', 6, 0)$$, 'setup: public.set_shelter_capacity(Dog, 6, 0)');
select is(
  (select g ->> 'level' from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), 'over',
  '7 of 6 kennels is over capacity'
);
select lives_ok($$select public.set_shelter_capacity('Dog', 10, 3)$$, 'setup: public.set_shelter_capacity(Dog, 10, 3)');
select is(
  (select g ->> 'level' || ':' || (g ->> 'percent') from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Dog'), 'full:100',
  'held-back kennels reduce the usable total (7 of 7)'
);
select is(
  (select g ->> 'ready' from jsonb_array_elements(public.get_shelter_status() -> 'groups') g where g ->> 'group' = 'Other'), '1',
  'other species are grouped together'
);

-- Staff: needs-help flag ----------------------------------------------------------
select is(public.set_pet_help(array['e6000000-0000-0000-0000-000000000101', 'e6000000-0000-0000-0000-000000000102']::uuid[], 'foster'), 2, 'staff can flag two pets');
select ok((select help_since is not null and help_reason = 'foster' from public.pets where id = 'e6000000-0000-0000-0000-000000000101'), 'a flagged pet gets a flag date');
select lives_ok($$select pg_sleep(0.05)$$, 'time passes');
select lives_ok($$select public.set_pet_help(array['e6000000-0000-0000-0000-000000000101']::uuid[], 'medical')$$, 'setup: public.set_pet_help(array[e6000000-0000-0000-0000-');
select ok(
  (select help_reason = 'medical' and help_since = (select help_since from public.pets where id = 'e6000000-0000-0000-0000-000000000102') from public.pets where id = 'e6000000-0000-0000-0000-000000000101'),
  'changing the reason keeps the original flag date'
);
select is(public.set_pet_help(array['e6000000-0000-0000-0000-000000000109']::uuid[], 'medical'), 0, 'an adopted pet cannot be flagged');
select throws_ok($$select public.set_pet_help(array['e6000000-0000-0000-0000-000000000101']::uuid[], 'sad')$$, '22023', null, 'the reason must be on the list');
select is((public.get_shelter_status() ->> 'needHelp')::integer, 2, 'the status counts animals who need help');
update public.pets set status = 'Adopted' where id = 'e6000000-0000-0000-0000-000000000102';
select is((select help_reason from public.pets where id = 'e6000000-0000-0000-0000-000000000102'), '', 'adopting a pet clears its flag');
select lives_ok($$select public.set_pet_help(array['e6000000-0000-0000-0000-000000000101']::uuid[], '')$$, 'setup: public.set_pet_help(array[e6000000-0000-0000-0000-');
select ok((select help_since is null from public.pets where id = 'e6000000-0000-0000-0000-000000000101'), 'clearing the flag clears its date');

-- Attention report ----------------------------------------------------------------
select lives_ok($$select public.set_shelter_capacity('Dog', 6, 0)$$, 'setup: six kennels for six dogs');
select ok(exists (select 1 from jsonb_array_elements(public.staff_attention()) i where i ->> 'kind' = 'capacity_high' and i ->> 'title' like 'Dog kennels are%'), 'the attention report warns when kennels are nearly full');
select ok(exists (select 1 from jsonb_array_elements(public.staff_attention()) i where i ->> 'kind' = 'long_stay_help' and i -> 'petIds' ? 'e6000000-0000-0000-0000-000000000106'), 'the attention report suggests flagging a long-stay pet');

select * from finish();
rollback;
