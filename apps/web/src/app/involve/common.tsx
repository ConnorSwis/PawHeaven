import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { SHELTER_TIME_ZONE } from '@pawheaven/contracts/ui';
import { cx, ErrorSummary } from '../../ui';
import { PawIcon } from '../../ui/icons';

/**
 * Small pieces shared by the Visit, Volunteer, Foster, and Apply pages: shelter-time formatting,
 * drafts that survive the trip to the sign-in page, the calendar file, and a picture of an animal.
 */

// --- Rendering ---------------------------------------------------------------------------------
/** Shows `fallback` for the server render and first browser render, then the real page (it reads the address and storage). */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <>{ready ? children : fallback}</>;
}

// --- Shelter time ------------------------------------------------------------------------------
const part = (options: Intl.DateTimeFormatOptions, value: string | Date) => new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, ...options }).format(typeof value === 'string' ? new Date(value) : value);

/** `2026-10-30`: the shelter's calendar day for an instant. */
export const dayKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: SHELTER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(typeof value === 'string' ? new Date(value) : value);
export const shelterToday = () => dayKey(new Date());
/** "Friday, October 30" */
export const dayLong = (iso: string) => part({ weekday: 'long', month: 'long', day: 'numeric' }, iso);
/** "Fri, Oct 30" */
export const dayMedium = (iso: string) => part({ weekday: 'short', month: 'short', day: 'numeric' }, iso);
export const weekdayShort = (iso: string) => part({ weekday: 'short' }, iso);
export const monthDay = (iso: string) => part({ month: 'short', day: 'numeric' }, iso);
/** "10:00 AM" */
export const timeOnly = (iso: string) => part({ hour: 'numeric', minute: '2-digit' }, iso);
export const timeRange = (startsAt: string, endsAt: string) => `${timeOnly(startsAt)} to ${timeOnly(endsAt)}`;
export const zoneName = (iso: string) => part({ timeZoneName: 'short' }, iso).split(' ').pop() ?? 'ET';
export const minutesBetween = (startsAt: string, endsAt: string) => Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000);

const utcDay = (key: string) => new Date(`${key}T00:00:00Z`);
/** A plain calendar day such as 2026-11-02 as "November 2, 2026", unaffected by the viewer's time zone. */
export const plainDate = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(key) ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(utcDay(key)) : key);
export const plainMonthDay = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' }).format(utcDay(key));
/** The Monday on or before a calendar day, as a day key. */
export function weekStart(key: string): string {
  const date = utcDay(key);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function addDays(key: string, days: number): string {
  const date = utcDay(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekLabel(startKey: string): string {
  const current = weekStart(shelterToday());
  if (startKey === current) return 'This week';
  if (startKey === addDays(current, 7)) return 'Next week';
  return `Week of ${plainMonthDay(startKey)}`;
}

/** Groups items by a key while keeping first-seen order. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

// --- Shelter facts -----------------------------------------------------------------------------
export const addressLine = `${SHELTER.address.line1}, ${SHELTER.address.city}, ${SHELTER.address.state} ${SHELTER.address.zip}`;
export const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLine)}`;

// --- Drafts kept across the sign-in page ----------------------------------------------------------
export const draftStore = {
  read<T>(key: string): T | null {
    try { const raw = window.sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  },
  write(key: string, value: unknown) {
    try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Drafts are a convenience. */ }
  },
  clear(key: string) {
    try { window.sessionStorage.removeItem(key); } catch { /* Nothing to clear. */ }
  },
};

// --- Calendar file ----------------------------------------------------------------------------------
const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const fold = (line: string) => { const parts: string[] = []; let rest = line; while (rest.length > 74) { parts.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; } parts.push(rest); return parts.join('\r\n'); };

/** One event as an .ics file, built here so nothing has to be fetched. */
export function calendarFile({ uid, title, startsAt, endsAt, description }: { uid: string; title: string; startsAt: string; endsAt: string; description: string }): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PawHeaven//Visit//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${uid}@pawheaven.online`, `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(startsAt)}`, `DTEND:${icsStamp(endsAt)}`, `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(description)}`, `LOCATION:${icsText(`${SHELTER.name}, ${addressLine}`)}`, 'END:VEVENT', 'END:VCALENDAR'];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function downloadFile(filename: string, contents: string, type = 'text/calendar;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Animals -----------------------------------------------------------------------------------------
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
/** "Cadillac, a Labrador mix" */
export const petAlt = (pet: Pet) => { const kind = pet.breed || pet.type || 'animal'; return `${pet.name}, ${article(kind)} ${kind}`; };
export const petFactsLine = (pet: Pet) => [pet.breed || pet.type, pet.age, pet.sex, pet.size].filter(Boolean).join(' · ');
export function petHref(pet: Pick<Pet, 'id' | 'name'>): string {
  const name = pet.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'animal';
  return `/adopt/${name}-${pet.id.slice(0, 8)}`;
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A photo with a fixed shape that falls back to a paw when the animal has no picture or it fails to load. */
export function PetPicture({ pet, className, decorative = false }: { pet: Pet; className?: string; decorative?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!pet.imageUrl || failed) {
    return <div className={cx('flex items-center justify-center bg-stone-200 text-stone-700', className)} {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `No photo of ${pet.name} yet` })}><PawIcon width={24} height={24} /></div>;
  }
  return <img src={pet.imageUrl} alt={decorative ? '' : petAlt(pet)} width={320} height={240} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cx('bg-stone-200 object-cover', className)} />;
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The first problem an API call reported for a form field, if any. */
export const firstError = (errors: Record<string, string> | undefined, ...names: string[]) => names.map((name) => errors?.[name]).find(Boolean);

/**
 * ErrorSummary takes focus every time it renders, which would pull focus out of a field being
 * corrected. Memoized, it only renders (and focuses) when the list of problems is replaced.
 */
export const Problems = memo(ErrorSummary);

/** The step heading takes focus when the step changes, so keyboard and screen reader users land on the new content. */
export function useStepFocus(step: number) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);
  return ref;
}

/** Whole years between a YYYY-MM-DD birth date and today (shelter time), or null when it is not a real date. */
export function ageFrom(dateOfBirth: string): number | null {
  const match = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const today = shelterToday().split('-').map(Number);
  let age = today[0] - year;
  if (today[1] < month || (today[1] === month && today[2] < day)) age -= 1;
  return age;
}
