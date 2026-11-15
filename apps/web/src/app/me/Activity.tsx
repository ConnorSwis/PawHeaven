import type { AdoptionApplicationListResponse, FosterApplicationListResponse, LostPetInquiryListResponse, ScheduleEntry, VisitAppointmentListResponse, VisitSlotListResponse, VolunteerRegistrationListResponse } from '@pawheaven/contracts';
import { formatShelterRange } from '@pawheaven/contracts/ui';
import { useApi } from '../../lib/fetch';
import { Badge, ButtonLink, EmptyState } from '../../ui';
import { CalendarDownload, ShiftRow, VisitRow } from './Visits';
import { LoadState, Link, Row, Section, StatusBadge, calendarDay, dayOnly } from './common';

const isFuture = (startsAt: string) => Date.parse(startsAt) > Date.now();
const byStart = (a: { startsAt: string }, b: { startsAt: string }) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

/** Everything the member has going on or has done: what is coming up, their applications, and what is over. */
export function Activity() {
  const appointments = useApi<VisitAppointmentListResponse>('/appointments');
  const slots = useApi<VisitSlotListResponse>('/visit-slots');
  const registrations = useApi<VolunteerRegistrationListResponse>('/volunteer/registrations');
  const schedule = useApi<{ entries: ScheduleEntry[] }>('/me/schedule');
  const adoption = useApi<AdoptionApplicationListResponse>('/applications');
  const foster = useApi<FosterApplicationListResponse>('/foster-applications');
  const inquiries = useApi<LostPetInquiryListResponse>('/lost-pet/inquiries');

  const allVisits = appointments.data?.appointments ?? [];
  const allShifts = registrations.data?.registrations ?? [];
  const visits = allVisits.filter((item) => item.status === 'booked' && isFuture(item.startsAt)).sort(byStart);
  const shifts = allShifts.filter((item) => item.status === 'registered' && isFuture(item.startsAt)).sort(byStart);
  const fosters = (schedule.data?.entries ?? []).filter((entry) => entry.kind === 'foster' && Date.parse(entry.endsAt) > Date.now());
  const nothingBooked = !visits.length && !shifts.length && !fosters.length;

  const applications = [
    ...(adoption.data?.applications ?? []).map((item) => ({ key: `a${item.id}`, title: `Adopt ${item.petName}`, detail: `Applied ${dayOnly(item.submittedAt)}`, status: item.status, at: Date.parse(item.submittedAt) })),
    ...(foster.data?.applications ?? []).map((item) => ({ key: `f${item.id}`, title: `Foster ${item.petName}`, detail: `${calendarDay(item.availableFrom)} to ${calendarDay(item.availableUntil)}`, status: item.status, at: Date.parse(item.submittedAt) })),
    ...(inquiries.data?.inquiries ?? []).map((item) => ({ key: `l${item.id}`, title: `Lost pet: asked about ${item.petName}`, detail: `Sent ${dayOnly(item.createdAt)}`, status: item.status, at: Date.parse(item.createdAt) })),
  ].sort((a, b) => b.at - a.at);

  const past = [
    ...allVisits.filter((item) => item.status === 'canceled' || !isFuture(item.startsAt)).map((item) => ({ key: `v${item.id}`, title: 'Shelter visit', when: formatShelterRange(item.startsAt, item.endsAt), note: item.status === 'canceled' ? 'Canceled' : 'Done', sort: Date.parse(item.startsAt) })),
    ...allShifts.filter((item) => item.status === 'canceled' || !isFuture(item.startsAt)).map((item) => ({ key: `s${item.id}`, title: item.title, when: formatShelterRange(item.startsAt, item.endsAt), note: item.status === 'canceled' ? (item.canceledReason === 'shift_canceled' ? 'Canceled by shelter' : 'Canceled') : 'Done', sort: Date.parse(item.startsAt) })),
  ].sort((a, b) => b.sort - a.sort);

  return (
    <div className="grid gap-6">
      <Section id="upcoming" title="Coming up" aside={!nothingBooked ? <CalendarDownload /> : undefined}>
        <LoadState query={appointments} label="your visits">
          {nothingBooked ? (
            <EmptyState pose="sleeping" title="Nothing booked" action={<div className="flex flex-wrap justify-center gap-3"><ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink><ButtonLink variant="secondary" href="/volunteer">Find a shift</ButtonLink></div>}>
              Meet the animals or lend a hand.
            </EmptyState>
          ) : (
            <ul className="grid gap-4">
              {visits.map((visit) => <VisitRow key={visit.id} visit={visit} slots={slots.data} />)}
              {shifts.map((shift) => <ShiftRow key={shift.id} shift={shift} />)}
              {fosters.map((entry) => (
                <Row key={entry.id} className="rounded-[var(--ph-radius)] border border-stone-300 p-4 first:pt-4 last:pb-4"><div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{entry.title}</p><p className="mt-1 text-sm text-stone-700">{calendarDay(entry.startsAt.slice(0, 10))} to {calendarDay(new Date(Date.parse(entry.endsAt) - 86_400_000).toISOString().slice(0, 10))}</p></div><Badge tone="good">Foster</Badge></Row>
              ))}
            </ul>
          )}
        </LoadState>
      </Section>

      <Section id="applications" title="Applications" aside={<Link href="/adopt">Meet the animals</Link>}>
        <LoadState query={adoption} label="your applications">
          {applications.length ? (
            <ul>{applications.map((item) => (
              <Row key={item.key} className="items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.title}</p><p className="mt-0.5 text-sm text-stone-700">{item.detail}</p></div><StatusBadge status={item.status} /></Row>
            ))}</ul>
          ) : <p className="text-base text-stone-700">No applications yet. Apply from an animal's page.</p>}
        </LoadState>
      </Section>

      {past.length > 0 && (
        <Section id="history" title="Earlier">
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-stone-950">Show {past.length}</summary>
            <ul className="mt-2">{past.map((item) => (
              <Row key={item.key} className="items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.title}</p><p className="mt-0.5 text-sm text-stone-700">{item.when}</p></div><Badge>{item.note}</Badge></Row>
            ))}</ul>
          </details>
        </Section>
      )}
    </div>
  );
}
