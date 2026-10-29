import { useState } from 'react';
import type { AvailabilityRule } from '@pawheaven/contracts';
import { api, errorMessage, useRefresh } from '../../lib/api';
import { Badge, Button, Card, type Column, ConfirmDialog, DataTable, EmptyState, Field, Input } from '../../ui';
import { useToast } from '../../ui/toast';
import { SCHEDULE_PREFIXES, type ScheduleData } from './data';
import { DAYS, niceDay, plural } from './time';

const describe = (rule: AvailabilityRule) => (rule.kind === 'visit' ? `Visits · ${plural(rule.capacity, 'group')} per ${rule.slotMinutes}-minute slot` : `${rule.title} · ${plural(rule.capacity, 'volunteer')}`);

export function OpenHours({ data, onAdd }: { data: ScheduleData; onAdd: () => void }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [deleting, setDeleting] = useState<AvailabilityRule | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (label: string, work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await refresh(...SCHEDULE_PREFIXES); toast.success(label); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  const columns: Column<AvailabilityRule>[] = [
    { key: 'day', header: 'Day', sort: (row) => row.weekday, cell: (row) => <span className={row.active ? 'font-medium text-stone-950' : 'text-stone-500'}>{DAYS[row.weekday]}</span> },
    { key: 'time', header: 'Time', cell: (row) => `${row.startTime}–${row.endTime}` },
    { key: 'what', header: 'What', cell: (row) => describe(row) },
    { key: 'state', header: 'Status', hideBelow: 'sm', cell: (row) => <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Paused'}</Badge> },
    { key: 'actions', header: '', className: 'text-right', cell: (row) => (
      <span className="flex justify-end gap-2">
        <Button size="sm" disabled={busy} onClick={() => void act(row.active ? 'Pattern paused.' : 'Pattern resumed.', () => api(`/admin/availability/rules/${row.id}`, { method: 'PUT', json: { ...row, active: !row.active } }))}>{row.active ? 'Pause' : 'Resume'}</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => setDeleting(row)}>Delete</Button>
      </span>
    ) },
  ];

  return (
    <div className="mt-5 grid gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm leading-6 text-stone-700">Weekly patterns keep the next weeks filled in automatically. Edits you make to a generated item are kept.</p>
          <Button variant="primary" onClick={onAdd}>Add weekly pattern</Button>
        </div>
        <div className="mt-3">
          <DataTable rows={data.rules} columns={columns} rowId={(row) => row.id} loading={data.loading}
            empty={<EmptyState title="No weekly patterns yet">Add visit times or a shift and tick “Repeat every week” to create one.</EmptyState>} />
        </div>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-stone-950">Days closed</h2>
        <p className="mt-1 text-sm text-stone-700">Closing a day removes unused generated times for it. Anything already booked stays.</p>
        {data.exceptions.length === 0 ? <p className="mt-3 text-sm text-stone-700">No closed days coming up.</p> : (
          <ul className="mt-3 grid gap-2">
            {data.exceptions.map((exception) => (
              <li key={exception.date} className="flex items-center justify-between gap-2 border border-stone-300 px-3 py-2 text-sm">
                <span>{niceDay(exception.date)}{exception.reason ? ` · ${exception.reason}` : ''}</span>
                <Button size="sm" disabled={busy} onClick={() => void act('Day reopened. Use “Fill in from open hours” to bring its times back.', () => api(`/admin/availability/exceptions/${exception.date}`, { method: 'DELETE' }))}>Reopen</Button>
              </li>
            ))}
          </ul>
        )}
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault();
          void act('Day closed.', async () => {
            const result = await api<{ visitsRemoved: number; shiftsRemoved: number; kept: number }>('/admin/availability/exceptions', { method: 'POST', json: { date, reason } });
            toast.success(`Removed ${plural(result.visitsRemoved, 'unused visit time')} and ${plural(result.shiftsRemoved, 'empty shift')}${result.kept ? `; ${result.kept} with bookings were kept` : ''}.`);
            setDate(''); setReason('');
          });
        }}>
          <Field label="Date" className="w-44"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Reason" className="min-w-48 flex-1"><Input maxLength={200} value={reason} placeholder="Holiday, training day…" onChange={(event) => setReason(event.target.value)} /></Field>
          <Button type="submit" disabled={busy || !date}>Close this day</Button>
        </form>
      </Card>

      <ConfirmDialog open={Boolean(deleting)} danger title="Delete this weekly pattern?" confirmLabel="Delete pattern" onCancel={() => setDeleting(null)}
        description="Times already created from it stay on the calendar. No new ones are generated."
        onConfirm={async () => { if (deleting) await act('Pattern deleted.', () => api(`/admin/availability/rules/${deleting.id}`, { method: 'DELETE' })); setDeleting(null); }} />
    </div>
  );
}
