import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage, useRefresh } from '../lib/api';
import { useRoute } from '../lib/router';
import { Button, PageHeader, Tabs } from '../ui';
import { useToast } from '../ui/toast';
import { CalendarView, type CalendarHandle, type Selection } from './schedule/CalendarView';
import { CreateSheet, type CreateInitial } from './schedule/CreateSheet';
import { SCHEDULE_PREFIXES, useScheduleData } from './schedule/data';
import { ShiftSheet, VisitSheet } from './schedule/DetailSheets';
import { Events } from './schedule/Events';
import { OpenHours } from './schedule/OpenHours';
import { addDays, plural, sundayOf, todayEt } from './schedule/time';

type Tab = 'calendar' | 'hours' | 'events';

export default function Schedule() {
  const { params, setParams } = useRoute();
  const toast = useToast();
  const refresh = useRefresh();
  const data = useScheduleData();
  const tab: Tab = params.get('tab') === 'hours' ? 'hours' : params.get('tab') === 'events' ? 'events' : 'calendar';
  const handle = useRef<CalendarHandle | null>(null);
  const [create, setCreate] = useState<{ open: boolean; initial: CreateInitial }>({ open: false, initial: {} });
  const [visitIds, setVisitIds] = useState<string[]>([]);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openCreate = (initial: CreateInitial = {}) => setCreate({ open: true, initial });
  // The command palette and Home link here with ?add=1.
  useEffect(() => {
    if (params.get('add')) { openCreate(); setParams({ add: null }, { replace: true }); }
  }, [params, setParams]);

  const visitSlots = useMemo(() => data.slots.filter((slot) => visitIds.includes(slot.id)), [data.slots, visitIds]);
  const shift = data.shifts.find((item) => item.id === shiftId) ?? null;

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try { const message = await work(); await refresh(...SCHEDULE_PREFIXES); toast.success(message); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const copyWeek = () => run(async () => {
    const weekStart = sundayOf(handle.current?.currentDate() ?? todayEt());
    const result = await api<{ visitsCreated: number; shiftsCreated: number }>('/admin/schedule/copy-week', { method: 'POST', json: { fromWeek: weekStart, toWeek: addDays(weekStart, 7) } });
    handle.current?.next();
    return `Copied: ${plural(result.visitsCreated, 'visit time')} and ${plural(result.shiftsCreated, 'shift')} added to next week.`;
  });
  const generate = () => run(async () => {
    const result = await api<{ visitsCreated: number; shiftsCreated: number }>('/admin/availability/generate', { method: 'POST' });
    return `Open hours filled in: ${plural(result.visitsCreated, 'visit time')} and ${plural(result.shiftsCreated, 'shift')} added.`;
  });

  return (
    <div>
      <PageHeader title="Schedule" description="Visit times, volunteer shifts, and open houses. Drag across empty space on the calendar to add something, or click an item to manage it. Times are America/New_York."
        actions={<><Button onClick={() => void copyWeek()} disabled={busy}>Copy this week to the next</Button><Button onClick={() => void generate()} disabled={busy}>Fill in from open hours</Button><Button variant="primary" onClick={() => openCreate()}>Add</Button></>} />
      <div className="mt-5"><Tabs value={tab} onChange={(next) => setParams({ tab: next === 'calendar' ? null : next })} items={[{ id: 'calendar', label: 'Calendar' }, { id: 'hours', label: 'Open hours', count: data.rules.length || undefined }, { id: 'events', label: 'Events' }]} /></div>

      {data.error && <p className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{errorMessage(data.error, 'The schedule could not be loaded.')}</p>}

      <div hidden={tab !== 'calendar'} className="mt-4 rounded-[var(--ph-radius)] border border-stone-300 bg-white p-2 sm:p-4">
        <CalendarView slots={data.slots} shifts={data.shifts} exceptions={data.exceptions} visible={tab === 'calendar'} handle={handle}
          onSelect={(selection: Selection) => openCreate(selection)} onVisit={setVisitIds} onShift={setShiftId} />
      </div>
      {tab === 'hours' && <OpenHours data={data} onAdd={() => openCreate({ repeat: true })} />}
      {tab === 'events' && <Events data={data} onAdd={() => openCreate({ kind: 'event' })} />}

      <CreateSheet open={create.open} initial={create.initial} pets={data.pets} onClose={() => setCreate((current) => ({ ...current, open: false }))} />
      <VisitSheet slots={visitSlots} onClose={() => setVisitIds([])} />
      <ShiftSheet shift={shift} onClose={() => setShiftId(null)} />
    </div>
  );
}
