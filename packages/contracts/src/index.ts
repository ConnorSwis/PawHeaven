export type ApiUser = {
  id: string;
  name: string;
  email: string;
};

export type AdminRole = 'admin' | 'superuser';

export type AdminUser = ApiUser & {
  role: AdminRole;
};

export type PetStatus = 'Available' | 'Pending' | 'Adopted';

export type Pet = {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  daysInShelter: number;
  intakeDate: string;
  tags: string[];
  status: PetStatus;
  summary: string;
  imageUrl: string | null;
};

export type PetInput = Pick<Pet, 'name' | 'type' | 'breed' | 'age' | 'intakeDate' | 'tags' | 'status' | 'summary'>;

export type AdminPetListResponse = {
  pets: Pet[];
};

export type AdoptionApplicationStatus = 'Pending' | 'In review' | 'Approved' | 'Declined';

export type AdoptionApplicationInput = {
  householdSummary: string;
  note: string;
};

export type AdoptionApplication = {
  id: string;
  petId: string;
  petName: string;
  applicantName: string;
  applicantEmail: string;
  householdSummary: string;
  note: string;
  status: AdoptionApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AdoptionApplicationListResponse = {
  applications: AdoptionApplication[];
};

export type AdminAdoptionApplicationListResponse = AdoptionApplicationListResponse;

function searchableWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Matches every word in a search against the public details of a pet listing. */
export function matchesPetSearch(pet: Pet, search: string): boolean {
  const terms = searchableWords(search);
  if (!terms.length) return true;
  const details = searchableWords([
    pet.name,
    pet.type,
    pet.breed,
    pet.age,
    pet.summary,
    pet.tags.join(' '),
    pet.status,
    pet.intakeDate,
    String(pet.daysInShelter),
  ].join(' '));
  return terms.every((term) => details.some((detail) => detail.includes(term)));
}
