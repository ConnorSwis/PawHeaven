export type ApiUser = {
  id: string;
  name: string;
  email: string;
};

/** Three roles exist: `member` (no portal access), `staff`, and `superuser`. Staff manage pets, applications, the visit schedule, and member accounts; a superuser also manages staff accounts and invites staff. */
export type AdminRole = 'staff' | 'superuser';

export type AdminUser = ApiUser & {
  role: AdminRole;
};

export type ManagedUserRole = AdminRole | 'member';

/** Roles a superuser may assign to an ordinary or staff account. */
export type AssignableUserRole = 'member' | 'staff';

export type AdminUserRoleInput = {
  role: AssignableUserRole;
};

/** A validation failure keyed by the form field that needs correcting. */
export type FieldErrors = Record<string, string>;

export type ApiErrorResponse = {
  message: string;
  fieldErrors?: FieldErrors;
};

export type ChangeEmailInput = {
  email: string;
  currentPassword: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

/** Returns a user-facing explanation when a password is too weak, or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length > 1024) return 'Use 1,024 characters or fewer for your password.';
  if (password.length < 8
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password)
    || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character.';
  }
  return null;
}

export type ManagedUser = ApiUser & {
  role: ManagedUserRole;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  blocked: boolean;
};

export type AdminUserListResponse = {
  users: ManagedUser[];
};

export type AdminUserDetailResponse = {
  user: ManagedUser;
  applications: AdoptionApplication[];
};

export type AdminUserUpdateInput = {
  name: string;
  email: string;
};

export type AdminInvitation = {
  userId: string;
  email: string;
  invitedAt: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  status: 'awaiting_setup' | 'active';
};

export type AdminInvitationListResponse = {
  invitations: AdminInvitation[];
};

export type PetStatus = 'Available' | 'Pending' | 'Adopted' | 'Fostered' | 'Unavailable';

export const PET_STATUSES: readonly PetStatus[] = ['Available', 'Pending', 'Adopted', 'Fostered', 'Unavailable'];

export type Pet = {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  daysInShelter: number;
  intakeDate: string;
  tags: string[];
  status: PetStatus;
  summary: string;
  /** Public vaccination and health summary. */
  medicalHistory: string;
  /** True when an Available pet is also open to foster applications. */
  fosterAvailable: boolean;
  imageUrl: string | null;
};

export type PetInput = Pick<Pet, 'name' | 'type' | 'breed' | 'age' | 'intakeDate' | 'tags' | 'status' | 'summary' | 'medicalHistory' | 'fosterAvailable'>;

export type AdminPetListResponse = {
  pets: Pet[];
};

export type AdoptionApplicationStatus = 'Pending' | 'In review' | 'Approved' | 'Declined';

export type AdoptionApplicationInput = {
  applicantPhone: string;
  applicantAddress: string;
  /** ISO calendar date (YYYY-MM-DD). Applicants must be at least 18. */
  applicantDateOfBirth: string;
  householdSummary: string;
  adoptionExperience: string;
  note: string;
};

export type AdoptionApplication = {
  id: string;
  petId: string;
  petName: string;
  applicantName: string;
  applicantEmail: string;
  /** Null on applications submitted before contact details were collected. */
  applicantPhone: string | null;
  applicantAddress: string | null;
  applicantDateOfBirth: string | null;
  householdSummary: string;
  adoptionExperience: string;
  note: string;
  status: AdoptionApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AdoptionApplicationListResponse = {
  applications: AdoptionApplication[];
};

export type AdminAdoptionApplicationListResponse = AdoptionApplicationListResponse;

export type VisitSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
};

export type VisitSlotListResponse = {
  slots: VisitSlot[];
};

export type VisitAppointmentStatus = 'booked' | 'canceled';
export type AppointmentEventType = 'booked' | 'rescheduled' | 'canceled';

export type VisitAppointment = {
  id: string;
  slotId: string;
  purpose: string;
  status: VisitAppointmentStatus;
  createdAt: string;
  updatedAt: string;
  startsAt: string;
  endsAt: string;
};

export type AppointmentEvent = {
  id: string;
  appointmentId: string;
  eventType: AppointmentEventType;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type VisitAppointmentListResponse = {
  appointments: VisitAppointment[];
  events: AppointmentEvent[];
};

export type BookVisitInput = {
  slotId: string;
  purpose: string;
};

export type RescheduleVisitInput = {
  slotId: string;
};

export type AdminVisitAppointment = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  purpose: string;
  status: VisitAppointmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminVisitSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'published' | 'withdrawn';
  createdAt: string;
  appointment: AdminVisitAppointment | null;
};

export type AdminVisitScheduleResponse = {
  slots: AdminVisitSlot[];
};

export type PublishVisitSlotInput = {
  startsAt: string;
  endsAt: string;
};

function searchableWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Matches every word in a search against the public details of a pet listing. */
export function matchesPetSearch(pet: Pet, search: string): boolean {
  const terms = searchableWords(search);
  if (!terms.length) return true;
  const details = searchableWords([
    pet.name,
    pet.type,
    pet.breed,
    pet.age,
    pet.summary,
    pet.tags.join(' '),
    pet.fosterAvailable ? 'foster fostering' : '',
    pet.status,
    pet.intakeDate,
    String(pet.daysInShelter),
  ].join(' '));
  return terms.every((term) => details.some((detail) => detail.includes(term)));
}
