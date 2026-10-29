import type {
  AttentionItem,
  AvailabilityRule,
  AvailabilityRuleInput,
  EventInput,
  EventRoleInput,
  FieldErrors,
  GetInvolvedFeed,
  PublicAvailability,
  MemberFosterRequest,
  MyInvolvement,
  PetFlagsInput,
  ScheduleEntry,
  ShelterEvent,
  VolunteerFosterCandidate,
} from '@pawheaven/contracts';
import { isoInstant, UUID_PATTERN } from './http.ts';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DatabaseRule = {
  id: string;
  kind: 'visit' | 'shift';
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  slot_minutes: number;
  title: string;
  description: string;
  requirements: string;
  min_age: number;
  weeks_ahead: number;
  active: boolean;
};

export function ruleForClient(row: DatabaseRule): AvailabilityRule {
  return {
    id: row.id, kind: row.kind, weekday: row.weekday, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5),
    capacity: row.capacity, slotMinutes: row.slot_minutes, title: row.title, description: row.description, requirements: row.requirements,
    minAge: row.min_age, weeksAhead: row.weeks_ahead, active: row.active,
  };
}

export function ruleInput(body: unknown): { value: AvailabilityRuleInput } | { fieldErrors: FieldErrors } {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string).trim() : '');
  const whole = (key: string, fallback: number) => (input[key] === undefined ? fallback : Number(input[key]));
  const errors: FieldErrors = {};
  const kind = input.kind === 'shift' ? 'shift' : input.kind === 'visit' ? 'visit' : null;
  if (!kind) errors.kind = 'Choose visits or volunteer shifts.';
  const weekday = whole('weekday', -1);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) errors.weekday = 'Choose a day of the week.';
  const startTime = text('startTime');
  const endTime = text('endTime');
  if (!TIME_PATTERN.test(startTime)) errors.startTime = 'Enter a start time.';
  if (!TIME_PATTERN.test(endTime) || endTime <= startTime) errors.endTime = 'Enter an end time after the start.';
  const capacity = whole('capacity', 1);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > (kind === 'visit' ? 50 : 500)) errors.capacity = 'Enter a capacity.';
  const slotMinutes = whole('slotMinutes', 30);
  if (kind === 'visit' && (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240)) errors.slotMinutes = 'Slots are 15 to 240 minutes.';
  const title = text('title');
  const description = text('description');
  if (kind === 'shift' && (title.length < 1 || title.length > 100)) errors.title = 'Enter a shift title, up to 100 characters.';
  if (kind === 'shift' && (description.length < 1 || description.length > 2000)) errors.description = 'Describe the duties, up to 2000 characters.';
  const requirements = text('requirements');
  if (requirements.length > 1000) errors.requirements = 'Keep requirements under 1000 characters.';
  const minAge = whole('minAge', 0);
  if (!Number.isInteger(minAge) || minAge < 0 || minAge > 99) errors.minAge = 'Enter a minimum age from 0 to 99.';
  const weeksAhead = whole('weeksAhead', 6);
  if (!Number.isInteger(weeksAhead) || weeksAhead < 1 || weeksAhead > 12) errors.weeksAhead = 'Generate 1 to 12 weeks ahead.';
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { kind: kind!, weekday, startTime, endTime, capacity, slotMinutes: Number.isInteger(slotMinutes) ? slotMinutes : 30, title, description, requirements, minAge, weeksAhead, active: input.active !== false } };
}

export function exceptionInput(body: unknown): { value: { date: string; reason: string } } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const date = typeof input.date === 'string' ? input.date : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 200) : '';
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { message: 'Choose a date.' };
  return { value: { date, reason } };
}

export function copyWeekInput(body: unknown): { value: { from: string; to: string } } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const from = typeof input.fromWeek === 'string' ? input.fromWeek : '';
  const to = typeof input.toWeek === 'string' ? input.toWeek : '';
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return { message: 'Choose the week to copy and the week to copy it onto.' };
  return { value: { from, to } };
}

export function eventInput(body: unknown): { value: EventInput } | { fieldErrors: FieldErrors } {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (title.length < 1 || title.length > 100) errors.title = 'Enter an event name, up to 100 characters.';
  if (description.length > 2000) errors.description = 'Keep the description under 2000 characters.';
  const startsAt = isoInstant(input.startsAt);
  const endsAt = isoInstant(input.endsAt);
  if (!startsAt || !endsAt || Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(endsAt) - Date.parse(startsAt) > 86_400_000) errors.startsAt = 'Choose a future event that ends after it starts and lasts no more than 24 hours.';
  const visitCapacity = input.visitCapacity === undefined ? 0 : Number(input.visitCapacity);
  if (!Number.isInteger(visitCapacity) || visitCapacity < 0 || visitCapacity > 50) errors.visitCapacity = 'Visit capacity is 0 to 50 groups per slot.';
  const slotMinutes = input.slotMinutes === undefined ? 30 : Number(input.slotMinutes);
  if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240) errors.slotMinutes = 'Visit slots are 15 to 240 minutes.';
  const rolesRaw = Array.isArray(input.roles) ? input.roles : [];
  const roles: EventRoleInput[] = [];
  if (rolesRaw.length > 10) errors.roles = 'Add up to 10 volunteer roles.';
  for (const raw of rolesRaw.slice(0, 10)) {
    const role = (raw ?? {}) as Record<string, unknown>;
    const roleTitle = typeof role.title === 'string' ? role.title.trim() : '';
    const capacity = Number(role.capacity);
    const minAge = role.minAge === undefined ? 0 : Number(role.minAge);
    if (roleTitle.length < 1 || roleTitle.length > 100 || !Number.isInteger(capacity) || capacity < 1 || capacity > 500 || !Number.isInteger(minAge) || minAge < 0 || minAge > 99) {
      errors.roles = 'Each volunteer role needs a title, a capacity, and a valid minimum age.';
      break;
    }
    roles.push({ title: roleTitle, description: typeof role.description === 'string' ? role.description.trim().slice(0, 2000) : '', requirements: typeof role.requirements === 'string' ? role.requirements.trim().slice(0, 1000) : '', capacity, minAge });
  }
  const petIds = Array.isArray(input.petIds) ? [...new Set(input.petIds.filter((id): id is string => typeof id === 'string'))] : [];
  if (petIds.length > 30 || petIds.some((id) => !UUID_PATTERN.test(id))) errors.petIds = 'Feature up to 30 pets.';
  if (!visitCapacity && !roles.length) errors.visitCapacity = 'Add visits, volunteer roles, or both.';
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { title, description, startsAt: startsAt!, endsAt: endsAt!, visitCapacity, slotMinutes, roles, petIds } };
}

export function petFlagsInput(body: unknown): { value: PetFlagsInput } | { message: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const petIds = Array.isArray(input.petIds) ? [...new Set(input.petIds.filter((id): id is string => typeof id === 'string'))] : [];
  if (petIds.length < 1 || petIds.length > 200 || petIds.some((id) => !UUID_PATTERN.test(id))) return { message: 'Choose between 1 and 200 pets.' };
  const flag = (key: string) => (typeof input[key] === 'boolean' ? (input[key] as boolean) : undefined);
  const value: PetFlagsInput = { petIds, fosterAvailable: flag('fosterAvailable'), visitsOpen: flag('visitsOpen'), needsWalkers: flag('needsWalkers') };
  if (value.fosterAvailable === undefined && value.visitsOpen === undefined && value.needsWalkers === undefined) return { message: 'Choose a setting to change.' };
  return { value };
}

export function eventForClient(row: { id: string; title: string; description: string; starts_at: string; ends_at: string; featured_pet_ids?: string[] }, petsById: Map<string, string>): ShelterEvent {
  return {
    id: row.id, title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at,
    pets: (row.featured_pet_ids ?? []).flatMap((id) => (petsById.has(id) ? [{ id, name: petsById.get(id)! }] : [])),
  };
}

export function candidateForClient(row: { member_id: string; member_name: string; member_email: string; shifts: number; hours: number | string; invited: boolean }): VolunteerFosterCandidate {
  return { memberId: row.member_id, name: row.member_name, email: row.member_email, shifts: row.shifts, hours: Number(row.hours), invited: row.invited };
}

export function memberFosterRequestForClient(row: { request_id: string; pet_id: string; pet_name: string; pet_species: string; note: string; created_at: string; response: MemberFosterRequest['response'] }): MemberFosterRequest {
  return { id: row.request_id, petId: row.pet_id, petName: row.pet_name, species: row.pet_species, note: row.note, createdAt: row.created_at, response: row.response };
}

export function scheduleEntryForClient(row: { kind: ScheduleEntry['kind']; ref_id: string; title: string; detail: string; starts_at: string; ends_at: string; all_day: boolean }): ScheduleEntry {
  return { kind: row.kind, id: row.ref_id, title: row.title, detail: row.detail, startsAt: row.starts_at, endsAt: row.ends_at, allDay: row.all_day };
}

export const attentionForClient = (items: unknown): AttentionItem[] => (Array.isArray(items) ? (items as AttentionItem[]) : []);
export const involvementForClient = (value: unknown): MyInvolvement => value as MyInvolvement;
export const feedForClient = (value: unknown): GetInvolvedFeed => value as GetInvolvedFeed;
export const availabilityForClient = (value: unknown): PublicAvailability => value as PublicAvailability;

// --- iCalendar -------------------------------------------------------------------------------

const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');

function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) { parts.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  parts.push(rest);
  return parts.join('\r\n');
}

/** One VEVENT per entry. All-day foster placements use DATE values in the shelter's local days. */
export function scheduleToIcs(entries: ScheduleEntry[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PawHeaven//My schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const entry of entries) {
    lines.push('BEGIN:VEVENT', `UID:${entry.kind}-${entry.id}@pawheaven.online`, `DTSTAMP:${icsStamp(now.toISOString())}`);
    if (entry.allDay) {
      const localDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso)).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${localDay(entry.startsAt)}`, `DTEND;VALUE=DATE:${localDay(entry.endsAt)}`);
    } else {
      lines.push(`DTSTART:${icsStamp(entry.startsAt)}`, `DTEND:${icsStamp(entry.endsAt)}`);
    }
    lines.push(`SUMMARY:${icsText(entry.title)}`);
    if (entry.detail) lines.push(`DESCRIPTION:${icsText(entry.detail)}`);
    lines.push('LOCATION:PawHeaven animal shelter', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

