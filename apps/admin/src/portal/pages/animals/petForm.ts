import type { Pet, PetFlagsInput, PetInput } from '@pawheaven/contracts';

/** The editable shape of a pet, kept as strings so inputs stay controlled. */
export type PetDraft = {
  name: string; status: Pet['status']; type: string; breed: string; age: string; intakeDate: string; tags: string; summary: string; medicalHistory: string;
  sex: Pet['sex']; size: Pet['size']; color: string; weight: string; energyLevel: Pet['energyLevel'];
  spayedNeutered: Pet['spayedNeutered']; goodWithKids: Pet['goodWithKids']; goodWithDogs: Pet['goodWithDogs']; goodWithCats: Pet['goodWithCats'];
  fosterAvailable: boolean; visitsOpen: boolean; needsWalkers: boolean;
};

export function emptyDraft(today: string): PetDraft {
  return {
    name: '', status: 'Available', type: '', breed: '', age: '', intakeDate: today, tags: '', summary: '', medicalHistory: '',
    sex: '', size: '', color: '', weight: '', energyLevel: '', spayedNeutered: 'Unknown', goodWithKids: 'Unknown', goodWithDogs: 'Unknown', goodWithCats: 'Unknown',
    fosterAvailable: false, visitsOpen: true, needsWalkers: false,
  };
}

export function draftFromPet(pet: Pet): PetDraft {
  return {
    name: pet.name, status: pet.status, type: pet.type, breed: pet.breed, age: pet.age, intakeDate: pet.intakeDate.slice(0, 10), tags: pet.tags.join(', '),
    summary: pet.summary, medicalHistory: pet.medicalHistory, sex: pet.sex, size: pet.size, color: pet.color, weight: pet.weightLbs === null ? '' : String(pet.weightLbs),
    energyLevel: pet.energyLevel, spayedNeutered: pet.spayedNeutered, goodWithKids: pet.goodWithKids, goodWithDogs: pet.goodWithDogs, goodWithCats: pet.goodWithCats,
    fosterAvailable: pet.fosterAvailable, visitsOpen: pet.visitsOpen !== false, needsWalkers: pet.needsWalkers,
  };
}

/** The body for POST and PUT /admin/pets. The server reports every field that needs correcting. */
export function inputFromDraft(draft: PetDraft): PetInput {
  const weight = draft.weight.trim();
  return {
    name: draft.name, type: draft.type, breed: draft.breed, age: draft.age, intakeDate: draft.intakeDate, status: draft.status, summary: draft.summary,
    medicalHistory: draft.medicalHistory, fosterAvailable: draft.fosterAvailable,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    sex: draft.sex, size: draft.size, color: draft.color, weightLbs: weight === '' ? null : Number(weight), energyLevel: draft.energyLevel,
    spayedNeutered: draft.spayedNeutered, goodWithKids: draft.goodWithKids, goodWithDogs: draft.goodWithDogs, goodWithCats: draft.goodWithCats,
  };
}

/** The same pet with a new status, for changing many pets at once. */
export function inputFromPet(pet: Pet, changes: Partial<PetInput> = {}): PetInput {
  return { ...inputFromDraft(draftFromPet(pet)), ...changes };
}

export const TAB_FIELDS = {
  basics: ['name', 'status', 'type', 'breed', 'age', 'intakeDate', 'tags', 'summary', 'medicalHistory'],
  details: ['sex', 'size', 'color', 'weightLbs', 'energyLevel', 'spayedNeutered', 'goodWithKids', 'goodWithDogs', 'goodWithCats'],
} as const;

export type FlagChange = Omit<PetFlagsInput, 'petIds'>;
