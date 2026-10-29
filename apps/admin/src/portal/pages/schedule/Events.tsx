import type { ShelterEvent } from '@pawheaven/contracts';
import { type Column, DataTable, EmptyState } from '../../ui';
import type { ScheduleData } from './data';
import { etParts, niceDay, niceTime } from './time';

export function Events({ data, onAdd }: { data: ScheduleData; onAdd: () => void }) {
  const upcoming = data.events.filter((item) => Date.parse(item.endsAt) > Date.now());
  const columns: Column<ShelterEvent>[] = [
    { key: 'title', header: 'Event', sort: (row) => row.title.toLowerCase(), cell: (row) => <div className="min-w-0"><p className="font-medium text-stone-950">{row.title}</p>{row.description && <p className="line-clamp-1 text-xs text-stone-600">{row.description}</p>}</div> },
    { key: 'when', header: 'When', sort: (row) => row.startsAt, cell: (row) => `${niceDay(etParts(row.startsAt).date)} · ${niceTime(etParts(row.startsAt).minutes)} – ${niceTime(etParts(row.endsAt).minutes)}` },
    { key: 'pets', header: 'Featured animals', hideBelow: 'md', cell: (row) => (row.pets.length ? row.pets.map((pet) => pet.name).join(', ') : <span className="text-stone-500">None</span>) },
  ];
  return (
    <div className="mt-5">
      <p className="max-w-2xl text-sm leading-6 text-stone-700">An open house creates its visit capacity, volunteer roles, and featured animals together. Use <strong>Add</strong>, then choose “Open house or event”. Its visit times and shifts appear on the calendar with an outline.</p>
      <div className="mt-3">
        <DataTable rows={upcoming} columns={columns} rowId={(row) => row.id} loading={data.loading} initialSort={{ key: 'when', dir: 'asc' }}
          empty={<EmptyState title="No events coming up" action={<button type="button" className="text-sm font-medium text-[var(--ph-brand-strong)] underline" onClick={onAdd}>Add an open house</button>} />} />
      </div>
    </div>
  );
}
