begin;
select plan(28);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ai-member@example.com', '', now(), '{}', '{"name":"AI member"}', now(), now()),
  ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-ai-member@example.com', '', now(), '{}', '{"name":"Other AI member"}', now(), now()),
  ('91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ai-staff@example.com', '', now(), '{"role":"staff"}', '{"name":"AI staff"}', now(), now());

insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, image_path)
values
  ('92000000-0000-0000-0000-000000000001', 'Test Dog A', 'Dog', 'Mixed', '2 years', current_date - 3, '{}', 'Available', 'Available dog with a photo.', 'pets/a.jpg'),
  ('92000000-0000-0000-0000-000000000002', 'Test Dog B', 'Dog', 'Mixed', '3 years', current_date - 4, '{}', 'Fostered', 'Fostered dog with a photo.', 'pets/b.jpg'),
  ('92000000-0000-0000-0000-000000000003', 'Test Dog C', 'Dog', 'Mixed', '4 years', current_date - 5, '{}', 'Adopted', 'Adopted dog with a photo.', 'pets/c.jpg'),
  ('92000000-0000-0000-0000-000000000004', 'Test Dog D', 'Dog', 'Mixed', '5 years', current_date - 6, '{}', 'Available', 'Available dog without a photo.', null),
  ('92000000-0000-0000-0000-000000000005', 'Test Cat E', 'Cat', 'Mixed', '1 year', current_date - 7, '{}', 'Available', 'Available cat with a photo.', 'pets/e.jpg'),
  ('92000000-0000-0000-0000-000000000006', 'Test Rabbit F', 'Rabbit', 'Mixed', '1 year', current_date - 8, '{}', 'Unavailable', 'Rabbit with a photo.', 'pets/f.jpg');

set local role anon;
select throws_ok(
  $$select count(*) from public.quiz_responses$$,
  '42501', null,
  'an anonymous visitor cannot read quiz responses'
);
select throws_ok(
  $$select public.lost_pet_candidates('Dog')$$,
  '42501', null,
  'an anonymous visitor cannot list lost-pet candidates'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001","email":"ai-member@example.com","app_metadata":{},"user_metadata":{"name":"AI member"}}';

select lives_ok(
  $$insert into public.quiz_responses (user_id, answers, recommendations)
    values ('91000000-0000-0000-0000-000000000001', '{"livingSpace":"apartment"}', '[]')$$,
  'a member can save their own quiz response'
);
select throws_ok(
  $$insert into public.quiz_responses (user_id, answers, recommendations)
    values ('91000000-0000-0000-0000-000000000002', '{"livingSpace":"apartment"}', '[]')$$,
  '42501', null,
  'a member cannot save a quiz response for someone else'
);
select throws_ok(
  $$insert into public.quiz_responses (user_id, answers) values ('91000000-0000-0000-0000-000000000001', '[]')$$,
  '23514', null,
  'quiz answers must be a JSON object'
);

-- Candidates exclude Adopted animals, animals without photos, and other species.
select results_eq(
  $$select name from public.lost_pet_candidates('Dog') where id::text like '92000000-%' order by name$$,
  array['Test Dog A', 'Test Dog B'],
  'dog candidates include Available and Fostered animals with photos only'
);
select results_eq(
  $$select name from public.lost_pet_candidates('Cat') where id::text like '92000000-%'$$,
  array['Test Cat E'],
  'cat candidates are limited to cats'
);
select results_eq(
  $$select name from public.lost_pet_candidates('Other') where id::text like '92000000-%'$$,
  array['Test Rabbit F'],
  'other-species candidates exclude dogs and cats, including non-public statuses'
);
select throws_ok(
  $$select public.lost_pet_candidates('Dragon')$$,
  '22023', null,
  'an unknown species is rejected'
);
select results_eq(
  $$select count(*)::integer from public.pets where id = '92000000-0000-0000-0000-000000000002'$$,
  array[0],
  'candidates do not widen direct access to non-public pet rows'
);

-- Private upload bucket policies.
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('lost-pet-uploads', '91000000-0000-0000-0000-000000000001/photo-1.jpg', '91000000-0000-0000-0000-000000000001')$$,
  'a member can upload into their own folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('lost-pet-uploads', '91000000-0000-0000-0000-000000000002/photo-1.jpg', '91000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'a member cannot upload into another member folder'
);

select lives_ok(
  $$insert into public.lost_pet_searches (member_id, species, description, photo_paths, result)
    values ('91000000-0000-0000-0000-000000000001', 'Dog', 'Brown with a white chest', array['91000000-0000-0000-0000-000000000001/photo-1.jpg'],
      '[{"petId":"92000000-0000-0000-0000-000000000001","confidence":80,"reason":"Similar coat"},{"petId":"92000000-0000-0000-0000-000000000002","confidence":50,"reason":"Similar size"}]')$$,
  'a member can record their own lost-pet search'
);
select throws_ok(
  $$insert into public.lost_pet_searches (member_id, species, photo_paths)
    values ('91000000-0000-0000-0000-000000000001', 'Dog', array['91000000-0000-0000-0000-000000000002/photo-1.jpg'])$$,
  '42501', null,
  'a search cannot reference another member photo folder'
);
select throws_ok(
  $$insert into public.lost_pet_searches (member_id, species, photo_paths, expires_at)
    values ('91000000-0000-0000-0000-000000000001', 'Dog', array['91000000-0000-0000-0000-000000000001/photo-2.jpg'], now() + interval '5 years')$$,
  '42501', null,
  'a member cannot choose their own retention period'
);
select throws_ok(
  $$insert into public.lost_pet_searches (member_id, species, photo_paths)
    values ('91000000-0000-0000-0000-000000000001', 'Dog', array['91000000-0000-0000-0000-000000000001/a.jpg','91000000-0000-0000-0000-000000000001/b.jpg','91000000-0000-0000-0000-000000000001/c.jpg','91000000-0000-0000-0000-000000000001/d.jpg'])$$,
  '23514', null,
  'a search cannot keep more than three photos'
);

select lives_ok(
  $$select public.submit_lost_pet_inquiry((select id from public.lost_pet_searches), '92000000-0000-0000-0000-000000000001', '404-555-0142', 'I think this is my dog, she went missing last Friday.')$$,
  'a member can contact the shelter about a possible match'
);
select throws_ok(
  $$select public.submit_lost_pet_inquiry((select id from public.lost_pet_searches), '92000000-0000-0000-0000-000000000001', '404-555-0142', 'Sending the same inquiry a second time.')$$,
  '23505', null,
  'a member cannot send two inquiries about the same animal from one search'
);
select throws_ok(
  $$select public.submit_lost_pet_inquiry((select id from public.lost_pet_searches), '92000000-0000-0000-0000-000000000005', '404-555-0142', 'This cat was not among the possible matches.')$$,
  'P0001', 'That animal was not one of the possible matches for this search.',
  'an inquiry must name an animal the search returned'
);
select throws_ok(
  $$select public.submit_lost_pet_inquiry((select id from public.lost_pet_searches), '92000000-0000-0000-0000-000000000002', '404-555-0142', 'short')$$,
  '22023', null,
  'a too-short inquiry message is rejected'
);
select throws_ok(
  $$insert into public.lost_pet_inquiries (search_id, member_id, member_name, member_email, member_phone, pet_id, pet_name, message)
    values ((select id from public.lost_pet_searches), '91000000-0000-0000-0000-000000000001', 'AI member', 'ai-member@example.com', '404-555-0142', '92000000-0000-0000-0000-000000000002', 'Test Dog B', 'Bypassing the inquiry function directly.')$$,
  '42501', null,
  'a member cannot write inquiries directly'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000002","email":"other-ai-member@example.com","app_metadata":{},"user_metadata":{"name":"Other AI member"}}';

select results_eq(
  $$select count(*)::integer from public.lost_pet_searches$$,
  array[0],
  'another member cannot read the search'
);
select throws_ok(
  $$select public.submit_lost_pet_inquiry('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', '404-555-0142', 'Using a search that does not belong to me.')$$,
  'P0001', null,
  'a member cannot inquire through a search that is not theirs'
);

-- An expired search cannot be used for new inquiries.
reset role;
insert into public.lost_pet_searches (id, member_id, species, photo_paths, result, expires_at)
values ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'Dog', array['91000000-0000-0000-0000-000000000002/old.jpg'],
  '[{"petId":"92000000-0000-0000-0000-000000000001","confidence":70,"reason":"Similar"}]', now() - interval '1 day');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000002","email":"other-ai-member@example.com","app_metadata":{},"user_metadata":{"name":"Other AI member"}}';
select throws_ok(
  $$select public.submit_lost_pet_inquiry('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '404-555-0142', 'Trying to use an expired search.')$$,
  'P0001', 'That search has expired. Search again with your photo.',
  'an expired search rejects new inquiries'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000003","email":"ai-staff@example.com","app_metadata":{"role":"staff"},"user_metadata":{"name":"AI staff"}}';

select results_eq(
  $$select count(*)::integer from public.lost_pet_inquiries where pet_id = '92000000-0000-0000-0000-000000000001'$$,
  array[1],
  'staff can read lost-pet inquiries'
);
select lives_ok(
  $$select public.update_lost_pet_inquiry((select id from public.lost_pet_inquiries where pet_id = '92000000-0000-0000-0000-000000000001'), 'In progress', 'Called the owner.')$$,
  'staff can update an inquiry'
);
select throws_ok(
  $$select public.update_lost_pet_inquiry((select id from public.lost_pet_inquiries where pet_id = '92000000-0000-0000-0000-000000000001'), 'Closed', '')$$,
  '22023', null,
  'staff cannot set an unknown inquiry status'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001","email":"ai-member@example.com","app_metadata":{},"user_metadata":{"name":"AI member"}}';
select throws_ok(
  $$select public.update_lost_pet_inquiry((select id from public.lost_pet_inquiries limit 1), 'Resolved', '')$$,
  '42501', null,
  'a member cannot update an inquiry'
);

select * from finish();
rollback;
