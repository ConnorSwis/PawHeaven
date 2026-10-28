import type { FieldErrors, MemberProfile, MemberProfileInput } from '@pawheaven/contracts';
import { ageOn, validPhone } from './applications';

export type DatabaseMemberProfile = {
  user_id: string;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
};

export function profileForClient(row: DatabaseMemberProfile | null): MemberProfile {
  return { phone: row?.phone ?? null, address: row?.address ?? null, dateOfBirth: row?.date_of_birth ?? null };
}

/**
 * Every field is optional so a member can save a phone number without an
 * address; an empty value clears it. A date of birth only has to be a real past
 * date here: the 18+ and minimum-age rules belong to the forms that need them.
 */
export function profileInput(body: unknown): { value: MemberProfileInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const phone = text('phone');
  const address = text('address');
  const dateOfBirth = text('dateOfBirth');
  const errors: FieldErrors = {};
  if (phone && !validPhone(phone)) errors.phone = 'Enter a valid phone number with at least 10 digits.';
  if (address && (address.length < 5 || address.length > 300)) errors.address = 'Enter your full address using 5 to 300 characters.';
  if (dateOfBirth) {
    const age = ageOn(dateOfBirth);
    if (age === null || age < 0 || age > 120) errors.dateOfBirth = 'Enter a valid date of birth.';
  }
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { phone, address, dateOfBirth } };
}
