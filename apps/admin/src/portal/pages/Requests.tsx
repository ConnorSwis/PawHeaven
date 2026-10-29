import { useMemo, useState } from 'react';
import type { AdminAdoptionApplicationListResponse, AdminFosterApplicationListResponse, AdminLostPetInquiryListResponse } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { ago, formatDate } from '../lib/format';
import { useRoute } from '../lib/router';
import { Button, type Column, ConfirmDialog, DataTable, EmptyState, PageHeader, SearchBox, Select, StatusBadge, Tabs, Toolbar } from '../ui';
import { useToast } from '../ui/toast';
import { AdoptionSheet, FosterSheet } from './requests/ApplicationSheet';
import { LostPetSheet } from './requests/LostPetSheet';

type Row = { id: string; who: string; email: string; animal: string; at: string; status: string; extra?: string };
const WAITING = ['Pending', 'New'];
const TABS = ['adoption', 'foster', 'lost'] as const;
type Tab = (typeof TABS)[number];

export default function Requests() {
  const { params, setParams } = useRoute();
  const toast = useToast();
  const refresh = useRefresh();
  const [search, setSearch] = useState('');
  const [purge, setPurge] = useState(false);
  const adoption = useApi<AdminAdoptionApplicationListResponse>('/admin/applications');
  const foster = useApi<AdminFosterApplicationListResponse>('/admin/foster-applications');
  const lost = useApi<AdminLostPetInquiryListResponse>('/admin/lost-pet-inquiries');

  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'adoption';
  const status = params.get('status') ?? '';
  const selectedId = params.get('id');

  const sources = {
    adoption: { query: adoption, rows: (adoption.data?.applications ?? []).map<Row>((item) => ({ id: item.id, who: item.applicantName, email: item.applicantEmail, animal: item.petName, at: item.submittedAt, status: item.status })) },
    foster: { query: foster, rows: (foster.data?.applications ?? []).map<Row>((item) => ({ id: item.id, who: item.applicantName, email: item.applicantEmail, animal: item.petName, at: item.submittedAt, status: item.status, extra: `${formatDate(`${item.availableFrom}T12:00:00Z`)} to ${formatDate(`${item.availableUntil}T12:00:00Z`)}` })) },
    lost: { query: lost, rows: (lost.data?.inquiries ?? []).map<Row>((item) => ({ id: item.id, who: item.memberName, email: item.memberEmail, animal: item.petName, at: item.createdAt, status: item.status })) },
  } as const;
  const waiting = (key: Tab) => sources[key].rows.filter((row) => WAITING.includes(row.status)).length;
  const current = sources[tab];

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return current.rows.filter((row) => {
      if (needle && !`${row.who} ${row.email} ${row.animal}`.toLowerCase().includes(needle)) return false;
      if (status === 'all') return true;
      return status ? row.status === status : WAITING.includes(row.status);
    });
  }, [current.rows, search, status]);

  const statusOptions = tab === 'lost'
    ? [{ value: 'New', label: 'New' }, { value: 'In progress', label: 'In progress' }, { value: 'Resolved', label: 'Resolved' }]
    : [{ value: 'Pending', label: 'Pending' }, { value: 'In review', label: 'In review' }, { value: 'Approved', label: 'Approved' }, { value: 'Declined', label: 'Declined' }];

  const columns: Column<Row>[] = [
    { key: 'who', header: tab === 'lost' ? 'Member' : 'Applicant', sort: (row) => row.who.toLowerCase(), cell: (row) => <div className="min-w-0"><p className="font-medium text-stone-950">{row.who}</p><p className="truncate text-xs text-stone-600">{row.email}</p></div> },
    { key: 'animal', header: 'Animal', sort: (row) => row.animal.toLowerCase(), cell: (row) => <span><span className="text-stone-950">{row.animal}</span>{row.extra && <span className="block text-xs text-stone-600">{row.extra}</span>}</span> },
    { key: 'at', header: tab === 'lost' ? 'Sent' : 'Submitted', hideBelow: 'sm', sort: (row) => row.at, cell: (row) => <span>{ago(row.at)}<span className="block text-xs text-stone-600">{formatDate(row.at)}</span></span> },
    { key: 'status', header: 'Status', sort: (row) => row.status, cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const close = () => setParams({ id: null });
  const doPurge = async () => {
    try {
      const { removed } = await api<{ removed: number }>('/admin/lost-pet/purge-expired', { method: 'POST' });
      toast.success(removed ? `Removed ${removed} expired search${removed === 1 ? '' : 'es'} with their photos and inquiries.` : 'Nothing has expired.');
      await refresh('/admin/lost-pet-inquiries');
    } catch (error) { toast.error(errorMessage(error)); }
    setPurge(false);
  };

  const selected = selectedId ? current.rows.find((row) => row.id === selectedId) : undefined;

  return (
    <div>
      <PageHeader title="Requests" description="Adoption and foster applications and lost-pet inquiries, oldest waiting first. Click a row to read it and respond."
        actions={tab === 'lost' ? <Button onClick={() => setPurge(true)}>Purge expired data</Button> : undefined} />
      <div className="mt-5"><Tabs value={tab} onChange={(next) => { setSearch(''); setParams({ tab: next === 'adoption' ? null : next, status: null, id: null }); }} items={[
        { id: 'adoption', label: 'Adoption', count: waiting('adoption') }, { id: 'foster', label: 'Foster', count: waiting('foster') }, { id: 'lost', label: 'Lost pets', count: waiting('lost') },
      ]} /></div>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, or animal" />
        <Select aria-label="Status" className="w-auto! py-1.5" value={status} onChange={(event) => setParams({ status: event.target.value || null })}>
          <option value="">Waiting for a response</option>
          <option value="all">Everything</option>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <span className="text-sm text-stone-600">{rows.length} shown</span>
      </Toolbar>
      <div className="mt-3">
        <DataTable rows={rows} columns={columns} rowId={(row) => row.id} loading={current.query.isLoading} error={current.query.isError ? errorMessage(current.query.error, 'These requests could not be loaded.') : null}
          selectedId={selectedId} onRowClick={(row) => setParams({ id: row.id })} initialSort={{ key: 'at', dir: 'asc' }}
          empty={<EmptyState title={!status && !search ? 'Nothing is waiting' : 'No matches'}>{!status && !search ? 'Every request here has been answered. Choose “Everything” in the status filter to review past ones.' : 'Try a different search or status.'}</EmptyState>} />
      </div>

      {selected && tab === 'adoption' && adoption.data && <AdoptionSheet application={adoption.data.applications.find((item) => item.id === selected.id)!} onClose={close} />}
      {selected && tab === 'foster' && foster.data && <FosterSheet application={foster.data.applications.find((item) => item.id === selected.id)!} onClose={close} />}
      {selected && tab === 'lost' && lost.data && <LostPetSheet key={selected.id} inquiry={lost.data.inquiries.find((item) => item.id === selected.id)!} onClose={close} />}
      <ConfirmDialog open={purge} danger title="Delete expired lost-pet data?" confirmLabel="Delete expired data" onCancel={() => setPurge(false)} onConfirm={doPurge}
        description="This removes lost-pet searches that have passed their retention date, with their uploaded photos and inquiries. It cannot be undone." />
    </div>
  );
}
