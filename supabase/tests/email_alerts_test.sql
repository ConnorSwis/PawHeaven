begin;
select plan(76);

-- Start from empty alert tables so a seeded database cannot change the counts below.
delete from public.notification_outbox;
delete from public.saved_searches;
delete from public.saved_pets;
delete from public.member_email_prefs;
delete from public.email_subscribers;
delete from public.newsletters;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ea-admin@example.com', '', now(), '{"role":"admin"}', '{"name":"EA Admin"}', now(), now()),
  ('e7000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ea-one@example.com', '', now(), '{}', '{"name":"EA One"}', now(), now()),
  ('e7000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ea-two@example.com', '', now(), '{}', '{"name":"EA Two"}', now(), now());

-- Helpers ----------------------------------------------------------------------
select is(public.age_band('8 weeks'), 'baby', 'eight weeks is a baby');
select is(public.age_band('2 years'), 'young', 'two years is young');
select is(public.age_band('6 years 10 months'), 'adult', 'six years ten months is still an adult');
select is(public.age_band('7 years'), 'senior', 'seven years is a senior');
select is(public.age_band('Puppy'), 'baby', 'a puppy is a baby');
select is(public.age_band('mystery'), null, 'an unreadable age has no band');
select is(extract(hour from timezone('America/New_York', public.next_digest_time()))::integer, 8, 'digests go out at 8 am shelter time');
select ok(public.next_digest_time() > now(), 'the next digest time is in the future');

-- Matching -----------------------------------------------------------------------
insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, size, sex, energy_level, good_with_kids, good_with_dogs, foster_available)
values ('e8000000-0000-0000-0000-000000000001', 'Ea Probe', 'Dog', 'Mixed', '2 years', current_date - 3, '{}', 'Pending', 'A dog used to test matching.', 'Extra large', 'Female', 'High', 'Yes', 'No', true);
select ok((select public.pet_matches_search(p, '{}'::jsonb) from public.pets p where id = 'e8000000-0000-0000-0000-000000000001'), 'empty filters match everything');
select ok((select public.pet_matches_search(p, '{"species":"dog","size":"extra-large","age":"young","sex":"female","energy":"high","kids":"true","foster":"true"}'::jsonb) from public.pets p where id = 'e8000000-0000-0000-0000-000000000001'), 'all the filters can match together');
select ok(not (select public.pet_matches_search(p, '{"dogs":"true"}'::jsonb) from public.pets p where id = 'e8000000-0000-0000-0000-000000000001'), 'good-with-dogs needs a Yes');
select ok(not (select public.pet_matches_search(p, '{"species":"cat"}'::jsonb) from public.pets p where id = 'e8000000-0000-0000-0000-000000000001'), 'a dog does not match a cat search');
select ok(not (select public.pet_matches_search(p, '{"age":"senior"}'::jsonb) from public.pets p where id = 'e8000000-0000-0000-0000-000000000001'), 'a young dog does not match a senior search');

-- Members: saved searches and animals -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000002","email":"ea-one@example.com","app_metadata":{},"user_metadata":{"name":"EA One"}}';

select throws_ok($$select * from public.notification_outbox$$, '42501', null, 'a member cannot read the outbox');
select throws_ok($$select * from public.claim_notifications(10)$$, '42501', null, 'a member cannot claim notifications');
select throws_ok($$select public.subscribe_newsletter('x@example.com')$$, '42501', null, 'a member cannot call the guest subscribe function');
select throws_ok($$select public.queue_newsletter('e9000000-0000-0000-0000-000000000001')$$, '42501', null, 'a member cannot send a newsletter');
select throws_ok($$select public.outreach_summary()$$, '42501', null, 'a member cannot read the outreach summary');

select is(public.get_my_email_prefs() ->> 'matchDigest', 'true', 'digest defaults to on');
select is(public.get_my_email_prefs() ->> 'newsletter', 'false', 'newsletter defaults to off');
select is(public.merge_saved_pets(array['e8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-0000000000ff']::uuid[]) , '["e8000000-0000-0000-0000-000000000001"]'::jsonb, 'saving ignores animals that do not exist');
select is(public.unsave_pet('e8000000-0000-0000-0000-000000000001'), '[]'::jsonb, 'a member can unsave an animal');
select lives_ok($$select public.merge_saved_pets(array['e8000000-0000-0000-0000-000000000001']::uuid[])$$, 'and save it again');
select is(jsonb_array_length(public.create_saved_search('Big dogs', '{"species":"dog","kids":"true"}'::jsonb)), 1, 'a member can save a search');
select is(jsonb_array_length(public.create_saved_search('Big dogs again', '{"species":"dog","kids":"true"}'::jsonb)), 1, 'the same filters are not saved twice');
select lives_ok($$select public.create_saved_search('Cats', '{"species":"cat"}'::jsonb)$$, 'a second search can be saved');

set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000003","email":"ea-two@example.com","app_metadata":{},"user_metadata":{"name":"EA Two"}}';
select is(public.list_saved_pets(), '[]'::jsonb, 'another member does not see those saved animals');
select is(public.list_my_searches(), '[]'::jsonb, 'or those searches');
select is(jsonb_array_length(public.create_saved_search('Seniors', '{"age":"senior"}'::jsonb)), 1, 'the second member saves a search');
select lives_ok($$select public.merge_saved_pets(array['e8000000-0000-0000-0000-000000000001']::uuid[])$$, 'the second member also saves the animal');
select lives_ok($$select public.set_my_email_prefs(null, false, null)$$, 'the second member turns off saved-animal emails');

-- Alerts ---------------------------------------------------------------------------
reset role;
insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, size, good_with_kids)
values
  ('e8000000-0000-0000-0000-000000000002', 'Ea Match', 'Dog', 'Mixed', '4 years', current_date, '{}', 'Available', 'A dog who fits the first search.', 'Large', 'Yes'),
  ('e8000000-0000-0000-0000-000000000003', 'Ea Miss', 'Dog', 'Mixed', '4 years', current_date, '{}', 'Available', 'A dog who does not fit any search.', 'Large', 'No'),
  ('e8000000-0000-0000-0000-000000000004', 'Ea Old', 'Cat', 'Mixed', '9 years', current_date, '{}', 'Pending', 'A senior cat not yet available.', 'Small', 'Unknown');
select is((select count(*)::integer from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000002'), 1, 'a new matching animal queues one digest row');
select is((select member_id from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000002'), 'e7000000-0000-0000-0000-000000000002'::uuid, 'for the member whose search matches');
select is((select count(*)::integer from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000003'), 0, 'an animal that fits no search queues nothing');
select ok((select send_after = public.next_digest_time() from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000002'), 'the digest is held for 8 am');
update public.pets set status = 'Available' where id = 'e8000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000004' and member_id = 'e7000000-0000-0000-0000-000000000003'), 1, 'an animal that becomes available matches the second member');
update public.pets set status = 'Pending' where id = 'e8000000-0000-0000-0000-000000000002';
update public.pets set status = 'Available' where id = 'e8000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.notification_outbox where kind = 'match' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000002'), 1, 'going back to available does not queue a second alert');
update public.pets set status = 'Adopted' where id = 'e8000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.notification_outbox where kind = 'saved_change' and member_id = 'e7000000-0000-0000-0000-000000000002'), 1, 'a saved animal changing status queues one message for the saver');
select is((select count(*)::integer from public.notification_outbox where kind = 'saved_change' and member_id = 'e7000000-0000-0000-0000-000000000003'), 0, 'but not for a member who turned those emails off');
update public.pets set status = 'Unavailable' where id = 'e8000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.notification_outbox where kind = 'saved_change' and payload ->> 'petId' = 'e8000000-0000-0000-0000-000000000003'), 0, 'internal statuses are never announced');

-- Preferences and the newsletter ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000002","email":"ea-one@example.com","app_metadata":{},"user_metadata":{"name":"EA One"}}';
select is(public.set_my_email_prefs(null, null, true) ->> 'newsletter', 'true', 'a member can join the newsletter');
reset role;
select is((select status from public.email_subscribers where lower(email) = 'ea-one@example.com'), 'confirmed', 'without a confirmation email, because the account email is verified');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000002","email":"ea-one@example.com","app_metadata":{},"user_metadata":{"name":"EA One"}}';
select is(public.set_my_email_prefs(false, null, null) ->> 'matchDigest', 'false', 'a member can turn the digest off');
reset role;
select is((select count(*)::integer from public.notification_outbox where kind = 'match' and member_id = 'e7000000-0000-0000-0000-000000000002' and sent_at is null), 0, 'which removes queued digest rows');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000002","email":"ea-one@example.com","app_metadata":{},"user_metadata":{"name":"EA One"}}';
select is(public.set_my_email_prefs(null, null, false) ->> 'newsletter', 'false', 'and leave the newsletter');

-- Guests through the API (service role) -----------------------------------------------------
reset role;
set local role service_role;
select is(public.subscribe_newsletter('Guest@Example.com') ->> 'status', 'pending', 'a guest subscription waits for confirmation');
select throws_ok($$select public.subscribe_newsletter('not an email')$$, '22023', null, 'a bad address is rejected');
select is(public.confirm_newsletter('no-such-token'), false, 'an unknown confirmation link does nothing');
select is(public.confirm_newsletter((select token from public.email_subscribers where lower(email) = 'guest@example.com')), true, 'the confirmation link confirms');
select is(public.subscribe_newsletter('cool@example.com') ->> 'token' is not null, true, 'a first subscription gets a confirmation token');
select is(public.subscribe_newsletter('cool@example.com') ->> 'token', null, 'asking again straight away sends no second confirmation');
select is(public.subscribe_newsletter('guest@example.com') ->> 'status', 'confirmed', 'subscribing again reports confirmed without a new link');
select lives_ok($$select public.subscribe_newsletter('second@example.com')$$, 'a second guest subscribes');
select lives_ok($$select public.confirm_newsletter((select token from public.email_subscribers where lower(email) = 'second@example.com'))$$, 'and confirms');
select lives_ok($$select public.unsubscribe_email('ea-two@example.com', 'alerts')$$, 'an alerts unsubscribe works by email address');
select is((select match_digest::text || saved_changes::text from public.member_email_prefs where member_id = 'e7000000-0000-0000-0000-000000000003'), 'falsefalse', 'and turns both alert choices off');
select is((select count(*)::integer from public.notification_outbox where member_id = 'e7000000-0000-0000-0000-000000000003' and kind = 'match' and sent_at is null), 0, 'and drops that member''s queued alerts');
select lives_ok($$select public.unsubscribe_email('second@example.com', 'newsletter')$$, 'a newsletter unsubscribe works');
select is((select status from public.email_subscribers where lower(email) = 'second@example.com'), 'unsubscribed', 'and marks the subscriber unsubscribed');
select throws_ok($$select public.unsubscribe_email('guest@example.com', 'everything')$$, '22023', null, 'the unsubscribe scope must be known');

-- Newsletter issues ---------------------------------------------------------------------------
reset role;
insert into public.newsletters (id, subject, body, blocks, created_by) values ('e9000000-0000-0000-0000-000000000001', 'Ea issue', 'Hello friends.', '{help,events}', 'e7000000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000001","email":"ea-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"EA Admin"}}';
select is(public.queue_newsletter('e9000000-0000-0000-0000-000000000001'), 1, 'staff queue a newsletter for the one confirmed subscriber');
select is((select status from public.newsletters where id = 'e9000000-0000-0000-0000-000000000001'), 'sending', 'which locks the issue');
select throws_ok($$select public.queue_newsletter('e9000000-0000-0000-0000-000000000001')$$, '22023', null, 'a sent issue cannot be queued again');
select is((public.outreach_summary() -> 'subscribers' ->> 'confirmed')::integer, 1, 'the summary counts confirmed subscribers');
select ok((public.outreach_summary() -> 'outbox' ->> 'queued')::integer >= 1, 'and queued messages');

reset role;
set local role service_role;
select is((select count(*)::integer from public.claim_notifications(50)), 1, 'the job claims the due message');
select is((select count(*)::integer from public.claim_notifications(50)), 0, 'and does not claim it twice');
select lives_ok($$select public.finish_notifications(array(select id from public.notification_outbox where kind = 'newsletter'))$$, 'the job marks it sent');
select is((select status from public.newsletters where id = 'e9000000-0000-0000-0000-000000000001'), 'sent', 'the issue becomes sent once nothing is left to deliver');

-- Failures show up for staff ------------------------------------------------------------------------
reset role;
update public.notification_outbox set attempts = 3, sent_at = null where kind = 'newsletter';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e7000000-0000-0000-0000-000000000001","email":"ea-admin@example.com","app_metadata":{"role":"admin"},"user_metadata":{"name":"EA Admin"}}';
select ok(exists (select 1 from jsonb_array_elements(public.staff_attention()) i where i ->> 'kind' = 'emails_failing'), 'the attention report flags email that could not be sent');
select lives_ok($$select public.remove_subscriber((select id from public.email_subscribers where lower(email) = 'guest@example.com'))$$, 'staff can remove a subscriber');
select is((select count(*)::integer from public.email_subscribers where status = 'confirmed' and lower(email) = 'guest@example.com'), 0, 'who is then unsubscribed');
select is((select count(*)::integer from public.email_subscribers), 4, 'staff can read the subscriber list');

-- Guests ------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.subscribe_newsletter('x@example.com')$$, '42501', null, 'a guest cannot call subscribe directly');
select throws_ok($$select * from public.email_subscribers$$, '42501', null, 'a guest cannot read subscribers');
select throws_ok($$select public.unsubscribe_email('guest@example.com', 'all')$$, '42501', null, 'a guest cannot unsubscribe someone else directly');

select * from finish();
rollback;
