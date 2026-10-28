import {
  ENERGY_LEVELS,
  PET_SEXES,
  PET_SIZES,
  PET_STATUSES,
  YES_NO_UNKNOWN,
  type FieldErrors,
  type Pet,
  type PetInput,
  type PetEnergyLevel,
  type PetSex,
  type PetSize,
  type PetStatus,
  type YesNoUnknown,
} from '@pawheaven/contracts';
import { supabase } from './supabase';

export type DatabasePet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_label: string;
  intake_date: string;
  tags: string[];
  status: PetStatus;
  summary: string;
  medical_history: string;
  foster_available: boolean;
  sex: PetSex;
  size: PetSize;
  color: string;
  weight_lbs: number | null;
  spayed_neutered: YesNoUnknown;
  good_with_kids: YesNoUnknown;
  good_with_dogs: YesNoUnknown;
  good_with_cats: YesNoUnknown;
  energy_level: PetEnergyLevel;
  image_path: string | null;
};

export function daysInShelter(date: string): number {
  const start = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - start) / 86_400_000));
}

export function petForClient(row: DatabasePet, env: Env): Pet {
  return {
    id: row.id,
    name: row.name,
    type: row.species,
    breed: row.breed,
    age: row.age_label,
    intakeDate: row.intake_date,
    daysInShelter: daysInShelter(row.intake_date),
    tags: row.tags,
    status: row.status,
    summary: row.summary,
    medicalHistory: row.medical_history ?? '',
    fosterAvailable: row.foster_available ?? false,
    sex: row.sex ?? '',
    size: row.size ?? '',
    color: row.color ?? '',
    weightLbs: row.weight_lbs ?? null,
    spayedNeutered: row.spayed_neutered ?? 'Unknown',
    goodWithKids: row.good_with_kids ?? 'Unknown',
    goodWithDogs: row.good_with_dogs ?? 'Unknown',
    goodWithCats: row.good_with_cats ?? 'Unknown',
    energyLevel: row.energy_level ?? '',
    imageUrl: row.image_path ? supabase(env).storage.from('pet-images').getPublicUrl(row.image_path).data.publicUrl : null,
  };
}

/** Validates a pet form and reports every field that needs correcting, not just the first. */
export function petInput(body: unknown): { value: PetInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? input[key].trim() : '';
  const name = text('name');
  const type = text('type');
  const breed = text('breed');
  const age = text('age');
  const intakeDate = text('intakeDate');
  const summary = text('summary');
  const medicalHistory = text('medicalHistory');
  const status = input?.status;
  const fosterAvailable = input?.fosterAvailable === true;
  const tags = Array.isArray(input?.tags)
    ? [...new Set(input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))]
    : [];
  const intakeTime = /^\d{4}-\d{2}-\d{2}$/.test(intakeDate) ? Date.parse(`${intakeDate}T00:00:00Z`) : Number.NaN;
  const errors: FieldErrors = {};
  const attributes: Partial<Pick<PetInput, 'sex' | 'size' | 'color' | 'weightLbs' | 'spayedNeutered' | 'goodWithKids' | 'goodWithDogs' | 'goodWithCats' | 'energyLevel'>> = {};
  /** An attribute that is absent is left alone; one that is present must be a listed value (or empty where "not recorded" is allowed). */
  const choice = <T extends string>(key: string, allowed: readonly T[], emptyAllowed: boolean, label: string): T | '' | undefined => {
    const raw = input?.[key];
    if (raw === undefined) return undefined;
    if (raw === '' && emptyAllowed) return '';
    if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) return raw as T;
    errors[key] = `Choose ${label} from the list.`;
    return undefined;
  };
  const assign = <K extends keyof typeof attributes>(key: K, value: (typeof attributes)[K]) => { if (value !== undefined) attributes[key] = value; };
  assign('sex', choice('sex', PET_SEXES, true, 'a sex'));
  assign('size', choice('size', PET_SIZES, true, 'a size'));
  assign('energyLevel', choice('energyLevel', ENERGY_LEVELS, true, 'an energy level'));
  assign('spayedNeutered', choice('spayedNeutered', YES_NO_UNKNOWN, false, 'Yes, No, or Unknown') as YesNoUnknown | undefined);
  assign('goodWithKids', choice('goodWithKids', YES_NO_UNKNOWN, false, 'Yes, No, or Unknown') as YesNoUnknown | undefined);
  assign('goodWithDogs', choice('goodWithDogs', YES_NO_UNKNOWN, false, 'Yes, No, or Unknown') as YesNoUnknown | undefined);
  assign('goodWithCats', choice('goodWithCats', YES_NO_UNKNOWN, false, 'Yes, No, or Unknown') as YesNoUnknown | undefined);
  if (input?.color !== undefined) {
    const color = typeof input.color === 'string' ? input.color.trim() : '';
    if (typeof input.color !== 'string' || color.length > 100) errors.color = 'Use 100 characters or fewer for the color.';
    else attributes.color = color;
  }
  if (input?.weightLbs !== undefined) {
    const weight = input.weightLbs;
    if (weight === null || weight === '') attributes.weightLbs = null;
    else if (typeof weight === 'number' && Number.isInteger(weight) && weight >= 1 && weight <= 400) attributes.weightLbs = weight;
    else errors.weightLbs = 'Enter a weight from 1 to 400 pounds, or leave it blank.';
  }

  if (!name) errors.name = 'Enter the pet’s name.';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer for the name.';
  if (!type) errors.type = 'Enter the species, such as Dog or Cat.';
  else if (type.length > 60) errors.type = 'Use 60 characters or fewer for the species.';
  if (!breed) errors.breed = 'Enter the breed, or “Mixed” if it is unknown.';
  else if (breed.length > 100) errors.breed = 'Use 100 characters or fewer for the breed.';
  if (!age) errors.age = 'Enter the pet’s age, such as “2 years”.';
  else if (age.length > 60) errors.age = 'Use 60 characters or fewer for the age.';
  if (!intakeDate) errors.intakeDate = 'Choose the intake date.';
  else if (!Number.isFinite(intakeTime) || new Date(intakeTime).toISOString().slice(0, 10) !== intakeDate || intakeDate > new Date().toISOString().slice(0, 10)) errors.intakeDate = 'Enter an intake date that is today or earlier.';
  if (!summary) errors.summary = 'Add a short description for adopters.';
  else if (summary.length > 2000) errors.summary = 'Use 2,000 characters or fewer for the description.';
  if (medicalHistory.length > 4000) errors.medicalHistory = 'Use 4,000 characters or fewer for the medical history.';
  if (tags.length > 20 || tags.some((tag) => tag.length > 40)) errors.tags = 'Use no more than 20 tags, with 40 characters each.';
  if (typeof status !== 'string' || !(PET_STATUSES as readonly string[]).includes(status)) errors.status = 'Choose a valid availability status.';

  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { name, type, breed, age, intakeDate, tags, status: status as PetStatus, summary, medicalHistory, fosterAvailable, ...attributes } };
}

export function petRow(input: PetInput) {
  return {
    name: input.name,
    species: input.type,
    breed: input.breed,
    age_label: input.age,
    intake_date: input.intakeDate,
    tags: input.tags,
    status: input.status,
    summary: input.summary,
    medical_history: input.medicalHistory,
    foster_available: input.fosterAvailable,
    // Only attributes the request carried are written, so an older client never wipes them.
    ...(input.sex !== undefined && { sex: input.sex }),
    ...(input.size !== undefined && { size: input.size }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.weightLbs !== undefined && { weight_lbs: input.weightLbs }),
    ...(input.spayedNeutered !== undefined && { spayed_neutered: input.spayedNeutered }),
    ...(input.goodWithKids !== undefined && { good_with_kids: input.goodWithKids }),
    ...(input.goodWithDogs !== undefined && { good_with_dogs: input.goodWithDogs }),
    ...(input.goodWithCats !== undefined && { good_with_cats: input.goodWithCats }),
    ...(input.energyLevel !== undefined && { energy_level: input.energyLevel }),
  };
}
