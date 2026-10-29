import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ScheduleEntry, VisitAppointment, VisitAppointmentListResponse, VisitSlotListResponse, VolunteerRegistration, VolunteerRegistrationListResponse } from '@pawheaven/contracts';
import { formatShelterRange } from '@pawheaven/contracts/ui';
import { apiBase } from '../../lib/api';
import { api, errorMessage, useApi } from '../../lib/fetch';
import { Badge, Button, ButtonLink, Field, Select } from '../../ui';
import { CalendarIcon } from '../../ui/icons';
import { ConfirmAction, LoadState, Muted, Row, Section, calendarDay, petPath } from './common';
import { StatusBadge } from './common';

const isFuture = (startsAt: string) => Date.parse(startsAt) > Date.now();

function VisitRow({ visit, slots }: { visit: VisitAppointment; slots: VisitSlotListResponse | undefined }) {
  const queryClient = useQueryClient();
  const [slotId, setSlotId] = useState('');
  const [busy, setBusy] = useState<'move' | 'cancel' | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const open = (slots?.slots ?? []).filter((slot) => slot.available && slot.id !== visit.slotId && Date.parse(slot.startsAt) > Date.now());

  async function run(kind: 'move' | 'cancel') {
    if (kind === 'move' && !slotId) { setError('Choose another open time first.'); return; }
    setBusy(kind); setError(''); setNote('');
    try {
      if (kind === 'move') await api(`/appointments/${encodeURIComponent(visit.id)}`, { method: 'PUT', json: { slotId } });
      else await api(`/appointments/${encodeURIComponent(visit.id)}/cancel`, { method: 'POST' });
      await queryClient.invalidateQueries();
      setNote(kind === 'move' ? 'Your visit was moved. We emailed you the new time.' : 'Your visit was canceled.');
      setSlotId('');
    } catch (exception) { setError(errorMessage(exception)); }
    finally { setBusy(null); }
  }

  return (
    <Row>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-950">Shelter visit <StatusBadge status="booked" /></p>
        <p className="mt-1 text-base text-stone-800">{formatShelterRange(visit.startsAt, visit.endsAt)}</p>
        <p className="mt-1 text-sm text-stone-700">Party of {visit.partySize}</p>
        {visit.pets.length > 0 ? (
          <p className="mt-1 text-sm text-stone-700">Meeting: {visit.pets.map((pet, index) => <span key={pet.id}>{index > 0 && ', '}<a className="font-medium underline underline-offset-4" href={petPath(pet)}>{pet.name}</a></span>)}</p>
        ) : visit.purpose ? <p className="mt-1 text-sm text-stone-700">{visit.purpose}</p> : null}
      </div>
      <div className="grid w-full gap-3 sm:max-w-sm">
        {open.length > 0 ? (
          <div className="grid gap-2">
            <Field label="Move to another open time">
              {(a) => (
                <Select {...a} value={slotId} onChange={(e) => { setSlotId(e.target.value); setError(''); }}>
                  <option value="">Choose a time…</option>
                  {open.map((slot) => <option key={slot.id} value={slot.id}>{formatShelterRange(slot.startsAt, slot.endsAt)}</option>)}
                </Select>
              )}
            </Field>
            <div><Button variant="secondary" disabled={busy !== null} onClick={() => void run('move')}>{busy === 'move' ? 'Moving…' : 'Reschedule'}</Button></div>
          </div>
        ) : <p className="text-sm text-stone-700">No other open times right now. <a className="font-medium underline underline-offset-4" href="/visit">See the visit page</a> later for new times.</p>}
        <ConfirmAction label="Cancel visit" srLabel={`on ${formatShelterRange(visit.startsAt, visit.endsAt)}`} question="Cancel this shelter visit? The time will open for someone else." confirmLabel="Yes, cancel visit" keepLabel="Keep visit" busy={busy === 'cancel'} onConfirm={() => void run('cancel')} />
        {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}
        <p role="status" className="text-sm text-stone-800">{note}</p>
      </div>
    </Row>
  );
}

function ShiftRow({ shift }: { shift: VolunteerRegistration }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    setBusy(true); setError('');
    try { await api(`/volunteer/registrations/${encodeURIComponent(shift.id)}/cancel`, { method: 'POST' }); await queryClient.invalidateQueries(); }
    catch (exception) { setError(errorMessage(exception)); setBusy(false); }
  }
  return (
    <Row>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-950">{shift.title} <StatusBadge status="registered" /></p>
        <p className="mt-1 text-base text-stone-800">{formatShelterRange(shift.startsAt, shift.endsAt)}</p>
        {shift.requirements && <p className="mt-1 text-sm text-stone-700">{shift.requirements}</p>}
      </div>
      <div className="w-full sm:max-w-sm">
        <ConfirmAction label="Cancel sign-up" srLabel={`for ${shift.title}`} question="Cancel this volunteer shift? Your spot will open for someone else." confirmLabel="Yes, cancel sign-up" keepLabel="Keep my spot" busy={busy} onConfirm={() => void cancel()} error={error} />
      </div>
    </Row>
  );
}

function CalendarDownload() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${apiBase}/me/schedule.ics`, { credentials: 'include' });
      if (!response.ok) throw new Error('bad response');
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement('a'), { href: url, download: 'pawheaven-schedule.ics' });
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Your calendar file was downloaded. Open it to add your visits and shifts to your calendar.');
    } catch { setMessage('The calendar file could not be made. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => void download()}><CalendarIcon aria-hidden="true" /> Add to calendar (.ics)</Button>
      <p role="status" className="mt-2 text-sm text-stone-800">{message}</p>
    </div>
  );
}

export function Visits() {
  const appointments = useApi<VisitAppointmentListResponse>('/appointments');
  const slots = useApi<VisitSlotListResponse>('/visit-slots');
  const registrations = useApi<VolunteerRegistrationListResponse>('/volunteer/registrations');
  const schedule = useApi<{ entries: ScheduleEntry[] }>('/me/schedule');

  const allVisits = appointments.data?.appointments ?? [];
  const allShifts = registrations.data?.registrations ?? [];
  const visits = allVisits.filter((item) => item.status === 'booked' && isFuture(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const shifts = allShifts.filter((item) => item.status === 'registered' && isFuture(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const fosters = (schedule.data?.entries ?? []).filter((entry) => entry.kind === 'foster' && Date.parse(entry.endsAt) > Date.now());
  const past = [
    ...allVisits.filter((item) => item.status === 'canceled' || !isFuture(item.startsAt)).map((item) => ({ key: `v${item.id}`, title: 'Shelter visit', when: formatShelterRange(item.startsAt, item.endsAt), note: item.status === 'canceled' ? 'Canceled' : 'Completed', sort: Date.parse(item.startsAt) })),
    ...allShifts.filter((item) => item.status === 'canceled' || !isFuture(item.startsAt)).map((item) => ({ key: `s${item.id}`, title: `Volunteer: ${item.title}`, when: formatShelterRange(item.startsAt, item.endsAt), note: item.status === 'canceled' ? (item.canceledReason === 'shift_canceled' ? 'Canceled by the shelter' : 'Canceled') : 'Completed', sort: Date.parse(item.startsAt) })),
  ].sort((a, b) => b.sort - a.sort);

  return (
    <div className="grid gap-6">
      <Section id="visits" title="Upcoming visits" aside={<a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/visit">Plan a visit</a>}>
        <LoadState query={appointments} label="your visits">
          {visits.length ? (
            <ul>{visits.map((visit) => <VisitRow key={visit.id} visit={visit} slots={slots.data} />)}</ul>
          ) : (
            <div><Muted>You have no visits booked. Plan a visit to meet the animals in person.</Muted><div className="mt-3"><ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink></div></div>
          )}
        </LoadState>
      </Section>

      <Section id="shifts" title="Volunteer shifts" aside={<a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/volunteer">Find a shift</a>}>
        <LoadState query={registrations} label="your volunteer shifts">
          {shifts.length ? <ul>{shifts.map((shift) => <ShiftRow key={shift.id} shift={shift} />)}</ul> : (
            <div><Muted>You have not signed up for a shift. Volunteers walk dogs, socialize cats, and help around the shelter.</Muted><div className="mt-3"><ButtonLink variant="secondary" href="/volunteer">See volunteer shifts</ButtonLink></div></div>
          )}
        </LoadState>
      </Section>

      {fosters.length > 0 && (
        <Section id="placements" title="Foster placements">
          <ul>{fosters.map((entry) => (
            <Row key={entry.id}>
              <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{entry.title}</p><p className="mt-1 text-base text-stone-800">{calendarDay(entry.startsAt.slice(0, 10))} to {calendarDay(new Date(Date.parse(entry.endsAt) - 86_400_000).toISOString().slice(0, 10))}</p>{entry.detail && <p className="mt-1 text-sm text-stone-700">{entry.detail}</p>}</div>
              <Badge tone="good">Foster</Badge>
            </Row>
          ))}</ul>
        </Section>
      )}

      <Section id="calendar" title="Your calendar">
        <Muted className="mb-3">Download your upcoming visits, volunteer shifts, and foster placements to add them to your own calendar app.</Muted>
        <CalendarDownload />
      </Section>

      <Section id="history" title="History">
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-stone-950">Past and canceled ({past.length})</summary>
          {past.length ? (
            <ul className="mt-2">{past.map((item) => (
              <Row key={item.key}><div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.title}</p><p className="mt-1 text-sm text-stone-700">{item.when}</p></div><Badge>{item.note}</Badge></Row>
            ))}</ul>
          ) : <Muted className="mt-2">Past and canceled visits and shifts will appear here.</Muted>}
        </details>
      </Section>
    </div>
  );
}
