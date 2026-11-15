import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_FLYER, callLine, fitSize, formatPhone, hasPetFacts, headlineText, longDate, tabLines, tips } from '../apps/web/src/app/lost/flyer-text.ts';

const flyer = (changes = {}) => ({ ...EMPTY_FLYER, ...changes });

test('flyer: an empty form still makes a sensible headline and needs nothing to print', () => {
  assert.equal(headlineText(EMPTY_FLYER), 'LOST PET');
  assert.equal(headlineText(flyer({ headline: 'Missing', kind: ' Guinea pig ' })), 'MISSING GUINEA PIG');
  assert.equal(hasPetFacts(EMPTY_FLYER), false);
  assert.equal(tabLines(EMPTY_FLYER), null);
  assert.equal(longDate(''), '');
});

test('flyer: phone numbers are tidied only when they are clearly US numbers', () => {
  assert.equal(formatPhone('4045550142'), '(404) 555-0142');
  assert.equal(formatPhone('1-404-555-0142'), '(404) 555-0142');
  assert.equal(formatPhone('404.555.0142'), '(404) 555-0142');
  assert.equal(formatPhone('+44 20 7946 0958'), '+44 20 7946 0958');
  assert.equal(formatPhone('555-0142'), '555-0142');
});

test('flyer: the big words shrink to stay on one line but never below the floor', () => {
  assert.equal(fitSize('LOST DOG', 44, 6.6, 2.6), 6.6);
  assert.ok(fitSize('MISSING GUINEA PIG', 44, 6.6, 2.6) < 4);
  assert.equal(fitSize('X'.repeat(80), 44, 6.6, 2.6), 2.6);
  assert.ok(fitSize('', 44, 6.6, 2.6) <= 6.6);
});

test('flyer: the call line and tear-off tabs use the name and the best way to reach the owner', () => {
  assert.equal(callLine(flyer({ petName: 'Biscuit', contactPhone: '4045550142' })), 'If you see Biscuit, please call');
  assert.equal(callLine(flyer({ contactEmail: 'a@b.co' })), 'If you have seen this pet, please email');
  assert.equal(callLine(EMPTY_FLYER), 'If you have seen this pet, please call');
  assert.deepEqual(tabLines(flyer({ petName: 'Biscuit', contactPhone: '4045550142' })), ['Biscuit', '(404) 555-0142']);
  assert.deepEqual(tabLines(flyer({ kind: 'Cat', contactEmail: 'a@b.co' })), ['Lost cat', 'a@b.co']);
});

test('flyer: dates read in full and tips only suggest, never demand', () => {
  assert.equal(longDate('2026-11-12', 'en-US'), 'Thursday, November 12, 2026');
  assert.equal(longDate('not a date'), '');
  assert.equal(tips(EMPTY_FLYER, false).length, 4);
  assert.deepEqual(tips(flyer({ contactPhone: '4045550142', lastSeenWhere: 'Maple St', appearance: 'Brown' }), true), []);
});
