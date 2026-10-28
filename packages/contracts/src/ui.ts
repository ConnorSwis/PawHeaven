/**
 * Small browser helpers shared by the public site and the staff portal, so a
 * form field, an API call, or a status badge is written once. This module
 * touches the DOM and `fetch`, so it is imported only from client scripts as
 * `@pawheaven/contracts/ui`, never from the API Worker.
 *
 * Styling uses the `ph-*` classes defined in each app's global.css.
 */
import type { AdoptionApplicationStatus, FieldErrors } from './index';

export const SHELTER_TIME_ZONE = 'America/New_York';

/** A tiny element builder. Text goes in with textContent, so it can never inject markup. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A failed API call. `fieldErrors` names each form field the API rejected. */
export class ApiRequestError extends Error {
  status: number;
  fieldErrors?: FieldErrors;
  constructor(message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Calls the API with the session cookie and throws ApiRequestError with the server's own message on failure. */
export async function apiRequest<T>(apiBase: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...rest,
    headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  const payload = await response.json().catch(() => null) as ({ message?: unknown; fieldErrors?: FieldErrors } & T) | null;
  if (!response.ok) {
    throw new ApiRequestError(typeof payload?.message === 'string' ? payload.message : 'The request could not be completed.', response.status, payload?.fieldErrors);
  }
  return payload as T;
}

export type PillTone = 'neutral' | 'good' | 'warn' | 'later';

export function pill(text: string, tone: PillTone = 'neutral'): HTMLSpanElement {
  return el('span', `ph-pill ph-pill-${tone}`, text);
}

/** One status vocabulary for adoption, foster, lost-pet, and volunteer records. */
export function statusTone(status: string): PillTone {
  if (['Approved', 'Resolved', 'registered', 'booked', 'succeeded'].includes(status)) return 'good';
  if (['In review', 'In progress', 'New', 'pending'].includes(status)) return 'warn';
  return 'neutral';
}

export function statusPill(status: AdoptionApplicationStatus | string): HTMLSpanElement {
  return pill(status, statusTone(status));
}

/** "Thu, Oct 29, 2026 · 9:00 AM – 12:00 PM EDT", always in the shelter's time zone. */
export function formatShelterRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 'Unknown time';
  const date = new Intl.DateTimeFormat(undefined, { timeZone: SHELTER_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(start);
  const range = new Intl.DateTimeFormat(undefined, { timeZone: SHELTER_TIME_ZONE, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).formatRange(start, end);
  return `${date} · ${range}`;
}

export function formatDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown date' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Whole days from now until an instant (negative once it has passed). */
export function daysUntil(value: string, now = Date.now()): number {
  return Math.floor((Date.parse(value) - now) / 86_400_000);
}
