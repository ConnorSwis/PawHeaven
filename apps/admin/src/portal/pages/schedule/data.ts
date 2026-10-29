import type { AdminPetListResponse, AdminVisitScheduleResponse, AdminVisitSlot, AdminVolunteerShift, AdminVolunteerShiftListResponse, AvailabilityResponse, ShelterEvent } from '@pawheaven/contracts';
import { useApi } from '../../lib/api';

export const SCHEDULE_PREFIXES = ['/admin/visit-slots', '/admin/volunteer-shifts', '/admin/availability', '/admin/events'] as const;

/** Everything the Schedule page shows, loaded in parallel and cached so a refresh updates every tab. */
export function useScheduleData() {
  const visits = useApi<AdminVisitScheduleResponse>('/admin/visit-slots');
  const shiftList = useApi<AdminVolunteerShiftListResponse>('/admin/volunteer-shifts');
  const eventList = useApi<{ events: ShelterEvent[] }>('/admin/events');
  const availability = useApi<AvailabilityResponse>('/admin/availability');
  const pets = useApi<AdminPetListResponse>('/admin/pets');

  const slots: AdminVisitSlot[] = visits.data?.slots.filter((slot) => slot.status === 'published') ?? [];
  const shifts: AdminVolunteerShift[] = shiftList.data?.shifts.filter((shift) => shift.status === 'published') ?? [];
  const queries = [visits, shiftList, eventList, availability];
  return {
    slots,
    shifts,
    events: eventList.data?.events ?? [],
    rules: availability.data?.rules ?? [],
    exceptions: availability.data?.exceptions ?? [],
    pets: (pets.data?.pets ?? []).map((pet) => ({ id: pet.id, name: pet.name, status: pet.status })),
    loading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.isError)?.error ?? null,
  };
}
export type ScheduleData = ReturnType<typeof useScheduleData>;
