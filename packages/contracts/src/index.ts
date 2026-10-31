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

export const PET_SEXES = ['Male', 'Female', 'Unknown'] as const;
export const PET_SIZES = ['Small', 'Medium', 'Large', 'Extra large'] as const;
export const ENERGY_LEVELS = ['Low', 'Medium', 'High'] as const;
export const YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'] as const;

/** Why staff flagged an animal as needing help. A fixed list, so nothing private is ever shown publicly. */
export const HELP_REASONS = ['home_soon', 'foster', 'long_stay', 'medical'] as const;
export type HelpReason = (typeof HELP_REASONS)[number];
/** The wording shown to visitors and staff for each reason. */
export const HELP_REASON_LABELS: Record<HelpReason, string> = {
  home_soon: 'Needs a home soon',
  foster: 'Needs a foster',
  long_stay: 'Here a long time',
  medical: 'Needs medical care',
};
/** One line of context on the animal page: why this animal is listed first. */
export const HELP_REASON_DETAILS: Record<HelpReason, string> = {
  home_soon: 'Space is tight, so a home this week would make a real difference.',
  foster: 'A foster home, even for a few weeks, would get this animal out of a kennel.',
  long_stay: 'This animal has waited longer than most. The right person just has not met them yet.',
  medical: 'This animal needs medical care that a quiet home would help with.',
};

export type PetSex = (typeof PET_SEXES)[number] | '';
export type PetSize = (typeof PET_SIZES)[number] | '';
export type PetEnergyLevel = (typeof ENERGY_LEVELS)[number] | '';
/** Yes, No, or Unknown, where Unknown means staff have not assessed it. */
export type YesNoUnknown = (typeof YES_NO_UNKNOWN)[number];

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
  /** False hides the pet from the visit "meet a pet" picker. */
  visitsOpen: boolean;
  /** Staff flagged the pet as needing volunteer walkers. */
  needsWalkers: boolean;
  /** Set while staff have an open foster request for the pet. */
  fosterUrgent: boolean;
  /** Why staff flagged the animal as needing help; empty when not flagged. Shown publicly. */
  helpReason: HelpReason | '';
  /** When the current flag was set; null when not flagged. */
  helpSince: string | null;
  /** Empty string means not recorded. */
  sex: PetSex;
  size: PetSize;
  color: string;
  weightLbs: number | null;
  spayedNeutered: YesNoUnknown;
  goodWithKids: YesNoUnknown;
  goodWithDogs: YesNoUnknown;
  goodWithCats: YesNoUnknown;
  energyLevel: PetEnergyLevel;
  /** Where the animal lives; empty when not recorded. */
  housing: 'Shelter' | 'Foster home' | '';
  /** Credit and link back when the record came from another organization; empty otherwise. */
  sourceName: string;
  sourceUrl: string;
  /** Extra photos beyond `imageUrl`. */
  galleryUrls: string[];
  imageUrl: string | null;
};

/** Pet attributes are optional on input: an attribute left out is not changed. */
export type PetInput = Pick<Pet, 'name' | 'type' | 'breed' | 'age' | 'intakeDate' | 'tags' | 'status' | 'summary' | 'medicalHistory' | 'fosterAvailable'>
  & Partial<Pick<Pet, 'sex' | 'size' | 'color' | 'weightLbs' | 'spayedNeutered' | 'goodWithKids' | 'goodWithDogs' | 'goodWithCats' | 'energyLevel' | 'helpReason'>>;

export type AdminPetListResponse = {
  pets: Pet[];
};

/** A member's saved contact details, used only to prefill forms. Null means not saved. */
export type MemberProfile = {
  phone: string | null;
  address: string | null;
  /** ISO calendar date (YYYY-MM-DD). */
  dateOfBirth: string | null;
};

export type MemberProfileInput = {
  phone: string;
  address: string;
  dateOfBirth: string;
};

export type MemberProfileResponse = {
  profile: MemberProfile;
};

/** What happened to the pet when staff asked a review to also update it. */
export type PetStatusUpdate = 'applied' | 'failed' | 'not_requested';

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

/** Staff may ask an approval to also move the pet to a non-Available status. It is never automatic. */
export type ApplicationReviewInput = {
  status: Exclude<AdoptionApplicationStatus, 'Pending'>;
  markPetStatus?: Exclude<PetStatus, 'Available'>;
};

export type ApplicationReviewResponse<T> = T & { petStatusUpdate: PetStatusUpdate };

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
  /** How many groups the slot holds, and how many places remain. */
  capacity: number;
  spotsLeft: number;
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
  partySize: number;
  pets: { id: string; name: string }[];
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
  /** 1 to 6 people; defaults to 1. */
  partySize?: number;
  /** Up to 5 animals the visitors would like to meet. */
  petIds?: string[];
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
  partySize: number;
  pets: { id: string; name: string }[];
};

export type AdminVisitSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'published' | 'withdrawn';
  createdAt: string;
  capacity: number;
  ruleId: string | null;
  eventId: string | null;
  /** The first booking, kept for older screens; `appointments` lists every booked group. */
  appointment: AdminVisitAppointment | null;
  appointments: AdminVisitAppointment[];
};

export type AdminVisitScheduleResponse = {
  slots: AdminVisitSlot[];
};

export type PublishVisitSlotInput = {
  startsAt: string;
  endsAt: string;
  capacity?: number;
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

export type DonationStatus = 'pending' | 'succeeded' | 'failed';

export type AdminDonation = {
  id: string;
  amountCents: number;
  /** Lowercase ISO 4217 code, such as `usd`. */
  currency: string;
  status: DonationStatus;
  donorName: string | null;
  donorEmail: string | null;
  /** False for Stripe test-mode payments, which move no real money. */
  livemode: boolean;
  createdAt: string;
};

export type DonationTotal = {
  livemode: boolean;
  currency: string;
  count: number;
  totalCents: number;
};

export type AdminDonationsResponse = {
  /** Succeeded donations only, with test and live kept apart. */
  totals: DonationTotal[];
  donations: AdminDonation[];
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
    pet.color,
    pet.sex,
    pet.size,
    pet.energyLevel ? `${pet.energyLevel} energy` : '',
    pet.goodWithKids === 'Yes' ? 'kids children' : '',
    pet.goodWithDogs === 'Yes' ? 'dogs' : '',
    pet.goodWithCats === 'Yes' ? 'cats' : '',
    pet.status,
    pet.intakeDate,
    String(pet.daysInShelter),
  ].join(' '));
  return terms.every((term) => details.some((detail) => detail.includes(term)));
}

// --- Get Involved: open hours, events, pet quick actions, foster pool, schedule ----------------

export type AvailabilityRuleInput = {
  kind: 'visit' | 'shift';
  /** 0 is Sunday. */
  weekday: number;
  /** "HH:MM" in the shelter's local time. */
  startTime: string;
  endTime: string;
  capacity: number;
  /** Visit rules only: how long each bookable slot is. */
  slotMinutes: number;
  /** Shift rules only. */
  title: string;
  description: string;
  requirements: string;
  minAge: number;
  weeksAhead: number;
  active: boolean;
};
export type AvailabilityRule = AvailabilityRuleInput & { id: string };
export type AvailabilityException = { date: string; reason: string };
export type AvailabilityResponse = { rules: AvailabilityRule[]; exceptions: AvailabilityException[] };
export type GenerateAvailabilityResponse = { visitsCreated: number; shiftsCreated: number };

export type EventRoleInput = { title: string; description?: string; requirements?: string; capacity: number; minAge?: number };
export type EventInput = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /** Groups per visit slot; 0 skips visits. */
  visitCapacity: number;
  slotMinutes: number;
  roles: EventRoleInput[];
  petIds: string[];
};
export type ShelterEvent = { id: string; title: string; description: string; startsAt: string; endsAt: string; pets: { id: string; name: string }[] };

export type PetFlagsInput = { petIds: string[]; fosterAvailable?: boolean; visitsOpen?: boolean; needsWalkers?: boolean };

export type FosterRequestResponseStatus = 'pending' | 'accepted' | 'declined';
export type AdminFosterRequest = {
  id: string;
  petId: string;
  petName: string;
  note: string;
  createdAt: string;
  closedAt: string | null;
  notified: number;
  accepted: number;
  declined: number;
};
export type MemberFosterRequest = { id: string; petId: string; petName: string; species: string; note: string; createdAt: string; response: FosterRequestResponseStatus };
export type VolunteerFosterCandidate = { memberId: string; name: string; email: string; shifts: number; hours: number; invited: boolean };

export type AttentionItem = {
  kind: string;
  title: string;
  detail: string;
  /** What the staff portal should offer: generate, schedule, open_foster, fosters, animals (go to the Animals page), mark_help (flag petIds as needing help), outreach (go to the Outreach page). */
  action: 'generate' | 'schedule' | 'open_foster' | 'fosters' | 'animals' | 'mark_help' | 'outreach';
  refId?: string;
  petIds?: string[];
};

export type MyInvolvement = {
  volunteerShifts: number;
  volunteerHours: number;
  fosterAlerts: boolean;
  approvedFoster: boolean;
  fosterInvitation: boolean;
};

export type ScheduleEntry = {
  kind: 'visit' | 'shift' | 'foster';
  id: string;
  title: string;
  detail: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type GetInvolvedFeed = {
  visits: { startsAt: string; endsAt: string; spotsLeft: number }[];
  shifts: { id: string; title: string; startsAt: string; endsAt: string; spotsLeft: number }[];
  events: ShelterEvent[];
  foster: { open: number; urgent: { id: string; name: string }[] };
};

/** GET /public/availability: open visit times (with ids) and volunteer shifts, readable without signing in. */
export type PublicAvailability = {
  visits: { id: string; startsAt: string; endsAt: string; spotsLeft: number }[];
  shifts: { id: string; title: string; description: string; requirements: string; minAge: number; startsAt: string; endsAt: string; capacity: number; spotsLeft: number }[];
};

/** How full a species group's kennels are. `unset` means staff have not entered a kennel count. */
export type ShelterLevel = 'unset' | 'ok' | 'busy' | 'full' | 'over';
export type ShelterGroupStatus = {
  group: 'Dog' | 'Cat' | 'Other';
  kennels: number;
  heldBack: number;
  /** Animals using a kennel: Available or Pending, not in a foster home. */
  used: number;
  /** Animals open for adoption in this group. */
  ready: number;
  /** Used kennels as a whole percent of usable kennels; null when unset. */
  percent: number | null;
  level: ShelterLevel;
};
/** GET /public/shelter-status and GET /admin/capacity: counts and levels only, nothing about individual animals. */
export type ShelterStatus = { groups: ShelterGroupStatus[]; needHelp: number };
export type CapacityInput = { kennels: number; heldBack: number };
/** POST /admin/pets/help: an empty reason clears the flag. */
export type PetHelpInput = { petIds: string[]; reason: HelpReason | '' };

// --- Alerts, saved animals, and the newsletter ---------------------------------------------------

/** Directory filters a member can save for email alerts. Booleans are only ever `true`; an absent key means "any". */
export type SavedSearchFilters = {
  species?: 'dog' | 'cat' | 'other';
  size?: 'small' | 'medium' | 'large' | 'extra-large';
  age?: 'baby' | 'young' | 'adult' | 'senior';
  sex?: 'male' | 'female';
  energy?: 'low' | 'medium' | 'high';
  kids?: true;
  dogs?: true;
  cats?: true;
  foster?: true;
};
export type SavedSearch = { id: string; label: string; filters: SavedSearchFilters; createdAt: string };
export type SavedSearchInput = { label: string; filters: SavedSearchFilters };
export type SavedSearchListResponse = { searches: SavedSearch[] };

/** GET /me/saved and the responses of the calls that change it. Newest first. */
export type SavedPetsResponse = { petIds: string[] };

/** A member's optional-email choices. Service messages (your visit, shift, or application) are always sent. */
export type EmailPrefs = {
  /** Daily email when a new animal fits one of the member's saved searches. */
  matchDigest: boolean;
  /** Daily email when an animal the member saved becomes available, pending, or adopted. */
  savedChanges: boolean;
  newsletter: boolean;
  /** Only approved fosters can turn this on. */
  fosterAlerts: boolean;
  approvedFoster: boolean;
  savedSearches: number;
  savedAnimals: number;
};
export type EmailPrefsInput = Partial<Pick<EmailPrefs, 'matchDigest' | 'savedChanges' | 'newsletter'>>;

/** POST /public/subscribe. `pending` means a confirmation email was sent; `confirmed` means the address was already subscribed. */
export type SubscribeResponse = { status: 'pending' | 'confirmed' };
/** POST /public/unsubscribe, with the signed token from the link in an email. */
export type UnsubscribeScope = 'newsletter' | 'alerts' | 'all';
export type UnsubscribeResponse = { scope: UnsubscribeScope };

export const NEWSLETTER_BLOCKS = ['help', 'newest', 'events', 'shifts'] as const;
export type NewsletterBlock = (typeof NEWSLETTER_BLOCKS)[number];
export const NEWSLETTER_BLOCK_LABELS: Record<NewsletterBlock, string> = {
  help: 'Animals who need help',
  newest: 'Newest arrivals',
  events: 'Upcoming events',
  shifts: 'Open volunteer shifts',
};
export type NewsletterStatus = 'draft' | 'sending' | 'sent';
export type Newsletter = {
  id: string;
  subject: string;
  body: string;
  blocks: NewsletterBlock[];
  status: NewsletterStatus;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};
export type NewsletterInput = { subject: string; body: string; blocks: NewsletterBlock[] };
export type NewsletterListResponse = { newsletters: Newsletter[] };
/** GET /admin/newsletters/<id>/preview: the email as subscribers will see it. */
export type NewsletterPreviewResponse = { subject: string; html: string; text: string };

export type Subscriber = { id: string; email: string; status: 'pending' | 'confirmed' | 'unsubscribed'; createdAt: string; confirmedAt: string | null };
export type SubscriberListResponse = { subscribers: Subscriber[] };
/** GET /admin/outreach: what people have signed up for and whether email is flowing. */
export type OutreachSummary = {
  subscribers: { confirmed: number; pending: number; unsubscribed: number };
  searches: { total: number; members: number; bySpecies: { species: string; count: number }[] };
  savedAnimals: number;
  outbox: { queued: number; failed: number; sentLast7Days: number };
};
