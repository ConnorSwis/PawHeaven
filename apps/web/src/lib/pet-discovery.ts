import type { Pet } from '@pawheaven/contracts';

/** The directory is a public surface, so never render non-available records. */
export function publicPets(pets: Pet[]): Pet[] {
  return pets
    .filter((pet) => pet.status === 'Available')
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function hasPetImage(pet: Pet): pet is Pet & { imageUrl: string } {
  return Boolean(pet.imageUrl?.trim());
}

/** Sample listings are browse-only; live available pets can accept applications. */
export function canStartApplication(pet: Pet, samplePet: boolean): boolean {
  return !samplePet && pet.status === 'Available' && /^[0-9a-f-]{36}$/i.test(pet.id);
}
