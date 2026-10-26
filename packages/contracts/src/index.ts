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

export type FosterApplicationInput = {
  applicantPhone: string;
  applicantAddress: string;
  /** ISO calendar date (YYYY-MM-DD). Applicants must be at least 18. */
  applicantDateOfBirth: string;
  householdSummary: string;
  fosterExperience: string;
  /** First day (YYYY-MM-DD) the applicant can provide care. Not in the past. */
  availableFrom: string;
  /** Last day (YYYY-MM-DD) of the care window; on or after the start and within one year. */
  availableUntil: string;
  note: string;
};

export type FosterApplication = {
  id: string;
  petId: string;
  petName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantAddress: string;
  applicantDateOfBirth: string;
  householdSummary: string;
  fosterExperience: string;
  availableFrom: string;
  availableUntil: string;
  note: string;
  status: AdoptionApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type FosterApplicationListResponse = {
  applications: FosterApplication[];
};

export type AdminFosterApplicationListResponse = FosterApplicationListResponse;

export type VolunteerShift = {
  id: string;
  title: string;
  /** Duties volunteers will perform. */
  description: string;
  /** Participation requirements such as footwear or training; may be empty. */
  requirements: string;
  /** Minimum age in years; 0 means no minimum. */
  minAge: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  spotsRemaining: number;
  /** True when the signed-in member already holds an active registration. */
  registered: boolean;
};

export type VolunteerShiftListResponse = {
  shifts: VolunteerShift[];
};

export type VolunteerRegistrationStatus = 'registered' | 'canceled';
export type VolunteerCancelReason = 'member' | 'shift_canceled';

export type VolunteerRegistration = {
  id: string;
  shiftId: string;
  status: VolunteerRegistrationStatus;
  canceledReason: VolunteerCancelReason | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string;
  requirements: string;
  startsAt: string;
  endsAt: string;
};

export type VolunteerRegistrationListResponse = {
  registrations: VolunteerRegistration[];
};

export type RegisterVolunteerInput = {
  phone: string;
  /** ISO calendar date (YYYY-MM-DD), checked against the shift's minimum age. */
  dateOfBirth: string;
};

export type VolunteerShiftInput = {
  title: string;
  description: string;
  requirements: string;
  minAge: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
};

export type AdminVolunteerParticipant = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  status: VolunteerRegistrationStatus;
  registeredAt: string;
};

export type AdminVolunteerShift = Omit<VolunteerShift, 'spotsRemaining' | 'registered'> & {
  status: 'published' | 'canceled';
  createdAt: string;
  /** Active registrations only. */
  participants: AdminVolunteerParticipant[];
};

export type AdminVolunteerShiftListResponse = {
  shifts: AdminVolunteerShift[];
};

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

export const QUIZ_QUESTIONS = {
  livingSpace: { label: 'Where do you live?', options: { apartment: 'Apartment or condo', 'small-home': 'House with a small or no yard', 'large-yard': 'House with a large or fenced yard', farm: 'Farm or rural property' } },
  household: { label: 'Who shares your home?', options: { adults: 'Adults only', children: 'Children under 12' } },
  otherPets: { label: 'Which pets do you already have?', options: { none: 'None', dogs: 'Dogs', cats: 'Cats', both: 'Dogs and cats' } },
  activityLevel: { label: 'How active are you?', options: { low: 'Mostly relaxed', moderate: 'A few walks or outings a week', high: 'Very active: runs, hikes, or daily adventures' } },
  hoursAlone: { label: 'How long would the pet be alone on a typical day?', options: { 'under-4': 'Under 4 hours', '4-8': '4 to 8 hours', 'over-8': 'More than 8 hours' } },
  experience: { label: 'How much pet-care experience do you have?', options: { 'first-time': 'This would be my first pet', some: 'Some experience', experienced: 'Very experienced' } },
  species: { label: 'What kind of pet are you hoping for?', options: { dog: 'A dog', cat: 'A cat', either: 'Either is fine' } },
  size: { label: 'What size do you prefer?', options: { small: 'Small', medium: 'Medium', large: 'Large', any: 'No preference' } },
  age: { label: 'What age do you prefer?', options: { young: 'Young (puppy, kitten, or under 2 years)', adult: 'Adult', senior: 'Senior', any: 'No preference' } },
} as const;

export const QUIZ_TRAITS = {
  calm: 'Calm and relaxed',
  playful: 'Playful',
  cuddly: 'Affectionate and cuddly',
  independent: 'Independent',
  active: 'Energetic',
  trainable: 'Easy to train',
} as const;

export type QuizTrait = keyof typeof QUIZ_TRAITS;

export type QuizAnswers = {
  [Question in keyof typeof QUIZ_QUESTIONS]: keyof (typeof QUIZ_QUESTIONS)[Question]['options'];
} & {
  /** One to three traits the member wants in a pet. */
  traits: QuizTrait[];
  /** Optional free text, at most 500 characters. */
  notes: string;
};

export type QuizRecommendation = {
  pet: Pet;
  /** Fit from 0 to 100. */
  score: number;
  /** One or two sentences explaining the fit. */
  reason: string;
};

export type QuizResultResponse = {
  id: string;
  answers: QuizAnswers;
  recommendations: QuizRecommendation[];
  createdAt: string;
  /** Set when there is nothing to recommend, such as no animals open to matching. */
  notice: string | null;
};

export type LatestQuizResponse = {
  result: QuizResultResponse | null;
};

export type LostPetSpecies = 'Dog' | 'Cat' | 'Other';

/** The limited, public-safe view of a shelter animal that a lost-pet search may show. */
export type LostPetMatchPet = Pick<Pet, 'id' | 'name' | 'type' | 'breed' | 'age' | 'status' | 'imageUrl'>;

export type LostPetMatch = {
  pet: LostPetMatchPet;
  /** The model's own 0 to 100 estimate, not a measurement. Show it with `matchStrength`, never as a percentage. It is never proof of ownership. */
  confidence: number;
  reason: string;
};

export type LostPetSearchResponse = {
  /** Null when nothing was kept: no animals to compare, or no possible matches. */
  searchId: string | null;
  matches: LostPetMatch[];
  /** A message to show when there are no matches or no animals to compare against. */
  notice: string | null;
};

export type LostPetInquiryInput = {
  searchId: string;
  petId: string;
  phone: string;
  message: string;
};

export type LostPetInquiryStatus = 'New' | 'In progress' | 'Resolved';

export type LostPetInquiry = {
  id: string;
  petId: string | null;
  petName: string;
  message: string;
  status: LostPetInquiryStatus;
  createdAt: string;
};

export type LostPetInquiryListResponse = {
  inquiries: LostPetInquiry[];
};

export type AdminLostPetInquiry = LostPetInquiry & {
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  staffNote: string;
  handledAt: string | null;
  petImageUrl: string | null;
  searchSpecies: LostPetSpecies;
  searchDescription: string;
  /** Short-lived signed links to the photos the member uploaded; null when the photos have expired. */
  photoUrls: string[];
};

export type AdminLostPetInquiryListResponse = {
  inquiries: AdminLostPetInquiry[];
};

export type AdminLostPetInquiryUpdateInput = {
  status: LostPetInquiryStatus;
  staffNote: string;
};

export type MatchStrength = 'Strong' | 'Likely' | 'Possible';

/** Turns a model's confidence estimate into a band, so the interface does not claim precision it does not have. */
export function matchStrength(confidence: number): MatchStrength {
  if (confidence >= 85) return 'Strong';
  if (confidence >= 65) return 'Likely';
  return 'Possible';
}

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
