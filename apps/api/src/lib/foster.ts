import type { AdoptionApplicationStatus, FieldErrors, FosterApplication, FosterApplicationInput } from '@pawheaven/contracts';
import { ageOn, validPhone } from './applications';

export type DatabaseFosterApplication = {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  applicant_address: string;
  applicant_date_of_birth: string;
  pet_id: string;
  pet_name: string;
  household_summary: string;
  foster_experience: string;
  available_from: string;
  available_until: string;
  note: string;
  status: AdoptionApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export function fosterApplicationForClient(row: DatabaseFosterApplication): FosterApplication {
  return {
    id: row.id,
    petId: row.pet_id,
    petName: row.pet_name,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    applicantAddress: row.applicant_address,
    applicantDateOfBirth: row.applicant_date_of_birth,
    householdSummary: row.household_summary,
    fosterExperience: row.foster_experience,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    note: row.note,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

const MINIMUM_APPLICANT_AGE = 18;
const MAXIMUM_FOSTER_WINDOW_DAYS = 365;

/** Today's calendar date (YYYY-MM-DD) in the shelter's timezone. */
export function shelterToday(timeZone = 'America/New_York', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function dayNumber(value: string): number | null {
  return ageOn(value) === null ? null : Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}

export function fosterApplicationInput(body: unknown, today = shelterToday()): { value: FosterApplicationInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const applicantPhone = text('applicantPhone');
  const applicantAddress = text('applicantAddress');
  const applicantDateOfBirth = text('applicantDateOfBirth');
  const householdSummary = text('householdSummary');
  const fosterExperience = text('fosterExperience');
  const availableFrom = text('availableFrom');
  const availableUntil = text('availableUntil');
  const note = text('note');
  const errors: FieldErrors = {};

  if (!applicantPhone) errors.applicantPhone = 'Enter a phone number where the shelter can reach you.';
  else if (!validPhone(applicantPhone)) errors.applicantPhone = 'Enter a valid phone number with at least 10 digits.';
  if (!applicantAddress) errors.applicantAddress = 'Enter your mailing address.';
  else if (applicantAddress.length < 5 || applicantAddress.length > 300) errors.applicantAddress = 'Enter your full address using 5 to 300 characters.';
  const age = applicantDateOfBirth ? ageOn(applicantDateOfBirth) : null;
  if (!applicantDateOfBirth) errors.applicantDateOfBirth = 'Enter your date of birth.';
  else if (age === null || age < 0 || age > 120) errors.applicantDateOfBirth = 'Enter a valid date of birth.';
  else if (age < MINIMUM_APPLICANT_AGE) errors.applicantDateOfBirth = `Applicants must be at least ${MINIMUM_APPLICANT_AGE} years old.`;
  if (householdSummary.length < 20) errors.householdSummary = 'Tell us a little more about your household and the care you can provide.';
  else if (householdSummary.length > 2000) errors.householdSummary = 'Keep the household summary under 2,000 characters.';
  if (fosterExperience.length < 20) errors.fosterExperience = 'Tell us about your pet-care or fostering experience, or how you will prepare.';
  else if (fosterExperience.length > 1000) errors.fosterExperience = 'Keep your experience answer under 1,000 characters.';
  if (note.length > 1000) errors.note = 'Keep the note under 1,000 characters.';

  const from = availableFrom ? dayNumber(availableFrom) : null;
  const until = availableUntil ? dayNumber(availableUntil) : null;
  const todayNumber = dayNumber(today)!;
  if (!availableFrom) errors.availableFrom = 'Choose the first day you can provide care.';
  else if (from === null) errors.availableFrom = 'Enter a valid start date.';
  else if (from < todayNumber) errors.availableFrom = 'The start date cannot be in the past.';
  if (!availableUntil) errors.availableUntil = 'Choose the last day you can provide care.';
  else if (until === null) errors.availableUntil = 'Enter a valid end date.';
  else if (from !== null && until < from) errors.availableUntil = 'The end date must be on or after the start date.';
  else if (from !== null && until - from > MAXIMUM_FOSTER_WINDOW_DAYS) errors.availableUntil = 'Choose a care period of one year or less.';

  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { applicantPhone, applicantAddress, applicantDateOfBirth, householdSummary, fosterExperience, availableFrom, availableUntil, note } };
}
