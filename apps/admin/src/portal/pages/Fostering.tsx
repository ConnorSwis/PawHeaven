import { useMemo, useState } from 'react';
import type { AdminFosterApplicationListResponse, AdminFosterRequest, AdminPetListResponse, FosterApplication, VolunteerFosterCandidate } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { formatDate } from '../lib/format';
import { useRoute } from '../lib/router';
import type { PageProps } from '../routes';
import { Badge, Button, Card, type Column, DataTable, Detail, EmptyState, Field, PageHeader, SearchBox, Select, Sheet, StatusBadge, Tabs, Textarea, Toolbar } from '../ui';
import { useToast } from '../ui/toast';

const daysLeft = (until: string) => Math.ceil((Date.parse(`${until}T23:59:59`) - Date.now()) / 86_400_000);

function Placements() {
  const { params, setParams } = useRoute();
  const apps = useApi<AdminFosterApplicationListResponse>('/admin/foster-applications');
  const [search, setSearch] = useState('');
  const selectedId = params.get('id');
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (apps.data?.applications ?? []).filter((item) => item.status === 'Approved' && daysLeft(item.availableUntil) >= 0 && (!needle || `${item.petName} ${item.applicantName}`.toLowerCase().includes(needle)));
  }, [apps.data, search]);
  const selected = rows.find((row) => row.id === selectedId) ?? apps.data?.applications.find((row) => row.id === selectedId);

  const columns: Column<FosterApplication>[] = [
    { key: 'pet', header: 'Animal', sort: (row) => row.petName.toLowerCase(), cell: (row) => <span className="font-medium text-stone-950">{row.petName}</span> },
    { key: 'who', header: 'Foster', sort: (row) => row.applicantName.toLowerCase(), cell: (row) => <div><p>{row.applicantName}</p><p className="text-xs text-stone-600">{row.applicantEmail}</p></div> },
    { key: 'window', header: 'Dates', hideBelow: 'sm', cell: (row) => `${formatDate(`${row.availableFrom}T12:00:00Z`)} – ${formatDate(`${row.availableUntil}T12:00:00Z`)}` },
    { key: 'left', header: 'Time left', sort: (row) => daysLeft(row.availableUntil), cell: (row) => { const left = daysLeft(row.availableUntil); return <Badge tone={left <= 7 ? 'warn' : 'neutral'}>{left <= 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'}`}</Badge>; } },
  ];
  return (
    <>
      <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search animal or foster" /><span className="text-sm text-stone-600">{rows.length} active placement{rows.length === 1 ? '' : 's'}</span></Toolbar>
      <div className="mt-3"><DataTable rows={rows} columns={columns} rowId={(row) => row.id} loading={apps.isLoading} error={apps.isError ? errorMessage(apps.error, 'Placements could not be loaded.') : null} selectedId={selectedId} onRowClick={(row) => setParams({ id: row.id })} initialSort={{ key: 'left', dir: 'asc' }}
        empty={<EmptyState title="No active placements">Approved foster applications whose dates have not passed appear here. Review foster applications on the Requests page.</EmptyState>} /></div>
      {selected && (
        <Sheet open onOpenChange={(open) => { if (!open) setParams({ id: null }); }} title={`${selected.petName} with ${selected.applicantName}`} description={`${selected.status} foster application`}
          footer={<><Button onClick={() => window.location.assign(`#/animals?id=${selected.petId}`)}>Open animal</Button><Button onClick={() => window.location.assign(`#/requests?tab=foster&id=${selected.id}`)}>Open application</Button></>}>
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Status"><StatusBadge status={selected.status} /></Detail>
            <Detail label="Dates">{selected.availableFrom} to {selected.availableUntil}</Detail>
            <Detail label="Email">{selected.applicantEmail}</Detail>
            <Detail label="Phone">{selected.applicantPhone}</Detail>
            <div className="col-span-2"><Detail label="Address">{selected.applicantAddress}</Detail></div>
            <div className="col-span-2"><Detail label="Household">{selected.householdSummary}</Detail></div>
            <div className="col-span-2"><Detail label="Foster experience">{selected.fosterExperience}</Detail></div>
            {selected.note && <div className="col-span-2"><Detail label="Note">{selected.note}</Detail></div>}
          </dl>
        </Sheet>
      )}
    </>
  );
}

function Pool() {
  const { params } = useRoute();
  const requests = useApi<{ requests: AdminFosterRequest[] }>('/admin/foster-requests');
  const pets = useApi<AdminPetListResponse>('/admin/pets');
  const refresh = useRefresh();
  const toast = useToast();
  const [petId, setPetId] = useState(params.get('pet') ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const choices = (pets.data?.pets ?? []).filter((pet) => ['Available', 'Pending'].includes(pet.status));
  const openFor = new Set((requests.data?.requests ?? []).filter((item) => !item.closedAt).map((item) => item.petId));

  const send = async () => {
    setBusy(true);
    try {
      const result = await api<{ notified: number }>('/admin/foster-requests', { method: 'POST', json: { petId, note: note.trim() } });
      toast.success(result.notified ? `Asked ${result.notified} approved foster${result.notified === 1 ? '' : 's'}.` : 'The request is open, but nobody has opted in to alerts yet.');
      setNote(''); setPetId('');
      await refresh('/admin/foster-requests', '/admin/pets', '/admin/attention');
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const close = async (item: AdminFosterRequest) => {
    try { await api(`/admin/foster-requests/${item.id}/close`, { method: 'POST' }); toast.success(`Request for ${item.petName} closed.`); await refresh('/admin/foster-requests', '/admin/pets', '/admin/attention'); } catch (error) { toast.error(errorMessage(error)); }
  };

  const columns: Column<AdminFosterRequest>[] = [
    { key: 'pet', header: 'Animal', sort: (row) => row.petName.toLowerCase(), cell: (row) => <div><p className="font-medium text-stone-950">{row.petName}</p>{row.note && <p className="max-w-xs truncate text-xs text-stone-600">{row.note}</p>}</div> },
    { key: 'status', header: 'Status', cell: (row) => (row.closedAt ? <Badge>Closed</Badge> : <Badge tone="warn">Open</Badge>) },
    { key: 'sent', header: 'Asked', hideBelow: 'sm', sort: (row) => row.createdAt, cell: (row) => formatDate(row.createdAt) },
    { key: 'answers', header: 'Answers', cell: (row) => <span className="text-xs text-stone-700">{row.notified} emailed · {row.accepted} accepted · {row.declined} declined</span> },
    { key: 'actions', header: '', cell: (row) => (!row.closedAt ? <Button size="sm" onClick={() => void close(row)}>Close</Button> : null) },
  ];
  return (
    <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <h3 className="mb-2 text-base font-semibold text-stone-950">Requests</h3>
        <DataTable rows={requests.data?.requests ?? []} columns={columns} rowId={(row) => row.id} loading={requests.isLoading} initialSort={{ key: 'sent', dir: 'desc' }} pageSize={15} empty={<EmptyState title="No requests yet">Ask the foster pool when an animal needs a home right away.</EmptyState>} />
      </div>
      <Card>
        <h3 className="text-base font-semibold text-stone-950">Ask the foster pool</h3>
        <p className="mt-1 text-sm leading-6 text-stone-700">Opens the animal to foster, marks it urgent, and emails every approved foster who opted in to alerts. They accept in one step and you approve the application they file.</p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <Field label="Animal"><Select required value={petId} onChange={(event) => setPetId(event.target.value)}><option value="">Choose an animal</option>{choices.map((pet) => <option key={pet.id} value={pet.id} disabled={openFor.has(pet.id)}>{pet.name} ({pet.type}){openFor.has(pet.id) ? ' · request open' : ''}</option>)}</Select></Field>
          <Field label="Note to fosters (optional)"><Textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Needs out by Friday. Good with other dogs." /></Field>
          <Button type="submit" variant="primary" disabled={busy || !petId}>Email the foster pool</Button>
        </form>
      </Card>
    </div>
  );
}

function Invite() {
  const candidates = useApi<{ candidates: VolunteerFosterCandidate[] }>('/admin/volunteer-foster-candidates');
  const refresh = useRefresh();
  const toast = useToast();
  const invite = async (person: VolunteerFosterCandidate) => {
    try { await api(`/admin/volunteer-foster-candidates/${person.memberId}/invite`, { method: 'POST' }); toast.success(`Invitation sent to ${person.name}.`); await refresh('/admin/volunteer-foster-candidates', '/admin/attention'); } catch (error) { toast.error(errorMessage(error)); }
  };
  const columns: Column<VolunteerFosterCandidate>[] = [
    { key: 'name', header: 'Volunteer', sort: (row) => row.name.toLowerCase(), cell: (row) => <div><p className="font-medium text-stone-950">{row.name}</p><p className="text-xs text-stone-600">{row.email}</p></div> },
    { key: 'shifts', header: 'Finished shifts', sort: (row) => row.shifts, cell: (row) => row.shifts },
    { key: 'hours', header: 'Hours', hideBelow: 'sm', sort: (row) => row.hours, cell: (row) => row.hours },
    { key: 'action', header: '', cell: (row) => <Button size="sm" variant={row.invited ? 'secondary' : 'primary'} onClick={() => void invite(row)}>{row.invited ? 'Invite again' : 'Invite to foster'}</Button> },
  ];
  return (
    <div className="mt-5">
      <p className="mb-3 max-w-2xl text-sm leading-6 text-stone-700">Volunteers with five or more finished shifts who have never applied to foster. The invitation is an email plus a card on their My PawHeaven page.</p>
      <DataTable rows={candidates.data?.candidates ?? []} columns={columns} rowId={(row) => row.memberId} loading={candidates.isLoading} initialSort={{ key: 'shifts', dir: 'desc' }} empty={<EmptyState title="No one qualifies yet">Volunteers appear here after five finished shifts.</EmptyState>} />
    </div>
  );
}

export default function Fostering(_props: PageProps) {
  const { params, setParams } = useRoute();
  const tab = ['pool', 'invite'].includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'placements';
  return (
    <div>
      <PageHeader title="Fostering" description="Who is fostering now, asking approved fosters for help, and inviting volunteers to foster." />
      <div className="mt-5"><Tabs value={tab} onChange={(next) => setParams({ tab: next === 'placements' ? null : next, id: null })} items={[{ id: 'placements', label: 'Placements' }, { id: 'pool', label: 'Pool and requests' }, { id: 'invite', label: 'Volunteers to invite' }]} /></div>
      {tab === 'placements' && <Placements />}
      {tab === 'pool' && <Pool />}
      {tab === 'invite' && <Invite />}
    </div>
  );
}
