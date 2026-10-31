import type { EmailPrefsInput, FieldErrors, Newsletter, NewsletterBlock, NewsletterInput, SavedSearch, SavedSearchFilters, SavedSearchInput, Subscriber } from '@pawheaven/contracts';

const NEWSLETTER_BLOCK_IDS: readonly NewsletterBlock[] = ['help', 'newest', 'events', 'shifts'];
const ENUMS: Record<'species' | 'size' | 'age' | 'sex' | 'energy', readonly string[]> = {
  species: ['dog', 'cat', 'other'],
  size: ['small', 'medium', 'large', 'extra-large'],
  age: ['baby', 'young', 'adult', 'senior'],
  sex: ['male', 'female'],
  energy: ['low', 'medium', 'high'],
};
const FLAGS = ['kids', 'dogs', 'cats', 'foster'] as const;

/** Keeps only known directory filters with allowed values. Returns null when nothing is selected. */
export function cleanFilters(value: unknown): SavedSearchFilters | null {
  const input = (value ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(ENUMS) as (keyof typeof ENUMS)[]) {
    const raw = input[key];
    if (typeof raw === 'string' && raw && ENUMS[key].includes(raw)) result[key] = raw;
  }
  for (const key of FLAGS) if (input[key] === true || input[key] === 'true' || input[key] === '1') result[key] = true;
  return Object.keys(result).length ? (result as SavedSearchFilters) : null;
}

const FILTER_WORDS: Record<string, (value: unknown) => string> = {
  species: (v) => ({ dog: 'Dogs', cat: 'Cats', other: 'Other animals' })[String(v)] ?? '',
  size: (v) => ({ small: 'small', medium: 'medium', large: 'large', 'extra-large': 'extra large' })[String(v)] ?? '',
  age: (v) => ({ baby: 'babies', young: 'young', adult: 'adult', senior: 'senior' })[String(v)] ?? '',
  sex: (v) => String(v),
  energy: (v) => `${String(v)} energy`,
  kids: () => 'good with kids',
  dogs: () => 'good with dogs',
  cats: () => 'good with cats',
  foster: () => 'open to foster',
};

/** A short readable name for a saved search, such as "Dogs, large, good with kids". */
export function filtersLabel(filters: SavedSearchFilters): string {
  const parts = (['species', 'size', 'age', 'sex', 'energy', 'kids', 'dogs', 'cats', 'foster'] as const)
    .filter((key) => filters[key] !== undefined)
    .map((key) => FILTER_WORDS[key](filters[key]))
    .filter(Boolean);
  const text = parts.join(', ') || 'Any animal';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function savedSearchInput(body: unknown): { value: SavedSearchInput } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const filters = cleanFilters(input.filters);
  if (!filters) return { message: 'Choose at least one filter to be alerted about.' };
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 120) : filtersLabel(filters);
  return { value: { label, filters } };
}

export function emailPrefsInput(body: unknown): { value: EmailPrefsInput } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const value: EmailPrefsInput = {};
  for (const key of ['matchDigest', 'savedChanges', 'newsletter'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') return { message: 'Choose on or off for each email.' };
    value[key] = input[key] as boolean;
  }
  if (!Object.keys(value).length) return { message: 'Choose an email setting to change.' };
  return { value };
}

export function petIdsInput(body: unknown): { value: string[] } | { message: string } {
  const ids = (body as { petIds?: unknown } | null)?.petIds;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) return { message: 'Send up to 100 animal ids.' };
  return { value: [...new Set(ids as string[])] };
}

export function newsletterInput(body: unknown): { value: NewsletterInput } | { fieldErrors: FieldErrors } {
  const input = (body ?? {}) as Record<string, unknown>;
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const text = typeof input.body === 'string' ? input.body.trim() : '';
  const blocks = Array.isArray(input.blocks) ? [...new Set(input.blocks.filter((block): block is NewsletterBlock => NEWSLETTER_BLOCK_IDS.includes(block as NewsletterBlock)))] : [];
  const errors: FieldErrors = {};
  if (!subject) errors.subject = 'Enter a subject line.';
  else if (subject.length > 150) errors.subject = 'Use 150 characters or fewer for the subject.';
  if (!text) errors.body = 'Write a message for your subscribers.';
  else if (text.length > 8000) errors.body = 'Use 8,000 characters or fewer for the message.';
  if (Array.isArray(input.blocks) && input.blocks.some((block) => !NEWSLETTER_BLOCK_IDS.includes(block as NewsletterBlock))) errors.blocks = 'Choose blocks from the list.';
  return Object.keys(errors).length ? { fieldErrors: errors } : { value: { subject, body: text, blocks } };
}

type DatabaseNewsletter = { id: string; subject: string; body: string; blocks: NewsletterBlock[]; status: Newsletter['status']; recipient_count: number; created_at: string; updated_at: string; sent_at: string | null };
export const newsletterForClient = (row: DatabaseNewsletter): Newsletter => ({
  id: row.id, subject: row.subject, body: row.body, blocks: row.blocks, status: row.status, recipientCount: row.recipient_count,
  createdAt: row.created_at, updatedAt: row.updated_at, sentAt: row.sent_at,
});
type DatabaseSubscriber = { id: string; email: string; status: Subscriber['status']; created_at: string; confirmed_at: string | null };
export const subscriberForClient = (row: DatabaseSubscriber): Subscriber => ({ id: row.id, email: row.email, status: row.status, createdAt: row.created_at, confirmedAt: row.confirmed_at });
export const savedSearchForClient = (row: SavedSearch): SavedSearch => row;
