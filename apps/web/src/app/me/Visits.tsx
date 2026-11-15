import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { VisitAppointment, VisitSlotListResponse, VolunteerRegistration } from '@pawheaven/contracts';
import { formatShelterRange } from '@pawheaven/contracts/ui';
import { apiBase } from '../../lib/api';
import { api, errorMessage } from '../../lib/fetch';
import { Button, Field, Select, TicketCard } from '../../ui';
import { CalendarIcon } from '../../ui/icons';
import { ConfirmAction, petPath } from './common';
import { StatusBadge } from './common';

export function VisitRow({ visit, slots }: { visit: VisitAppointment; slots: VisitSlotListResponse | undefined }) {
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
    <li>
      <TicketCard stub={
        <div className="grid gap-3 sm:max-w-sm">
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-[var(--ph-brand-strong)]">Change time</summary>
            <div className="pt-2">
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
            </div>
          </details>
          <ConfirmAction label="Cancel visit" srLabel={`on ${formatShelterRange(visit.startsAt, visit.endsAt)}`} question="Cancel this shelter visit? The time will open for someone else." confirmLabel="Yes, cancel visit" keepLabel="Keep visit" busy={busy === 'cancel'} onConfirm={() => void run('cancel')} />
          {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}
          <p role="status" className="text-sm text-stone-800">{note}</p>
        </div>
      }>
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-stone-950">Shelter visit <StatusBadge status="booked" /></p>
        <p className="mt-1 text-base text-stone-800">{formatShelterRange(visit.startsAt, visit.endsAt)}</p>
        <p className="mt-1 text-sm text-stone-700">Party of {visit.partySize}</p>
        {visit.pets.length > 0 ? (
          <p className="mt-1 text-sm text-stone-700">Meeting: {visit.pets.map((pet, index) => <span key={pet.id}>{index > 0 && ', '}<a className="font-medium underline underline-offset-4" href={petPath(pet)}>{pet.name}</a></span>)}</p>
        ) : visit.purpose ? <p className="mt-1 text-sm text-stone-700">{visit.purpose}</p> : null}
      </TicketCard>
    </li>
  );
}

export function ShiftRow({ shift }: { shift: VolunteerRegistration }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    setBusy(true); setError('');
    try { await api(`/volunteer/registrations/${encodeURIComponent(shift.id)}/cancel`, { method: 'POST' }); await queryClient.invalidateQueries(); }
    catch (exception) { setError(errorMessage(exception)); setBusy(false); }
  }
  return (
    <li>
      <TicketCard stub={<div className="sm:max-w-sm"><ConfirmAction label="Cancel sign-up" srLabel={`for ${shift.title}`} question="Cancel this volunteer shift? Your spot will open for someone else." confirmLabel="Yes, cancel sign-up" keepLabel="Keep my spot" busy={busy} onConfirm={() => void cancel()} error={error} /></div>}>
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-stone-950">{shift.title} <StatusBadge status="registered" /></p>
        <p className="mt-1 text-base text-stone-800">{formatShelterRange(shift.startsAt, shift.endsAt)}</p>
        {shift.requirements && <p className="mt-1 text-sm text-stone-700">{shift.requirements}</p>}
      </TicketCard>
    </li>
  );
}

export function CalendarDownload() {
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
      setMessage('Downloaded. Open the file to add it to your calendar.');
    } catch { setMessage('The calendar file could not be made. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => void download()}><CalendarIcon aria-hidden="true" /> Add to calendar</Button>
      <p role="status" className="mt-2 text-sm text-stone-800">{message}</p>
    </div>
  );
}
