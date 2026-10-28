import type {
  AppointmentEvent,
  BookVisitInput,
  PublishVisitSlotInput,
  RescheduleVisitInput,
  VisitAppointment,
  VisitSlot,
} from '@pawheaven/contracts';
import { isoInstant, rpcErrorResponse, UUID_PATTERN, type ApiResponse } from './http';

export type DatabaseVisitSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'published' | 'withdrawn';
  created_at: string;
};

export type DatabaseAvailabilitySlot = Pick<DatabaseVisitSlot, 'id' | 'starts_at' | 'ends_at'> & {
  available: boolean;
};

export type DatabaseAppointment = {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  slot_id: string;
  purpose: string;
  status: 'booked' | 'canceled';
  created_at: string;
  updated_at: string;
};

export type DatabaseMemberAppointment = Pick<DatabaseAppointment, 'id' | 'slot_id' | 'purpose' | 'status' | 'created_at' | 'updated_at'> & {
  starts_at: string;
  ends_at: string;
};

export type DatabaseAppointmentEvent = {
  id: string;
  appointment_id: string;
  event_type: 'booked' | 'rescheduled' | 'canceled';
  slot_starts_at: string;
  slot_ends_at: string;
  created_at: string;
};

export function visitSlotForClient(row: DatabaseAvailabilitySlot): VisitSlot {
  return { id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, available: row.available };
}

export function visitAppointmentForClient(row: DatabaseMemberAppointment): VisitAppointment {
  return {
    id: row.id,
    slotId: row.slot_id,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export function appointmentEventForClient(row: DatabaseAppointmentEvent): AppointmentEvent {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    eventType: row.event_type,
    startsAt: row.slot_starts_at,
    endsAt: row.slot_ends_at,
    createdAt: row.created_at,
  };
}

export function publishVisitSlotInput(body: unknown): { value: PublishVisitSlotInput } | { message: string } {
  const input = body as Record<string, unknown> | null;
  const startsAt = isoInstant(input?.startsAt);
  const endsAt = isoInstant(input?.endsAt);
  if (!startsAt || !endsAt || Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { message: 'Choose a future end time after the start time.' };
  }
  return { value: { startsAt, endsAt } };
}

export function bookVisitInput(body: unknown): { value: BookVisitInput } | { message: string } {
  const input = body as Record<string, unknown> | null;
  const slotId = typeof input?.slotId === 'string' ? input.slotId : '';
  const purpose = typeof input?.purpose === 'string' ? input.purpose.trim() : '';
  if (!UUID_PATTERN.test(slotId)) return { message: 'Choose an available visit time.' };
  if (purpose.length < 1 || purpose.length > 500) return { message: 'Tell the shelter why you would like to visit, using up to 500 characters.' };
  return { value: { slotId, purpose } };
}

export function rescheduleVisitInput(body: unknown): { value: RescheduleVisitInput } | { message: string } {
  const slotId = (body as Record<string, unknown> | null)?.slotId;
  if (typeof slotId !== 'string' || !UUID_PATTERN.test(slotId)) return { message: 'Choose an available visit time.' };
  return { value: { slotId } };
}

export function visitMutationError(operation: string, error: { message: string; code?: string }): ApiResponse {
  return rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again to manage visits.' });
}
