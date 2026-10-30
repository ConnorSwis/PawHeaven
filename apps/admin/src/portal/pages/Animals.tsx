import { useMemo, useState } from 'react';
import { HELP_REASONS, HELP_REASON_LABELS, PET_STATUSES, type AdminPetListResponse, type HelpReason, type Pet } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { useRoute } from '../lib/router';
import type { PageProps } from '../routes';
import { Badge, Button, type Column, DataTable, EmptyState, FilterSelect, PageHeader, SearchBox, Select, StatusBadge, Toolbar } from '../ui';
import { PawIcon, PlusIcon } from '../ui/icons';
import { useToast } from '../ui/toast';
import { CapacityCard, CapacitySheet } from './animals/Capacity';
import { PetEditor } from './animals/PetEditor';
import { inputFromPet, type FlagChange } from './animals/petForm';

const FLAG_FILTERS = [
  { value: 'foster', label: 'Open to foster' },
  { value: 'urgent', label: 'Foster needed now' },
  { value: 'walkers', label: 'Needs walkers' },
  { value: 'hidden', label: 'Hidden from visits' },
];

function matchesFlag(pet: Pet, flag: string) {
  if (flag === 'foster') return pet.fosterAvailable;
  if (flag === 'urgent') return pet.fosterUrgent;
  if (flag === 'walkers') return pet.needsWalkers;
  if (flag === 'hidden') return pet.visitsOpen === false;
  return true;
}

function Thumb({ pet }: { pet: Pet }) {
  return pet.imageUrl
    ? <img src={pet.imageUrl} alt="" loading="lazy" className="size-10 shrink-0 border border-stone-300 object-cover" />
    : <span className="grid size-10 shrink-0 place-items-center border border-stone-300 bg-stone-100 text-stone-500"><PawIcon width={18} height={18} /></span>;
}

export default function Animals(_props: PageProps) {
  const { params, setParams } = useRoute();
  const toast = useToast();
  const refresh = useRefresh();
  const list = useApi<AdminPetListResponse>('/admin/pets');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [working, setWorking] = useState(false);
  const [bulkHelp, setBulkHelp] = useState('');
  const [capacityOpen, setCapacityOpen] = useState(false);
  const status = params.get('status') ?? '';
  const species = params.get('species') ?? '';
  const flag = params.get('flag') ?? '';
  const help = params.get('help') === '1';
  const editingId = params.get('id');

  const pets = list.data?.pets ?? [];
  const speciesOptions = useMemo(() => [...new Set(pets.map((pet) => pet.type))].sort().map((value) => ({ value, label: value })), [pets]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pets.filter((pet) => (!needle || `${pet.name} ${pet.breed} ${pet.tags.join(' ')}`.toLowerCase().includes(needle)) && (!status || pet.status === status) && (!species || pet.type === species) && (!flag || matchesFlag(pet, flag)) && (!help || Boolean(pet.helpReason)));
  }, [pets, search, status, species, flag, help]);
  const helpCount = useMemo(() => pets.filter((pet) => pet.helpReason).length, [pets]);

  const applyFlags = async (change: FlagChange, label: string) => {
    const petIds = [...selected];
    setWorking(true);
    try {
      await api('/admin/pets/flags', { method: 'POST', json: { petIds, ...change } });
      toast.success(`${label}: ${petIds.length} animal${petIds.length === 1 ? '' : 's'} updated.`);
      await refresh('/admin/pets', '/admin/attention', '/admin/capacity');
      setSelected(new Set());
    } catch (error) { toast.error(errorMessage(error)); } finally { setWorking(false); }
  };

  const applyStatus = async () => {
    if (!bulkStatus) return;
    const targets = pets.filter((pet) => selected.has(pet.id));
    setWorking(true);
    let failed = 0;
    for (const pet of targets) {
      try { await api(`/admin/pets/${encodeURIComponent(pet.id)}`, { method: 'PUT', json: inputFromPet(pet, { status: bulkStatus as Pet['status'] }) }); } catch { failed += 1; }
    }
    await refresh('/admin/pets', '/admin/attention', '/admin/capacity');
    setWorking(false);
    if (failed) toast.error(`${targets.length - failed} updated; ${failed} could not be changed.`); else toast.success(`Status changed to ${bulkStatus} for ${targets.length} animal${targets.length === 1 ? '' : 's'}.`);
    setSelected(new Set());
    setBulkStatus('');
  };

  const applyHelp = async () => {
    if (!bulkHelp) return;
    const reason = bulkHelp === '__clear' ? '' : bulkHelp;
    const petIds = [...selected];
    setWorking(true);
    try {
      await api('/admin/pets/help', { method: 'POST', json: { petIds, reason } });
      const count = `${petIds.length} animal${petIds.length === 1 ? '' : 's'}`;
      toast.success(reason ? `${HELP_REASON_LABELS[reason as HelpReason]}: ${count} flagged.` : `Flag cleared for ${count}.`);
      await refresh('/admin/pets', '/admin/attention', '/admin/capacity');
      setSelected(new Set());
      setBulkHelp('');
    } catch (error) { toast.error(errorMessage(error)); } finally { setWorking(false); }
  };

  const columns: Column<Pet>[] = [
    { key: 'name', header: 'Animal', sort: (pet) => pet.name.toLowerCase(), cell: (pet) => <div className="flex items-center gap-3"><Thumb pet={pet} /><div className="min-w-0"><p className="font-medium text-stone-950">{pet.name}</p><p className="truncate text-xs text-stone-600">{pet.type} · {pet.breed || 'Breed not recorded'}</p>{pet.helpReason && <Badge tone="warn" className="mt-1">{HELP_REASON_LABELS[pet.helpReason]}</Badge>}</div></div> },
    { key: 'status', header: 'Status', sort: (pet) => pet.status, cell: (pet) => <StatusBadge status={pet.status} /> },
    {
      key: 'flags', header: 'Flags', hideBelow: 'md', cell: (pet) => (
        <span className="flex flex-wrap gap-1">
          {pet.fosterUrgent ? <Badge tone="warn">Foster needed now</Badge> : pet.fosterAvailable && <Badge tone="good">Open to foster</Badge>}
          {pet.needsWalkers && <Badge tone="warn">Needs walkers</Badge>}
          {pet.visitsOpen === false && <Badge>Hidden from visits</Badge>}
        </span>
      ),
    },
    { key: 'days', header: 'In shelter', hideBelow: 'sm', sort: (pet) => pet.daysInShelter, cell: (pet) => `${pet.daysInShelter} day${pet.daysInShelter === 1 ? '' : 's'}` },
  ];

  const filtered = Boolean(search || status || species || flag || help);
  return (
    <div>
      <PageHeader title="Animals" description="Every animal in the shelter's records. Click a row to edit it, or tick several to change them together." actions={<Button variant="primary" onClick={() => setParams({ id: 'new' })}><PlusIcon width={16} height={16} />Add animal</Button>} />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, breed, or tag" />
        <FilterSelect label="Status" value={status} onChange={(value) => setParams({ status: value })} options={PET_STATUSES.map((value) => ({ value, label: value }))} />
        <FilterSelect label="Species" value={species} onChange={(value) => setParams({ species: value })} options={speciesOptions} />
        <FilterSelect label="Flags" value={flag} onChange={(value) => setParams({ flag: value })} options={FLAG_FILTERS} />
        <Button size="sm" variant={help ? 'primary' : 'secondary'} aria-pressed={help} className="min-h-9 px-3 text-sm" onClick={() => setParams({ help: help ? null : '1' })}>
          Needs help<span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-700">{helpCount}</span>
        </Button>
        <span className="text-sm text-stone-600">{rows.length} of {pets.length}</span>
        {filtered && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setParams({ status: null, species: null, flag: null, help: null }); }}>Clear filters</Button>}
        <span className="flex-1" />
        <Button className="min-h-11" onClick={() => setCapacityOpen(true)}>Capacity…</Button>
      </Toolbar>
      <div className="mt-4"><CapacityCard onEdit={() => setCapacityOpen(true)} /></div>
      <CapacitySheet open={capacityOpen} onOpenChange={setCapacityOpen} />

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mt-3 flex flex-wrap items-center gap-2 border border-stone-300 bg-[var(--ph-brand-soft)] px-3 py-2 shadow-md" role="region" aria-label="Actions for selected animals">
          <strong className="mr-1 text-sm text-stone-950">{selected.size} selected</strong>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ fosterAvailable: true }, 'Open to foster')}>Open to foster</Button>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ fosterAvailable: false }, 'Foster closed')}>Close foster</Button>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ visitsOpen: true }, 'Open for visits')}>Open for visits</Button>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ visitsOpen: false }, 'Hidden from visits')}>Hide from visits</Button>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ needsWalkers: true }, 'Needs walkers')}>Needs walkers</Button>
          <Button size="sm" disabled={working} onClick={() => void applyFlags({ needsWalkers: false }, 'Walkers covered')}>Walkers covered</Button>
          <span className="flex items-center gap-1">
            <Select aria-label="Change status to" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className="w-auto! py-1 text-xs"><option value="">Change status…</option>{PET_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
            <Button size="sm" disabled={working || !bulkStatus} onClick={() => void applyStatus()}>Apply</Button>
          </span>
          <span className="flex items-center gap-1">
            <Select aria-label="Mark as needing help" value={bulkHelp} onChange={(event) => setBulkHelp(event.target.value)} className="w-auto! py-1 text-xs"><option value="">Needs help…</option>{HELP_REASONS.map((value) => <option key={value} value={value}>{HELP_REASON_LABELS[value]}</option>)}<option value="__clear">Clear flag</option></Select>
            <Button size="sm" disabled={working || !bulkHelp} onClick={() => void applyHelp()}>Apply</Button>
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="mt-3">
        <DataTable rows={rows} columns={columns} rowId={(pet) => pet.id} loading={list.isLoading} error={list.isError ? errorMessage(list.error, 'Animals could not be loaded.') : null}
          selection={{ selected, onChange: setSelected }} selectedId={editingId} onRowClick={(pet) => setParams({ id: pet.id })} initialSort={{ key: 'name', dir: 'asc' }} pageSize={30}
          empty={filtered ? <EmptyState title="No animals match">Try a different search or clear the filters.</EmptyState> : <EmptyState title="No animals yet" action={<Button variant="primary" onClick={() => setParams({ id: 'new' })}>Add the first animal</Button>}>Add one to show it on the public site.</EmptyState>} />
      </div>

      {editingId && <PetEditor key={editingId} id={editingId} pet={editingId === 'new' ? undefined : pets.find((pet) => pet.id === editingId)} onClose={() => setParams({ id: null })} />}
    </div>
  );
}
