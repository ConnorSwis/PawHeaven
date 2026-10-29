import type { Pet } from '@pawheaven/contracts';

/** `blizzard-4f2a91c3`: the animal's name plus the first eight characters of its id. */
export function petSlug(pet: Pick<Pet, 'id' | 'name'>): string {
  const name = pet.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'animal';
  return `${name}-${pet.id.slice(0, 8)}`;
}

export const petPath = (pet: Pick<Pet, 'id' | 'name'>) => `/adopt/${petSlug(pet)}`;

/** The 8 hex characters at the end of an animal address, or null. */
export function shortIdFromPath(pathname: string): string | null {
  return pathname.replace(/\/+$/, '').match(/([0-9a-f]{8})$/i)?.[1]?.toLowerCase() ?? null;
}
