import { useQuery } from '@tanstack/react-query';
import type { ShelterStatus } from '@pawheaven/contracts';
import { loadShelterStatus } from '../../lib/shelter-status';

/** The public shelter status, or null while loading and when it could not be loaded. Never throws. */
export function useShelterStatus(): { status: ShelterStatus | null; isLoading: boolean } {
  const query = useQuery<ShelterStatus | null>({ queryKey: ['/public/shelter-status'], queryFn: loadShelterStatus, staleTime: 60_000, retry: false });
  return { status: query.data ?? null, isLoading: query.isLoading };
}
