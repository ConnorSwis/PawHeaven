/**
 * Site identity shown in the header, page titles, and footer. Change a value
 * and both the public site and the staff portal follow after a rebuild.
 * Colors, fonts, and sizes live in theme.css.
 */
export const SITE = {
  name: 'PawHeaven',
  adminName: 'PawHeaven Admin',
  tagline: 'Helping shelter pets find their next home.',
} as const;

/**
 * The themes defined in theme.css, in the order the playground and the optional
 * theme switcher list them. An empty id is the default theme. A test keeps this
 * list and the [data-theme] blocks in sync.
 */
export const THEMES = [
  { id: '', label: 'Moss (default)' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'dark', label: 'Dark' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'contrast', label: 'High contrast' },
] as const;

/**
 * Facts about the shelter, used by the public site's header, footer, contact, hours, fees, and
 * help pages. The process, fees, and requirements follow a typical county shelter; the contact
 * details below are PLACEHOLDERS (fictional address, 555 phone number, example.org email) that the
 * shelter replaces before launch. One change here updates every page.
 */
export const SHELTER = {
  name: 'PawHeaven',
  address: { line1: '100 Shelter Way', city: 'Decatur', state: 'GA', zip: '30030' },
  phone: '(404) 555-0100',
  phoneHref: 'tel:+14045550100',
  email: 'hello@pawheaven.example.org',
  adoptionEmail: 'adopt@pawheaven.example.org',
  lostAndFoundEmail: 'lostandfound@pawheaven.example.org',
  /** Shown as written. Times are America/New_York. */
  hours: [
    { days: 'Monday', open: 'Closed' },
    { days: 'Tuesday to Friday', open: '11 am to 6 pm' },
    { days: 'Saturday and Sunday', open: '10 am to 5 pm' },
  ],
  hoursNote: 'Adoption paperwork closes 30 minutes before closing. Holiday hours are posted on our home page.',
  /** Fees in dollars. Senior pets are free this year. */
  fees: {
    dog: 85,
    cat: 65,
    kittenPair: 65,
    workingCat: 0,
    seniorAge: 7,
    seniorFee: 0,
    over55Fee: 40,
    included: ['Spay or neuter', 'Microchip', 'Vaccinations', 'Heartworm test (dogs) or FIV/FeLV test (cats)', 'Dewormer', 'Flea and tick prevention'],
  },
  requirements: ['Be at least 18 years old', 'Bring a government-issued photo ID', 'Complete a short questionnaire', 'Meet with an adoption counselor'],
  volunteer: { minAgeAlone: 18, minAgeAccompanied: 10, recommendedHoursPerMonth: 6 },
} as const;
