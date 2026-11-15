/**
 * Pure helpers for the lost-pet flyer: what the sheet says and how big the big words can be. They live apart from the
 * React code so they can be tested without a browser. Every field on the flyer is optional, so every helper copes with
 * empty text.
 */

export interface FlyerData {
  headline: 'Lost' | 'Missing';
  kind: string;
  petName: string;
  breed: string;
  age: string;
  sex: string;
  appearance: string;
  distinguishing: string;
  lastSeenWhere: string;
  lastSeenWhen: string;
  reward: boolean;
  note: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  tabs: boolean;
  wholePhoto: boolean;
}

export const EMPTY_FLYER: FlyerData = {
  headline: 'Lost', kind: '', petName: '', breed: '', age: '', sex: '', appearance: '', distinguishing: '',
  lastSeenWhere: '', lastSeenWhen: '', reward: false, note: '', contactName: '', contactPhone: '', contactEmail: '',
  tabs: true, wholePhoto: false,
};

/** "LOST DOG", "MISSING PET" when no kind of animal is given. */
export function headlineText(data: Pick<FlyerData, 'headline' | 'kind'>): string {
  return `${data.headline} ${data.kind.trim() || 'pet'}`.toUpperCase();
}

/**
 * The largest font size (in em of the sheet) at which `text` still fits on one line across `widthEm`, assuming heavy
 * capitals. It is capped at `max` and floored at `min`, below which the text wraps instead.
 */
export function fitSize(text: string, widthEm: number, max: number, min: number, glyphEm = 0.7): number {
  const length = Math.max(text.length, 1);
  return Math.round(Math.max(min, Math.min(max, widthEm / (length * glyphEm))) * 100) / 100;
}

/** A US phone number written the usual way when it has ten digits; anything else is left as typed. */
export function formatPhone(raw: string): string {
  const text = raw.trim();
  const digits = text.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length === 10 && /^[\d\s().+-]+$/.test(text)) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return text;
}

/** "Saturday, November 8, 2026" from a yyyy-mm-dd date input, or an empty string when there is none. */
export function longDate(value: string, locale?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** How a person can be reached, in the order that works best on a tear-off tab. Empty when there is nothing yet. */
export function reachText(data: Pick<FlyerData, 'contactPhone' | 'contactEmail'>): string {
  return formatPhone(data.contactPhone) || data.contactEmail.trim();
}

/** What a tear-off tab says: the pet's name (or "Lost dog") and how to reach the owner. Null when there is no way to reach them yet. */
export function tabLines(data: Pick<FlyerData, 'headline' | 'kind' | 'petName' | 'contactPhone' | 'contactEmail'>): [string, string] | null {
  const reach = reachText(data);
  if (!reach) return null;
  const who = data.petName.trim() || `${data.headline} ${data.kind.trim().toLowerCase() || 'pet'}`;
  return [who, reach];
}

/** The line above the phone number. */
export function callLine(data: Pick<FlyerData, 'petName' | 'contactPhone' | 'contactEmail'>): string {
  const how = data.contactPhone.trim() || !data.contactEmail.trim() ? 'call' : 'email';
  const who = data.petName.trim();
  return who ? `If you see ${who}, please ${how}` : `If you have seen this pet, please ${how}`;
}

/** True when the sheet has nothing to say about the pet itself (no name, breed, age, sex, looks, details, reward, or note). */
export function hasPetFacts(data: FlyerData): boolean {
  return Boolean(data.petName.trim() || data.breed.trim() || data.age.trim() || data.sex || data.appearance.trim() || data.distinguishing.trim() || data.reward || data.note.trim());
}

/** Gentle, non-blocking reminders of what would make the flyer more useful. Printing is never blocked. */
export function tips(data: FlyerData, hasPhoto: boolean): string[] {
  const found: string[] = [];
  if (!reachText(data)) found.push('add a phone number so people can reach you');
  if (!hasPhoto) found.push('add a clear photo');
  if (!data.lastSeenWhere.trim() && !data.lastSeenWhen) found.push('say where and when you last saw your pet');
  if (!data.appearance.trim() && !data.breed.trim()) found.push('describe the color and markings');
  return found;
}
