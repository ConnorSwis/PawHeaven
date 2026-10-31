begin;
select plan(6);

-- Generated open hours in a seeded database can overlap the times below, so set them aside for this test.
update public.visit_slots set status = 'withdrawn' where status = 'published' and starts_at > now();

select has_function('public', 'get_public_availability', array[]::text[], 'the guest availability function exists');
select ok(has_function_privilege('anon', 'public.get_public_availability()', 'execute'), 'guests can read open availability');

insert into public.visit_slots (id, starts_at, ends_at, status, capacity)
values
  ('f1000000-0000-0000-0000-000000000001', now() + interval '3 days', now() + interval '3 days 30 minutes', 'published', 2),
  ('f1000000-0000-0000-0000-000000000002', now() + interval '4 days', now() + interval '4 days 30 minutes', 'withdrawn', 2);
insert into public.volunteer_shifts (id, title, description, requirements, min_age, starts_at, ends_at, capacity, status)
values ('f2000000-0000-0000-0000-000000000001', 'Guest list shift', 'Walk dogs.', 'Closed-toe shoes.', 16, now() + interval '3 days', now() + interval '3 days 2 hours', 3, 'published');

select ok(exists (select 1 from jsonb_array_elements(public.get_public_availability() -> 'visits') v where v ->> 'id' = 'f1000000-0000-0000-0000-000000000001' and (v ->> 'spotsLeft')::integer = 2), 'a published visit time appears with its id and places left');
select ok(not exists (select 1 from jsonb_array_elements(public.get_public_availability() -> 'visits') v where v ->> 'id' = 'f1000000-0000-0000-0000-000000000002'), 'a withdrawn visit time is hidden');
select ok(exists (select 1 from jsonb_array_elements(public.get_public_availability() -> 'shifts') v where v ->> 'id' = 'f2000000-0000-0000-0000-000000000001' and (v ->> 'minAge')::integer = 16 and v ->> 'description' = 'Walk dogs.'), 'a published shift appears with its duties and minimum age');
select ok(public.get_public_availability()::text !~ '@', 'no email addresses are exposed');

select * from finish();
rollback;
