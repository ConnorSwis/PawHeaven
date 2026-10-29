import { useState } from 'react';
import type { AdminVisitAppointment, AdminVisitSlot, AdminVolunteerShift, FieldErrors } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, useRefresh } from '../../lib/api';
import { newYorkInstant, newYorkLocalInput } from '../../../lib/shelter-time';
import { Badge, Button, ConfirmDialog, Detail, Field, Input, Sheet, StatusBadge, Textarea } from '../../ui';
import { useToast } from '../../ui/toast';
import { SCHEDULE_PREFIXES } from './data';
import { etParts, niceDay, niceTime, plural } from './time';

function AppointmentCard({ appointment }: { appointment: AdminVisitAppointment }) {
  return (
    <div className="border border-stone-300 p-3 text-sm">
      <p className="font-semibold text-stone-950">{appointment.memberName} · party of {appointment.partySize}</p>
      <p className="text-stone-700">{appointment.memberEmail}</p>
      {appointment.pets.length > 0 && <p className="mt-1 text-stone-900">Meeting: {appointment.pets.map((pet) => pet.name).join(', ')}</p>}
      <p className="mt-1 text-stone-700">{appointment.purpose}</p>
    </div>
  );
}

function SlotPanel({ slot }: { slot: AdminVisitSlot }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [capacity, setCapacity] = useState(String(slot.capacity));
  const [busy, setBusy] = useState(false);
  const act = async (label: string, work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await refresh(...SCHEDULE_PREFIXES); toast.success(label); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-3 border-t border-stone-200 p-3">
      <p className="text-sm text-stone-700">Holds {plural(slot.capacity, 'group')}; {slot.appointments.length} booked.</p>
      <div className="flex flex-wrap gap-2">
        {slot.eventId && <Badge>Part of an event</Badge>}
        {slot.ruleId && <Badge>Generated from open hours</Badge>}
      </div>
      {slot.appointments.length === 0 ? <p className="text-sm text-stone-700">Nobody has booked this time yet.</p> : slot.appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Capacity (groups)" className="w-40"><Input type="number" min={Math.max(1, slot.appointments.length)} max={50} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
        <Button disabled={busy || Number(capacity) === slot.capacity} onClick={() => void act('Capacity updated.', () => api(`/admin/visit-slots/${slot.id}/capacity`, { method: 'PUT', json: { capacity: Number(capacity) } }))}>Save capacity</Button>
        {slot.appointments.length === 0 && <Button variant="danger" disabled={busy} onClick={() => void act('Visit time withdrawn.', () => api(`/admin/visit-slots/${slot.id}/withdraw`, { method: 'POST' }))}>Withdraw this time</Button>}
      </div>
    </div>
  );
}

/** One merged block on the calendar: every slot inside it with its bookings, capacity, and withdraw control. */
export function VisitSheet({ slots, onClose }: { slots: AdminVisitSlot[]; onClose: () => void }) {
  const first = slots[0];
  const day = first ? etParts(first.startsAt) : null;
  const last = slots[slots.length - 1];
  return (
    <Sheet open={slots.length > 0} onOpenChange={(open) => { if (!open) onClose(); }} title={first?.eventId ? 'Visit times (event)' : 'Visit times'}
      description={first && day && last ? `${niceDay(day.date)} · ${niceTime(day.minutes)} – ${niceTime(etParts(last.endsAt).minutes)}` : undefined}>
      <div className="grid gap-2">
        {slots.map((slot) => (
          <details key={slot.id} className="border border-stone-300" open={slots.length === 1}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium text-stone-950">{niceTime(etParts(slot.startsAt).minutes)} – {niceTime(etParts(slot.endsAt).minutes)}</span>
              <Badge tone={slot.appointments.length >= slot.capacity ? 'warn' : 'good'}>{slot.appointments.length}/{slot.capacity} booked</Badge>
            </summary>
            <SlotPanel slot={slot} />
          </details>
        ))}
      </div>
    </Sheet>
  );
}

function ShiftForm({ shift, onDone }: { shift: AdminVolunteerShift; onDone: () => void }) {
  const toast = useToast();
  const refresh = useRefresh();
  const locked = shift.participants.length > 0;
  const [form, setForm] = useState({ title: shift.title, description: shift.description, requirements: shift.requirements, startsAt: newYorkLocalInput(shift.startsAt), endsAt: newYorkLocalInput(shift.endsAt), capacity: String(shift.capacity), minAge: String(shift.minAge) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    const startsAt = newYorkInstant(form.startsAt);
    const endsAt = newYorkInstant(form.endsAt);
    const problems: FieldErrors = {};
    if (!form.startsAt) problems.startsAt = 'Choose a start time.'; else if (!startsAt) problems.startsAt = 'Choose an unambiguous America/New_York time; this one falls in a daylight-saving transition.';
    if (!form.endsAt) problems.endsAt = 'Choose an end time.'; else if (!endsAt) problems.endsAt = 'Choose an unambiguous America/New_York time; this one falls in a daylight-saving transition.';
    setErrors(problems);
    if (Object.keys(problems).length || !startsAt || !endsAt) return;
    setBusy(true);
    try {
      await api(`/admin/volunteer-shifts/${encodeURIComponent(shift.id)}`, { method: 'PUT', json: { title: form.title.trim(), description: form.description.trim(), requirements: form.requirements.trim(), minAge: Number(form.minAge), capacity: Number(form.capacity), startsAt, endsAt } });
      await refresh(...SCHEDULE_PREFIXES);
      toast.success('Shift saved.');
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(errorMessage(error, 'We could not save that shift.'));
    } finally { setBusy(false); }
  };

  return (
    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label="Title" error={errors.title}><Input value={form.title} maxLength={100} required onChange={set('title')} /></Field>
      <Field label="Duties" error={errors.description}><Textarea value={form.description} maxLength={2000} required rows={3} onChange={set('description')} /></Field>
      <Field label="Requirements" help="Optional, such as footwear or training." error={errors.requirements}><Textarea value={form.requirements} maxLength={1000} rows={2} onChange={set('requirements')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" error={errors.startsAt}><Input type="datetime-local" required disabled={locked} value={form.startsAt} onChange={set('startsAt')} /></Field>
        <Field label="Ends" error={errors.endsAt}><Input type="datetime-local" required disabled={locked} value={form.endsAt} onChange={set('endsAt')} /></Field>
        <Field label="Capacity" error={errors.capacity}><Input type="number" min={Math.max(1, shift.participants.length)} max={500} required value={form.capacity} onChange={set('capacity')} /></Field>
        <Field label="Minimum age" error={errors.minAge}><Input type="number" min={0} max={99} disabled={locked} value={form.minAge} onChange={set('minAge')} /></Field>
      </div>
      {locked && <p className="text-sm leading-6 text-stone-700">Volunteers have registered, so the time and minimum age are locked. Capacity cannot go below the number registered.</p>}
      <div className="flex gap-2"><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button><Button onClick={onDone} disabled={busy}>Cancel</Button></div>
    </form>
  );
}

export function ShiftSheet({ shift, onClose }: { shift: AdminVolunteerShift | null; onClose: () => void }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const upcoming = shift ? Date.parse(shift.startsAt) > Date.now() : false;
  const close = () => { setEditing(false); setConfirm(false); onClose(); };

  const cancelShift = async () => {
    if (!shift) return;
    try {
      await api(`/admin/volunteer-shifts/${encodeURIComponent(shift.id)}/cancel`, { method: 'POST' });
      await refresh(...SCHEDULE_PREFIXES);
      toast.success('Shift canceled.');
      setConfirm(false);
      close();
    } catch (error) { toast.error(errorMessage(error, 'We could not cancel this shift.')); setConfirm(false); }
  };

  const when = shift ? `${niceDay(etParts(shift.startsAt).date)} · ${niceTime(etParts(shift.startsAt).minutes)} – ${niceTime(etParts(shift.endsAt).minutes)}` : '';
  return (
    <Sheet open={Boolean(shift)} onOpenChange={(open) => { if (!open) close(); }} title={shift?.title ?? 'Shift'} description={when}
      footer={shift && upcoming && !editing ? <><Button variant="danger" onClick={() => setConfirm(true)}>Cancel shift</Button><span className="flex-1" /><Button variant="primary" onClick={() => setEditing(true)}>Edit shift</Button></> : undefined}>
      {shift && (editing ? <ShiftForm key={shift.id} shift={shift} onDone={() => setEditing(false)} /> : (
        <div className="grid gap-5">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Signed up"><StatusBadge status={shift.participants.length >= shift.capacity ? 'Pending' : 'Open'} label={`${shift.participants.length} of ${shift.capacity}`} /></Detail>
            <Detail label="Minimum age">{shift.minAge ? `${shift.minAge}+` : 'No minimum'}</Detail>
          </dl>
          <div><h3 className="text-sm font-semibold text-stone-950">Duties</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{shift.description}</p></div>
          {shift.requirements && <div><h3 className="text-sm font-semibold text-stone-950">Requirements</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{shift.requirements}</p></div>}
          <div className="border-t border-stone-200 pt-4">
            <h3 className="text-sm font-semibold text-stone-950">Volunteers</h3>
            {shift.participants.length === 0 ? <p className="mt-1 text-sm text-stone-700">No one has signed up yet.</p> : (
              <ul className="mt-2 grid gap-2">
                {shift.participants.map((person) => <li key={person.id} className="border border-stone-300 p-2 text-sm"><span className="font-medium text-stone-950">{person.memberName}</span><span className="block text-stone-700">{person.memberEmail} · {person.memberPhone}</span></li>)}
              </ul>
            )}
          </div>
          <ConfirmDialog open={confirm} danger title="Cancel this shift?" confirmLabel="Cancel shift" onCancel={() => setConfirm(false)} onConfirm={cancelShift}
            description={shift.participants.length ? <>This cancels {plural(shift.participants.length, 'registration')} and emails each volunteer.</> : <>It will no longer be available to volunteers.</>} />
        </div>
      ))}
    </Sheet>
  );
}
