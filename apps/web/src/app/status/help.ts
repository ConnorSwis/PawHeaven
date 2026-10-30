import { HELP_REASON_DETAILS, HELP_REASON_LABELS, type Pet } from '@pawheaven/contracts';

/** The visitor-facing reason an animal is flagged, or '' when it is not (or the reason is not one we know). */
export const helpLabel = (pet: Pick<Pet, 'helpReason'>): string => (pet.helpReason ? HELP_REASON_LABELS[pet.helpReason] ?? '' : '');
export const helpDetail = (pet: Pick<Pet, 'helpReason'>): string => (pet.helpReason ? HELP_REASON_DETAILS[pet.helpReason] ?? '' : '');

const since = (pet: Pick<Pet, 'helpSince'>) => (pet.helpSince ? Date.parse(pet.helpSince) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);

/** Flagged animals first, the ones flagged longest ago leading, then by name. */
export const byHelpSince = (a: Pet, b: Pet) => since(a) - since(b) || a.name.localeCompare(b.name);

/** Up to `limit` flagged animals, oldest flag first. */
export function needsHelpMost(pets: Pet[], limit = 4): Pet[] {
  return pets.filter((pet) => helpLabel(pet)).sort(byHelpSince).slice(0, limit);
}
