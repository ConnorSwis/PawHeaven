import { SHELTER } from '@pawheaven/contracts/site';

/** "6 years 10 months", "1 year", "8 weeks", "Puppy" → age in years, or null when it cannot be read. */
export function ageInYears(age: string): number | null {
  const text = age.toLowerCase();
  let years = 0;
  let found = false;
  for (const [, amount, unit] of text.matchAll(/(\d+(?:\.\d+)?)\s*(year|yr|y|month|mo|week|wk|day)/g)) {
    found = true;
    const value = Number(amount);
    if (unit.startsWith('y')) years += value;
    else if (unit.startsWith('mo')) years += value / 12;
    else if (unit.startsWith('w')) years += value / 52;
    else years += value / 365;
  }
  if (found) return years;
  if (/puppy|kitten|baby/.test(text)) return 0.5;
  if (/senior/.test(text)) return SHELTER.fees.seniorAge;
  return null;
}

export type AgeBand = 'baby' | 'young' | 'adult' | 'senior';
export const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: 'baby', label: 'Baby (under 1 year)' },
  { value: 'young', label: 'Young (1 to 2 years)' },
  { value: 'adult', label: `Adult (3 to ${SHELTER.fees.seniorAge - 1} years)` },
  { value: 'senior', label: `Senior (${SHELTER.fees.seniorAge} and older)` },
];

export function ageBand(age: string): AgeBand | null {
  const years = ageInYears(age);
  if (years === null) return null;
  if (years < 1) return 'baby';
  if (years < 3) return 'young';
  if (years < SHELTER.fees.seniorAge) return 'adult';
  return 'senior';
}

export const isSenior = (age: string) => ageBand(age) === 'senior';
