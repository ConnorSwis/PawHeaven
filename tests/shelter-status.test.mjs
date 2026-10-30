import assert from 'node:assert/strict';
import test from 'node:test';
import { capacityInput, petHelpInput } from '../apps/api/src/lib/shelter.ts';

const pet = '1b7e3c1a-2f10-4a8e-8d1e-0a4d5c9e7b21';

test('capacity: whole kennel counts from 0 to 500, with held-back no greater than the total', () => {
  assert.deepEqual(capacityInput({ kennels: 19, heldBack: 2 }).value, { kennels: 19, heldBack: 2 });
  assert.deepEqual(capacityInput({ kennels: 0, heldBack: 0 }).value, { kennels: 0, heldBack: 0 });
  assert.ok(capacityInput({ kennels: 5, heldBack: 6 }).message);
  assert.ok(capacityInput({ kennels: 501, heldBack: 0 }).message);
  assert.ok(capacityInput({ kennels: 4.5, heldBack: 0 }).message);
  assert.ok(capacityInput({ kennels: '12', heldBack: 0 }).message);
  assert.ok(capacityInput({ kennels: 12 }).message);
  assert.ok(capacityInput(null).message);
});

test('needs-help flag: one to 200 pets and a reason from the list, or an empty reason to clear', () => {
  assert.deepEqual(petHelpInput({ petIds: [pet, pet], reason: 'foster' }).value, { petIds: [pet], reason: 'foster' });
  assert.deepEqual(petHelpInput({ petIds: [pet], reason: '' }).value, { petIds: [pet], reason: '' });
  for (const reason of ['home_soon', 'foster', 'long_stay', 'medical']) assert.equal(petHelpInput({ petIds: [pet], reason }).value.reason, reason);
  assert.ok(petHelpInput({ petIds: [pet], reason: 'sad' }).message);
  assert.ok(petHelpInput({ petIds: [pet] }).message);
  assert.ok(petHelpInput({ petIds: [], reason: 'foster' }).message);
  assert.ok(petHelpInput({ petIds: ['not-a-uuid'], reason: 'foster' }).message);
  assert.ok(petHelpInput({ petIds: Array.from({ length: 201 }, (_, i) => `1b7e3c1a-2f10-4a8e-8d1e-${String(i).padStart(12, '0')}`), reason: 'foster' }).message);
});
