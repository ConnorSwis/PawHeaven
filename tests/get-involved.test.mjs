import assert from 'node:assert/strict';
import test from 'node:test';
import { bookVisitInput, publishVisitSlotInput } from '../apps/api/src/lib/visits.ts';
import { copyWeekInput, eventInput, exceptionInput, petFlagsInput, ruleInput, scheduleToIcs } from '../apps/api/src/lib/schedule.ts';

const slot = '3c6c0f0e-6a6a-4a77-9a0b-0d9d6f6e5a10';
const pet = '1b7e3c1a-2f10-4a8e-8d1e-0a4d5c9e7b21';
const future = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();

test('visit booking: party size defaults to one and pets are limited to five', () => {
  assert.deepEqual(bookVisitInput({ slotId: slot, purpose: 'Meet Arlo' }).value, { slotId: slot, purpose: 'Meet Arlo', partySize: 1, petIds: [] });
  assert.equal(bookVisitInput({ slotId: slot, purpose: 'x', partySize: 7 }).message, 'A visit can include 1 to 6 people.');
  assert.ok(bookVisitInput({ slotId: slot, purpose: 'x', petIds: Array.from({ length: 6 }, () => pet).concat(['b', 'c', 'd', 'e', 'f', 'g']) }).message);
  assert.deepEqual(bookVisitInput({ slotId: slot, purpose: 'x', petIds: [pet, pet] }).value.petIds, [pet]);
});

test('visit slots: capacity is one to fifty groups', () => {
  assert.equal(publishVisitSlotInput({ startsAt: future(24), endsAt: future(25) }).value.capacity, 1);
  assert.equal(publishVisitSlotInput({ startsAt: future(24), endsAt: future(25), capacity: 3 }).value.capacity, 3);
  assert.ok(publishVisitSlotInput({ startsAt: future(24), endsAt: future(25), capacity: 51 }).message);
});

test('open hours: a valid visit rule is accepted and a shift rule needs a title and duties', () => {
  const visit = ruleInput({ kind: 'visit', weekday: 2, startTime: '16:00', endTime: '19:00', capacity: 2, slotMinutes: 30 });
  assert.equal(visit.value.weeksAhead, 6);
  assert.equal(visit.value.active, true);
  const shift = ruleInput({ kind: 'shift', weekday: 6, startTime: '09:00', endTime: '12:00', capacity: 4 });
  assert.ok(shift.fieldErrors.title && shift.fieldErrors.description);
  assert.ok(ruleInput({ kind: 'visit', weekday: 8, startTime: '16:00', endTime: '15:00' }).fieldErrors.weekday);
  assert.ok(ruleInput({ kind: 'visit', weekday: 1, startTime: '16:00', endTime: '15:00' }).fieldErrors.endTime);
});

test('exceptions and copy week: dates must be YYYY-MM-DD', () => {
  assert.deepEqual(exceptionInput({ date: '2026-12-25', reason: ' Holiday ' }).value, { date: '2026-12-25', reason: 'Holiday' });
  assert.ok(exceptionInput({ date: 'tomorrow' }).message);
  assert.ok(copyWeekInput({ fromWeek: '2026-11-02' }).message);
  assert.deepEqual(copyWeekInput({ fromWeek: '2026-11-02', toWeek: '2026-11-09' }).value, { from: '2026-11-02', to: '2026-11-09' });
});

test('events: need visits or roles, a future window, and valid roles', () => {
  const base = { title: 'Open house', description: '', startsAt: future(48), endsAt: future(51), visitCapacity: 3, slotMinutes: 30, roles: [{ title: 'Greeter', capacity: 2 }], petIds: [pet] };
  assert.equal(eventInput(base).value.roles.length, 1);
  assert.ok(eventInput({ ...base, visitCapacity: 0, roles: [] }).fieldErrors.visitCapacity);
  assert.ok(eventInput({ ...base, startsAt: future(-5) }).fieldErrors.startsAt);
  assert.ok(eventInput({ ...base, roles: [{ title: '', capacity: 2 }] }).fieldErrors.roles);
  assert.ok(eventInput({ ...base, petIds: ['nope'] }).fieldErrors.petIds);
});

test('pet flags: at least one pet and one setting', () => {
  assert.deepEqual(petFlagsInput({ petIds: [pet], fosterAvailable: true }).value, { petIds: [pet], fosterAvailable: true, visitsOpen: undefined, needsWalkers: undefined });
  assert.ok(petFlagsInput({ petIds: [pet] }).message);
  assert.ok(petFlagsInput({ petIds: [], fosterAvailable: true }).message);
});

test('calendar export: timed entries, all-day fosters, escaping, and line folding', () => {
  const ics = scheduleToIcs([
    { kind: 'visit', id: 'v1', title: 'Shelter visit', detail: 'Meeting Arlo, Cleo; bring "treats"', startsAt: '2026-11-03T21:00:00.000Z', endsAt: '2026-11-03T21:30:00.000Z', allDay: false },
    { kind: 'foster', id: 'f1', title: 'Fostering Cleo', detail: 'x'.repeat(200), startsAt: '2026-11-05T05:00:00.000Z', endsAt: '2026-12-05T05:00:00.000Z', allDay: true },
  ], new Date('2026-11-01T12:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261103T210000Z/);
  assert.match(ics, /DESCRIPTION:Meeting Arlo\\, Cleo\; bring "treats"/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261105/);
  assert.match(ics, /DTEND;VALUE=DATE:20261205/);
  assert.ok(ics.split('\r\n').every((line) => line.length <= 75), 'lines are folded at 75 characters');
  assert.match(ics, /UID:visit-v1@pawheaven\.online/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
