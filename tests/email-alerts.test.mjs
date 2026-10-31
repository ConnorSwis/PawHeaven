import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFilters, emailPrefsInput, filtersLabel, newsletterInput, petIdsInput, savedSearchInput } from '../apps/api/src/lib/outreach.ts';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../apps/api/src/lib/unsubscribe.ts';

const pet = '1b7e3c1a-2f10-4a8e-8d1e-0a4d5c9e7b21';
const env = { ADMIN_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key' };

test('saved searches keep only known filters with allowed values', () => {
  assert.deepEqual(cleanFilters({ species: 'dog', size: 'extra-large', kids: true, dogs: '1', cats: false, foster: 'true', sort: 'help', q: 'rex' }), { species: 'dog', size: 'extra-large', kids: true, dogs: true, foster: true });
  assert.equal(cleanFilters({ species: 'bird', size: 'huge' }), null);
  assert.equal(cleanFilters({}), null);
  assert.equal(cleanFilters(null), null);
});

test('a saved search needs a filter and gets a readable name', () => {
  assert.equal(savedSearchInput({ filters: {} }).message, 'Choose at least one filter to be alerted about.');
  assert.equal(savedSearchInput({ filters: { species: 'dog', size: 'large', kids: true } }).value.label, 'Dogs, large, good with kids');
  assert.equal(savedSearchInput({ label: '  My dogs  ', filters: { species: 'dog' } }).value.label, 'My dogs');
  assert.equal(filtersLabel({ age: 'senior', foster: true }), 'Senior, open to foster');
});

test('email choices: only listed booleans, at least one', () => {
  assert.deepEqual(emailPrefsInput({ matchDigest: false, newsletter: true, other: 1 }).value, { matchDigest: false, newsletter: true });
  assert.ok(emailPrefsInput({ matchDigest: 'no' }).message);
  assert.ok(emailPrefsInput({}).message);
});

test('saved animal ids: up to 100 valid ids, duplicates removed', () => {
  assert.deepEqual(petIdsInput({ petIds: [pet, pet] }).value, [pet]);
  assert.ok(petIdsInput({ petIds: ['x'] }).message);
  assert.ok(petIdsInput({ petIds: Array.from({ length: 101 }, () => pet) }).message);
  assert.ok(petIdsInput({}).message);
});

test('newsletter drafts need a subject and a message; unknown blocks are rejected', () => {
  assert.deepEqual(newsletterInput({ subject: ' Hello ', body: ' Hi all ', blocks: ['help', 'help', 'events'] }).value, { subject: 'Hello', body: 'Hi all', blocks: ['help', 'events'] });
  const empty = newsletterInput({ subject: '', body: '' }).fieldErrors;
  assert.ok(empty.subject && empty.body);
  assert.ok(newsletterInput({ subject: 'a', body: 'b', blocks: ['ads'] }).fieldErrors.blocks);
  assert.ok(newsletterInput({ subject: 'a'.repeat(151), body: 'b' }).fieldErrors.subject);
});

test('unsubscribe links are signed and cannot be altered', async () => {
  const token = await signUnsubscribeToken(env, 'Ada@Example.com', 'alerts');
  assert.deepEqual(await verifyUnsubscribeToken(env, token), { e: 'ada@example.com', s: 'alerts' });
  const [payload, signature] = token.split('.');
  const forged = `${Buffer.from(JSON.stringify({ e: 'eve@example.com', s: 'all' })).toString('base64url')}.${signature}`;
  assert.equal(await verifyUnsubscribeToken(env, forged), null);
  assert.equal(await verifyUnsubscribeToken(env, `${payload}.AAAA`), null);
  assert.equal(await verifyUnsubscribeToken(env, 'garbage'), null);
  assert.equal(await verifyUnsubscribeToken({ ADMIN_SUPABASE_SERVICE_ROLE_KEY: 'another-key' }, token), null);
  assert.equal(await signUnsubscribeToken({}, 'a@b.co', 'all'), null);
});
