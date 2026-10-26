import type {
  AdoptionApplication,
  AdoptionApplicationInput,
  AdoptionApplicationStatus,
  FieldErrors,
} from '@pawheaven/contracts';

export type DatabaseAdoptionApplication = {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_address: string | null;
  applicant_date_of_birth: string | null;
  pet_id: string;
  pet_name: string;
  household_summary: string;
  adoption_experience: string;
  note: string;
  status: AdoptionApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export function applicationForClient(row: DatabaseAdoptionApplication): AdoptionApplication {
  return {
    id: row.id,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone ?? null,
    applicantAddress: row.applicant_address ?? null,
    applicantDateOfBirth: row.applicant_date_of_birth ?? null,
    petId: row.pet_id,
    petName: row.pet_name,
    householdSummary: row.household_summary,
    adoptionExperience: row.adoption_experience,
    note: row.note,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

const MINIMUM_APPLICANT_AGE = 18;

/** Whole years between a YYYY-MM-DD birth date and today (UTC), or null for an invalid date. */
export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  const match = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age -= 1;
  return age;
}

export function validPhone(value: string): boolean {
  return /^\+?[0-9 ().-]{7,30}$/.test(value) && value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15;
}

export function adoptionApplicationInput(body: unknown): { value: AdoptionApplicationInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const applicantPhone = text('applicantPhone');
  const applicantAddress = text('applicantAddress');
  const applicantDateOfBirth = text('applicantDateOfBirth');
  const householdSummary = text('householdSummary');
  const adoptionExperience = text('adoptionExperience');
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
  if (adoptionExperience.length < 20) errors.adoptionExperience = 'Tell us about your pet-care experience or how you will prepare for the responsibility.';
  else if (adoptionExperience.length > 1000) errors.adoptionExperience = 'Keep your experience answer under 1,000 characters.';
  if (note.length > 1000) errors.note = 'Keep the note under 1,000 characters.';

  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { applicantPhone, applicantAddress, applicantDateOfBirth, householdSummary, adoptionExperience, note } };
}

export function applicationReviewStatus(body: unknown): AdoptionApplicationStatus | null {
  const status = (body as Record<string, unknown> | null)?.status;
  return status === 'In review' || status === 'Approved' || status === 'Declined' ? status : null;
}
