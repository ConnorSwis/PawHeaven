import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPetSearch } from '../packages/contracts/src/index.ts';
import { canStartApplication, hasPetImage, publicPets } from '../apps/web/src/lib/pet-discovery.ts';

const pets = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Ziggy', type: 'Dog', breed: 'Mastiff mix', age: '5 years',
    intakeDate: '2026-01-01', daysInShelter: 42, tags: ['big-dog'], status: 'Available',
    summary: 'A calm companion with a very long description that should be retained unchanged when the directory renders a public listing.', imageUrl: null,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Ada', type: 'Dog', breed: 'Terrier', age: '2 years',
    intakeDate: '2026-02-01', daysInShelter: 11, tags: ['active'], status: 'Available', summary: 'Energetic and affectionate.', imageUrl: 'https://example.test/ada.jpg',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Pending pup', type: 'Dog', breed: 'Mixed', age: '3 years',
    intakeDate: '2026-03-01', daysInShelter: 5, tags: ['big-dog'], status: 'Pending', summary: 'Not publicly available.', imageUrl: null,
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Adopted cat', type: 'Cat', breed: 'Domestic shorthair', age: '1 year',
    intakeDate: '2026-03-02', daysInShelter: 4, tags: [], status: 'Adopted', summary: 'Already adopted.', imageUrl: null,
  },
];

test('discovery QA: a big dog tag search finds available matching pets', () => {
  const results = publicPets(pets).filter((pet) => matchesPetSearch(pet, 'big dog') && pet.tags.includes('big-dog'));
  assert.deepEqual(results.map((pet) => pet.name), ['Ziggy']);
});

test('discovery QA: an unmatched query produces an empty result set', () => {
  assert.deepEqual(publicPets(pets).filter((pet) => matchesPetSearch(pet, 'iguana')).map((pet) => pet.name), []);
});

test('discovery QA: long descriptions are retained and missing images are safe', () => {
  const [ada, ziggy] = publicPets(pets);
  assert.equal(ziggy.summary, pets[0].summary);
  assert.equal(hasPetImage(ziggy), false);
  assert.equal(hasPetImage(ada), true);
});

test('discovery QA: non-available pets stay hidden and cannot begin an application', () => {
  assert.deepEqual(publicPets(pets).map((pet) => pet.name), ['Ada', 'Ziggy']);
  assert.equal(canStartApplication(pets[0], false), true);
  assert.equal(canStartApplication(pets[2], false), false);
  assert.equal(canStartApplication(pets[0], true), false);
});
