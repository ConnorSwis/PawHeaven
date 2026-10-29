import { useEffect, useState } from 'react';
import { ApiRequestError, api, errorMessage, useRefresh } from '../../lib/api';
import { newYorkInstant } from '../../../lib/shelter-time';
import { Button, Field, Input, Select, Sheet, Textarea } from '../../ui';
import { useToast } from '../../ui/toast';
import { SCHEDULE_PREFIXES } from './data';
import { todayEt } from './time';

type Kind = 'visit' | 'shift' | 'event';
export type CreateInitial = { date?: string; start?: string; end?: string; kind?: Kind; repeat?: boolean };
const DEFAULT_CAPACITY: Record<Kind, string> = { visit: '2', shift: '4', event: '3' };

/** The one place anything is added to the schedule: visit times, a volunteer shift, or an open house. */
export function CreateSheet({ open, onClose, initial, pets }: { open: boolean; onClose: () => void; initial: CreateInitial; pets: { id: string; name: string; status: string }[] }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [kind, setKind] = useState<Kind>('visit');
  const [date, setDate] = useState(todayEt());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [capacity, setCapacity] = useState('2');
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [title, setTitle] = useState('');
  const [duties, setDuties] = useState('');
  const [minAge, setMinAge] = useState('16');
  const [repeat, setRepeat] = useState(false);
  const [roles, setRoles] = useState('');
  const [petIds, setPetIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Each time the sheet opens, start from what was dragged or asked for.
  useEffect(() => {
    if (!open) return;
    const nextKind = initial.kind ?? 'visit';
    setKind(nextKind); setCapacity(DEFAULT_CAPACITY[nextKind]);
    setDate(initial.date ?? todayEt()); setStart(initial.start ?? '10:00'); setEnd(initial.end ?? '12:00');
    setRepeat(initial.repeat ?? false); setSlotMinutes('30'); setTitle(''); setDuties(''); setMinAge('16'); setRoles(''); setPetIds(new Set()); setError('');
  }, [open, initial]);

  const changeKind = (next: Kind) => { setKind(next); setCapacity(DEFAULT_CAPACITY[next]); setError(''); };

  const submit = async () => {
    setError('');
    const startsAt = newYorkInstant(`${date}T${start}`);
    const endsAt = newYorkInstant(`${date}T${end}`);
    if (!date || !startsAt || !endsAt || end <= start) { setError('Choose a valid day and an end time after the start.'); return; }
    const cap = Number(capacity);
    const minutes = Number(slotMinutes);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    setBusy(true);
    try {
      if (kind === 'visit') {
        if (repeat) {
          await api('/admin/availability/rules', { method: 'POST', json: { kind: 'visit', weekday, startTime: start, endTime: end, capacity: cap, slotMinutes: minutes, weeksAhead: 6 } });
          await api('/admin/availability/generate', { method: 'POST' });
        } else {
          for (let t = Date.parse(startsAt); t + minutes * 60_000 <= Date.parse(endsAt); t += minutes * 60_000) {
            await api('/admin/visit-slots', { method: 'POST', json: { startsAt: new Date(t).toISOString(), endsAt: new Date(t + minutes * 60_000).toISOString(), capacity: cap } });
          }
        }
      } else if (kind === 'shift') {
        if (repeat) {
          await api('/admin/availability/rules', { method: 'POST', json: { kind: 'shift', weekday, startTime: start, endTime: end, capacity: cap, title: title.trim(), description: duties.trim(), minAge: Number(minAge), weeksAhead: 6 } });
          await api('/admin/availability/generate', { method: 'POST' });
        } else {
          await api('/admin/volunteer-shifts', { method: 'POST', json: { title: title.trim(), description: duties.trim(), requirements: '', minAge: Number(minAge), startsAt, endsAt, capacity: cap } });
        }
      } else {
        const roleList = roles.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
          const match = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
          return { title: (match ? match[1] : line).trim(), capacity: match ? Number(match[2]) : 2 };
        });
        await api('/admin/events', { method: 'POST', json: { title: title.trim(), description: duties.trim(), startsAt, endsAt, visitCapacity: cap, slotMinutes: minutes, roles: roleList, petIds: [...petIds] } });
      }
      await refresh(...SCHEDULE_PREFIXES);
      toast.success('Added to the schedule.');
      onClose();
    } catch (exception) {
      setError(exception instanceof ApiRequestError && exception.fieldErrors ? Object.values(exception.fieldErrors).join(' ') : errorMessage(exception));
    } finally { setBusy(false); }
  };

  const availablePets = pets.filter((pet) => pet.status === 'Available');

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Add to the schedule" description="Times are America/New_York."
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Adding…' : 'Add'}</Button></>}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Field label="What are you adding?">
          <Select value={kind} onChange={(event) => changeKind(event.target.value as Kind)}>
            <option value="visit">Visit times</option><option value="shift">Volunteer shift</option><option value="event">Open house or event</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Day"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="From"><Input type="time" required value={start} onChange={(event) => setStart(event.target.value)} /></Field>
          <Field label="To"><Input type="time" required value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
        </div>

        {kind === 'visit' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Groups per slot" help="How many groups can book each slot."><Input type="number" min={1} max={50} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
            <Field label="Slot length (minutes)"><Input type="number" min={15} max={240} step={15} value={slotMinutes} onChange={(event) => setSlotMinutes(event.target.value)} /></Field>
          </div>
        )}
        {kind === 'shift' && (
          <>
            <Field label="Title"><Input value={title} maxLength={100} required onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label="Duties"><Textarea value={duties} maxLength={2000} required rows={3} onChange={(event) => setDuties(event.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How many volunteers"><Input type="number" min={1} max={500} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
              <Field label="Minimum age"><Input type="number" min={0} max={99} value={minAge} onChange={(event) => setMinAge(event.target.value)} /></Field>
            </div>
          </>
        )}
        {kind === 'event' && (
          <>
            <Field label="Event name"><Input value={title} maxLength={100} required onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label="Description"><Textarea value={duties} maxLength={2000} rows={3} onChange={(event) => setDuties(event.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Visit groups per slot" help="0 for no visits."><Input type="number" min={0} max={50} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
              <Field label="Visit slot length (minutes)"><Input type="number" min={15} max={240} step={15} value={slotMinutes} onChange={(event) => setSlotMinutes(event.target.value)} /></Field>
            </div>
            <Field label="Volunteer roles" help={'One per line as "Title x count", for example Greeters x 3.'}><Textarea value={roles} rows={3} placeholder={'Greeters x 3\nDog handlers x 4'} onChange={(event) => setRoles(event.target.value)} /></Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-stone-900">Featured animals</legend>
              <div className="grid max-h-40 gap-1 overflow-y-auto border border-stone-300 p-2 sm:grid-cols-2">
                {availablePets.length === 0 && <p className="text-sm text-stone-600">No available animals to feature.</p>}
                {availablePets.map((pet) => (
                  <label key={pet.id} className="flex items-center gap-2 text-sm text-stone-900">
                    <input type="checkbox" checked={petIds.has(pet.id)} onChange={(event) => setPetIds((current) => { const next = new Set(current); if (event.target.checked) next.add(pet.id); else next.delete(pet.id); return next; })} />{pet.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {kind !== 'event' && (
          <label className="flex items-center gap-2 text-sm text-stone-900"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />Repeat every week (adds it to open hours)</label>
        )}
        {error && <p className="text-sm font-medium text-red-800" role="alert">{error}</p>}
        <button type="submit" className="sr-only" tabIndex={-1}>Add</button>
      </form>
    </Sheet>
  );
}
