// Civil dates and times in the shelter's time zone (America/New_York), independent of the browser's zone.
const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function etParts(iso: string) {
  const pieces = parts.formatToParts(new Date(iso));
  const get = (type: string) => Number(pieces.find((piece) => piece.type === type)?.value);
  const pad = (value: number) => String(value).padStart(2, '0');
  return { date: `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`, minutes: get('hour') * 60 + get('minute') };
}

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const sundayOf = (date: string) => addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay());
export const todayEt = () => etParts(new Date().toISOString()).date;
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export const niceTime = (minutes: number) => { const hour = Math.floor(minutes / 60); return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`; };
export const niceDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
/** Shelter wall-clock time as the "local" ISO string FullCalendar (in UTC mode) shows as-is. */
export const wall = (iso: string) => { const { date, minutes } = etParts(iso); return `${date}T${clock(minutes)}:00`; };
/** A Date from FullCalendar's UTC mode back to "YYYY-MM-DDTHH:mm" wall-clock text. */
export const fromWall = (date: Date) => date.toISOString().slice(0, 16);
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
