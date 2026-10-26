export const shelterTimeZone = 'America/New_York';

const localPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: shelterTimeZone,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function formatterParts(date: Date) {
  const pieces = localPartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(pieces.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Converts a datetime-local value as a New York civil time, rejecting DST gaps and folds. */
export function newYorkInstant(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(naive)) return null;
  const offsets = new Set([naive - 86_400_000, naive, naive + 86_400_000].map((probe) => {
    const parts = formatterParts(new Date(probe));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - probe;
  }));
  const matches = [...offsets].map((offset) => new Date(naive - offset)).filter((candidate) => {
    const parts = formatterParts(candidate);
    return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute;
  });
  return matches.length === 1 ? matches[0].toISOString() : null;
}

/** Formats an instant as a datetime-local value in the shelter timezone. */
export function newYorkLocalInput(instant: string): string {
  const parts = formatterParts(new Date(instant));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatShelterRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 'Unknown time';
  const date = new Intl.DateTimeFormat(undefined, { timeZone: shelterTimeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(start);
  const range = new Intl.DateTimeFormat(undefined, { timeZone: shelterTimeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).formatRange(start, end);
  return `${date} · ${range}`;
}
