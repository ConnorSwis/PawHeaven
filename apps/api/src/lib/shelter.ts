import { HELP_REASONS, type CapacityInput, type PetHelpInput, type ShelterStatus } from '@pawheaven/contracts';
import { UUID_PATTERN } from './http.ts';

/** Validates a "needs help" change: 1 to 200 pets and a reason from the list, or an empty reason to clear it. */
export function petHelpInput(body: unknown): { value: PetHelpInput } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const petIds = Array.isArray(input.petIds) ? [...new Set(input.petIds.filter((id): id is string => typeof id === 'string'))] : [];
  if (petIds.length < 1 || petIds.length > 200 || petIds.some((id) => !UUID_PATTERN.test(id))) return { message: 'Choose between 1 and 200 pets.' };
  const reason = input.reason;
  if (reason !== '' && !(typeof reason === 'string' && (HELP_REASONS as readonly string[]).includes(reason))) return { message: 'Choose a reason from the list.' };
  return { value: { petIds, reason: reason as PetHelpInput['reason'] } };
}

/** Validates kennel counts: whole numbers from 0 to 500, with held-back kennels no greater than the total. */
export function capacityInput(body: unknown): { value: CapacityInput } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const whole = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 500;
  if (!whole(input.kennels)) return { message: 'Enter a whole number of kennels from 0 to 500.' };
  if (!whole(input.heldBack) || (input.heldBack as number) > (input.kennels as number)) return { message: 'Held-back kennels must be a whole number no greater than the number of kennels.' };
  return { value: { kennels: input.kennels as number, heldBack: input.heldBack as number } };
}

export const shelterStatusForClient = (value: unknown): ShelterStatus => value as ShelterStatus;
