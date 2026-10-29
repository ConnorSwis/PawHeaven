export const SHELTER_TZ = 'America/New_York';

const dateFmt = new Intl.DateTimeFormat(undefined, { timeZone: SHELTER_TZ, month: 'short', day: 'numeric', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat(undefined, { timeZone: SHELTER_TZ, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeZone: SHELTER_TZ, hour: 'numeric', minute: '2-digit' });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatRange = (startsAt: string, endsAt: string) => `${dayFmt.format(new Date(startsAt))} · ${timeFmt.formatRange(new Date(startsAt), new Date(endsAt))}`;
export const formatMoney = (cents: number, currency = 'usd') => new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

/** "3 days ago", "today", for lists where age matters more than the date. */
export function ago(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** The shelter's calendar day for an instant, as YYYY-MM-DD. */
export const shelterDay = (value: string | number | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: SHELTER_TZ }).format(new Date(value));
