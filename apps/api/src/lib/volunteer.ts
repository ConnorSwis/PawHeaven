import type {
  AdminVolunteerParticipant,
  AdminVolunteerShift,
  FieldErrors,
  RegisterVolunteerInput,
  VolunteerCancelReason,
  VolunteerRegistration,
  VolunteerRegistrationStatus,
  VolunteerShift,
  VolunteerShiftInput,
} from '@pawheaven/contracts';
import { ageOn, validPhone } from './applications';
import { isoInstant, rpcErrorResponse, type ApiResponse } from './http';

export type DatabaseVolunteerShiftListing = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  min_age: number;
  starts_at: string;
  ends_at: string;
  capacity: number;
  spots_remaining: number;
  registered: boolean;
};

export type DatabaseVolunteerShift = Omit<DatabaseVolunteerShiftListing, 'spots_remaining' | 'registered'> & {
  status: 'published' | 'canceled';
  created_at: string;
};

export type DatabaseMemberVolunteerRegistration = {
  id: string;
  shift_id: string;
  status: VolunteerRegistrationStatus;
  canceled_reason: VolunteerCancelReason | null;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  requirements: string;
  starts_at: string;
  ends_at: string;
};

export type DatabaseVolunteerRegistration = {
  id: string;
  shift_id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  status: VolunteerRegistrationStatus;
  created_at: string;
};

export function volunteerShiftForClient(row: DatabaseVolunteerShiftListing): VolunteerShift {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    minAge: row.min_age,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    spotsRemaining: row.spots_remaining,
    registered: row.registered,
  };
}

export function volunteerRegistrationForClient(row: DatabaseMemberVolunteerRegistration): VolunteerRegistration {
  return {
    id: row.id,
    shiftId: row.shift_id,
    status: row.status,
    canceledReason: row.canceled_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export function adminVolunteerShiftForClient(row: DatabaseVolunteerShift, participants: DatabaseVolunteerRegistration[]): AdminVolunteerShift {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    minAge: row.min_age,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at,
    participants: participants.map((participant): AdminVolunteerParticipant => ({
      id: participant.id,
      memberId: participant.member_id,
      memberName: participant.member_name,
      memberEmail: participant.member_email,
      memberPhone: participant.member_phone,
      status: participant.status,
      registeredAt: participant.created_at,
    })),
  };
}

export function registerVolunteerInput(body: unknown): { value: RegisterVolunteerInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const phone = text('phone');
  const dateOfBirth = text('dateOfBirth');
  const errors: FieldErrors = {};
  if (!phone) errors.phone = 'Enter a phone number where the shelter can reach you.';
  else if (!validPhone(phone)) errors.phone = 'Enter a valid phone number with at least 10 digits.';
  const age = dateOfBirth ? ageOn(dateOfBirth) : null;
  if (!dateOfBirth) errors.dateOfBirth = 'Enter your date of birth.';
  else if (age === null || age < 0 || age > 120) errors.dateOfBirth = 'Enter a valid date of birth.';
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { phone, dateOfBirth } };
}

export function volunteerShiftInput(body: unknown): { value: VolunteerShiftInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const title = text('title');
  const description = text('description');
  const requirements = text('requirements');
  const startsAt = isoInstant(input?.startsAt);
  const endsAt = isoInstant(input?.endsAt);
  const minAge = typeof input?.minAge === 'number' ? input.minAge : Number.NaN;
  const capacity = typeof input?.capacity === 'number' ? input.capacity : Number.NaN;
  const errors: FieldErrors = {};

  if (!title) errors.title = 'Give the shift a title.';
  else if (title.length > 100) errors.title = 'Keep the title to 100 characters or fewer.';
  if (!description) errors.description = 'Describe the duties volunteers will perform.';
  else if (description.length > 2000) errors.description = 'Keep the duties under 2,000 characters.';
  if (requirements.length > 1000) errors.requirements = 'Keep the requirements under 1,000 characters.';
  if (!Number.isInteger(minAge) || minAge < 0 || minAge > 99) errors.minAge = 'Enter a minimum age from 0 (no minimum) to 99.';
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) errors.capacity = 'Enter a capacity from 1 to 500 volunteers.';
  if (!startsAt || Date.parse(startsAt) <= Date.now()) errors.startsAt = 'Choose a start time in the future.';
  if (!endsAt) errors.endsAt = 'Choose an end time.';
  else if (startsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.endsAt = 'The shift must end after it starts.';
  else if (startsAt && Date.parse(endsAt) - Date.parse(startsAt) > 24 * 60 * 60 * 1000) errors.endsAt = 'A shift can last at most 24 hours.';

  if (Object.keys(errors).length || !startsAt || !endsAt) return { fieldErrors: errors };
  return { value: { title, description, requirements, minAge, startsAt, endsAt, capacity } };
}

export function volunteerMutationError(operation: string, error: { message: string; code?: string }): ApiResponse {
  return rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again to manage volunteer shifts.' });
}
