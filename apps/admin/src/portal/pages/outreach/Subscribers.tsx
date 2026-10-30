import { useMemo, useState } from 'react';
import type { OutreachSummary, Subscriber, SubscriberListResponse } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useRoute } from '../../lib/router';
import { Badge, Button, ConfirmDialog, type Column, DataTable, EmptyState, FilterSelect, SearchBox, StatCard, Toolbar } from '../../ui';
import { useToast } from '../../ui/toast';

type Status = Subscriber['status'];
const STATUS_LABEL: Record<Status, string> = { confirmed: 'Confirmed', pending: 'Waiting for confirmation', unsubscribed: 'Unsubscribed' };
const STATUS_TONE: Record<Status, 'good' | 'warn' | 'neutral'> = { confirmed: 'good', pending: 'warn', unsubscribed: 'neutral' };
const LIMIT = 1000;

/** Quotes a cell, and defuses a leading = + - @ so a spreadsheet never treats an address as a formula. */
const csvCell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

export function SubscribersTab({ summary }: { summary: OutreachSummary | undefined }) {
  const { params, setParams } = useRoute();
  const list = useApi<SubscriberListResponse>('/admin/subscribers');
  const refresh = useRefresh();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<Subscriber | null>(null);
  const status = (['confirmed', 'pending', 'unsubscribed'] as const).find((value) => value === params.get('status')) ?? '';
  const all = list.data?.subscribers ?? [];
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((item) => (!status || item.status === status) && (!needle || item.email.toLowerCase().includes(needle)));
  }, [all, search, status]);

  const exportCsv = () => {
    const lines = rows.map((item) => [item.email, item.status, item.createdAt].map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([['email,status,signed up', ...lines].join('\n')], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'pawheaven-subscribers.csv' });
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (item: Subscriber) => {
    try {
      await api(`/admin/subscribers/${item.id}`, { method: 'DELETE' });
      await refresh('/admin/subscribers', '/admin/outreach');
      toast.success(`${item.email} was removed from the list.`);
    } catch (error) { toast.error(errorMessage(error)); }
    setRemoving(null);
  };

  const columns: Column<Subscriber>[] = [
    { key: 'email', header: 'Email', sort: (row) => row.email.toLowerCase(), className: '[overflow-wrap:anywhere]', cell: (row) => <div><p className="font-medium text-stone-950">{row.email}</p><span className="mt-1 inline-block sm:hidden"><Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge></span></div> },
    { key: 'status', header: 'Status', hideBelow: 'sm', sort: (row) => row.status, cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
    { key: 'date', header: 'Signed up', hideBelow: 'sm', sort: (row) => row.createdAt, cell: (row) => formatDate(row.createdAt) },
    { key: 'actions', header: 'Actions', cell: (row) => (row.status === 'unsubscribed' ? null : <Button size="sm" className="min-h-11" onClick={() => setRemoving(row)} aria-label={`Remove ${row.email}`}>Remove</Button>) },
  ];
  const tile = (value: Status) => ({ label: STATUS_LABEL[value], value: summary ? summary.subscribers[value] : '…', onClick: () => setParams({ status: status === value ? null : value }) });

  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard {...tile('confirmed')} hint="Will get the newsletter" />
        <StatCard {...tile('pending')} hint="Have not clicked the link yet" />
        <StatCard {...tile('unsubscribed')} hint="Will not be emailed" />
      </div>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by email" />
        <FilterSelect label="Status" value={status} onChange={(value) => setParams({ status: value })} options={(Object.keys(STATUS_LABEL) as Status[]).map((value) => ({ value, label: STATUS_LABEL[value] }))} />
        <span className="text-sm text-stone-600" role="status">{list.isLoading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'address' : 'addresses'}`}</span>
        <span className="flex-1" />
        <Button className="min-h-11" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </Toolbar>
      <div className="mt-3">
        <DataTable rows={rows} columns={columns} rowId={(row) => row.id} tableClassName="min-w-0" loading={list.isLoading} error={list.isError ? errorMessage(list.error, 'Subscribers could not be loaded.') : null} initialSort={{ key: 'date', dir: 'desc' }}
          empty={all.length === 0
            ? <EmptyState title="Nobody has signed up yet">People join from the newsletter box on the public site. They appear here as Waiting for confirmation until they click the link in their email.</EmptyState>
            : <EmptyState title="No one matches">Try a different status or clear the search.</EmptyState>} />
      </div>
      {all.length >= LIMIT && <p className="mt-2 text-xs text-stone-600">Showing the newest {LIMIT} addresses.</p>}
      <ConfirmDialog open={Boolean(removing)} onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) await remove(removing); }} danger confirmLabel="Remove" title="Remove this address?"
        description={<>{removing?.email} will be unsubscribed and will not get the newsletter. They can sign up again on the public site.</>} />
    </div>
  );
}
