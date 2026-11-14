import { useMemo } from 'react';
import type { AdminPetListResponse } from '@pawheaven/contracts';
import { useApi } from './api';

/** Photo address by animal id, from the cached animals list. Lists that only know an animal's id use this to show its thumbnail. */
export function usePetPhotos() {
  const pets = useApi<AdminPetListResponse>('/admin/pets');
  return useMemo(() => new Map((pets.data?.pets ?? []).map((pet) => [pet.id, pet.imageUrl] as const)), [pets.data]);
}
