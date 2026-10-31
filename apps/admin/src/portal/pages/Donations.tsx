import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminDonation, AdminDonationsResponse, DonationPublicationStatus } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { formatDate, formatMoney, shelterDay } from '../lib/format';
import type { PageProps } from '../routes';
import { Button, Card, type Column, DataTable, Detail, EmptyState, FilterSelect, PageHeader, SearchBox, Sheet, StatCard, StatusBadge, Toolbar } from '../ui';
import { useRoute } from '../lib/router';
import { useToast } from '../ui/toast';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const cssColor = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekStart = (day: string) => addDays(day, -new Date(`${day}T00:00:00Z`).getUTCDay());
const publicationLabel: Record<DonationPublicationStatus, string> = { private: 'Private', pending: 'Awaiting review', published: 'Published', hidden: 'Hidden' };

function DonationChart({ gifts, period }: { gifts: AdminDonation[]; period: 'day' | 'week' }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const model = useMemo(() => {
    const bucket = (iso: string) => (period === 'day' ? shelterDay(iso) : weekStart(shelterDay(iso)));
    const totals = new Map<string, number>();
    for (const gift of gifts) totals.set(bucket(gift.createdAt), (totals.get(bucket(gift.createdAt)) ?? 0) + gift.amountCents / 100);
    const keys = [...totals.keys()].sort();
    if (!keys.length) return null;
    const step = period === 'day' ? 1 : 7;
    const labels: string[] = [];
    for (let key = keys[0]; key <= keys[keys.length - 1]; key = addDays(key, step)) labels.push(key);
    const shown = labels.slice(period === 'day' ? -30 : -12);
    const values = shown.map((key) => Math.round((totals.get(key) ?? 0) * 100) / 100);
    let running = labels.slice(0, labels.length - shown.length).reduce((sum, key) => sum + (totals.get(key) ?? 0), 0);
    const cumulative = shown.map((key) => { running += totals.get(key) ?? 0; return Math.round(running * 100) / 100; });
    const label = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' });
    return { labels: shown.map(label), values, cumulative };
  }, [gifts, period]);

  useEffect(() => {
    if (!canvas.current || !model) return;
    const brand = cssColor('--ph-brand', 'AccentColor');
    const accent = cssColor('--ph-accent', 'Mark');
    const ink = cssColor('--ph-ink-muted', 'GrayText');
    const grid = cssColor('--ph-divider', 'GrayText');
    const chart = new Chart(canvas.current, {
      data: { labels: model.labels, datasets: [
        { type: 'bar', label: period === 'day' ? 'Per day' : 'Per week', data: model.values, backgroundColor: brand, borderRadius: 3, order: 2 },
        { type: 'line', label: 'Running total', data: model.cumulative, borderColor: accent, backgroundColor: accent, tension: 0.25, pointRadius: 2, yAxisID: 'total', order: 1 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ink } }, tooltip: { callbacks: { label: (item) => `${item.dataset.label}: $${Number(item.parsed.y).toLocaleString()}` } } },
        scales: { x: { ticks: { color: ink, maxRotation: 0, autoSkip: true }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: ink, callback: (value) => `$${value}` }, grid: { color: grid } }, total: { position: 'right', beginAtZero: true, ticks: { color: ink, callback: (value) => `$${value}` }, grid: { drawOnChartArea: false } } } },
    });
    return () => chart.destroy();
  }, [model, period]);

  if (!model) return <EmptyState title="No donations to chart yet" />;
  const summary = `Donation totals per ${period}: ${model.labels.map((label, index) => `${label} $${model.values[index]}`).join(', ')}.`;
  return <div className="relative h-64"><canvas ref={canvas} role="img" aria-label={summary} /></div>;
}

export default function Donations(_props: PageProps) {
  const { params, setParams } = useRoute();
  const refresh = useRefresh();
  const toast = useToast();
  const data = useApi<AdminDonationsResponse>('/admin/donations');
  const [period, setPeriod] = useState<'day' | 'week'>('week');
  const [liveOnly, setLiveOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [publicationBusy, setPublicationBusy] = useState(false);
  const status = params.get('status') ?? '';
  const selectedId = params.get('id');

  const all = data.data?.donations ?? [];
  const succeeded = useMemo(() => all.filter((item) => item.status === 'succeeded' && (!liveOnly || item.livemode)), [all, liveOnly]);
  const month = shelterDay(new Date()).slice(0, 7);
  const thisMonth = succeeded.filter((item) => shelterDay(item.createdAt).startsWith(month));
  const sum = (items: AdminDonation[]) => items.reduce((total, item) => total + item.amountCents, 0);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((item) => (!status || item.status === status) && (!liveOnly || item.livemode) && (!needle || `${item.donorName ?? ''} ${item.donorEmail ?? ''}`.toLowerCase().includes(needle)));
  }, [all, search, status, liveOnly]);
  const selected = all.find((item) => item.id === selectedId);

  const updatePublication = async (publicStatus: Extract<DonationPublicationStatus, 'published' | 'hidden'>) => {
    if (!selected) return;
    setPublicationBusy(true);
    try {
      await api(`/admin/donations/${selected.id}/publication`, { method: 'PUT', json: { publicStatus } });
      toast.success(publicStatus === 'published' ? 'Donation published to the supporter wall.' : 'Donation removed from the supporter wall.');
      await refresh('/admin/donations');
    } catch (error) {
      toast.error(errorMessage(error, 'The supporter-wall setting could not be saved.'));
    } finally {
      setPublicationBusy(false);
    }
  };

  const exportCsv = () => {
    const header = ['Date', 'Donor', 'Email', 'Amount', 'Currency', 'Status', 'Mode', 'Public opt-in', 'Supporter-wall status', 'Display name', 'Message'];
    const lines = rows.map((item) => [item.createdAt, item.donorName ?? '', item.donorEmail ?? '', (item.amountCents / 100).toFixed(2), item.currency, item.status, item.livemode ? 'live' : 'test', item.publicOptIn ? 'yes' : 'no', item.publicStatus, item.publicDisplayName ?? '', item.publicMessage ?? ''].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','));
    const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'pawheaven-donations.csv' });
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<AdminDonation>[] = [
    { key: 'date', header: 'Date', sort: (row) => row.createdAt, cell: (row) => formatDate(row.createdAt) },
    { key: 'donor', header: 'Donor', sort: (row) => (row.donorName ?? '').toLowerCase(), cell: (row) => <div><p className="font-medium text-stone-950">{row.donorName ?? 'Name not provided'}</p><p className="text-xs text-stone-600">{row.donorEmail ?? 'No email'}</p></div> },
    { key: 'amount', header: 'Amount', sort: (row) => row.amountCents, className: 'text-right', cell: (row) => <span className="font-semibold text-stone-950">{formatMoney(row.amountCents, row.currency)}</span> },
    { key: 'status', header: 'Status', hideBelow: 'sm', cell: (row) => <span className="flex items-center gap-2"><StatusBadge status={row.status} />{!row.livemode && <span className="text-xs text-stone-600">test</span>}</span> },
    { key: 'wall', header: 'Supporter wall', hideBelow: 'lg', sort: (row) => row.publicStatus, cell: (row) => row.publicOptIn ? <StatusBadge status={row.publicStatus} label={publicationLabel[row.publicStatus]} /> : <span className="text-sm text-stone-600">No opt-in</span> },
  ];
  const totals = data.data?.totals ?? [];

  return (
    <div>
      <PageHeader title="Donations" description="Gifts appear only after Stripe confirms them to PawHeaven's signed webhook. Test-mode payments move no real money." actions={<Button onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={liveOnly ? 'Live total' : 'Total (all modes)'} value={formatMoney(sum(succeeded))} hint={`${succeeded.length} gift${succeeded.length === 1 ? '' : 's'}`} />
        <StatCard label="This month" value={formatMoney(sum(thisMonth))} hint={`${thisMonth.length} gift${thisMonth.length === 1 ? '' : 's'}`} />
        <StatCard label="Average gift" value={succeeded.length ? formatMoney(Math.round(sum(succeeded) / succeeded.length)) : '—'} />
        <StatCard label="Test-mode gifts" value={totals.filter((total) => !total.livemode).reduce((count, total) => count + total.count, 0)} hint="Not real money" />
      </div>
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-950">Donations over time</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart period">
            <Button size="sm" variant={period === 'day' ? 'primary' : 'secondary'} aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>Daily</Button>
            <Button size="sm" variant={period === 'week' ? 'primary' : 'secondary'} aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Weekly</Button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={liveOnly} onChange={(event) => setLiveOnly(event.target.checked)} />Live only</label>
          </div>
        </div>
        <div className="mt-3">{data.isLoading ? <p className="text-sm text-stone-700">Loading…</p> : <DonationChart gifts={succeeded} period={period} />}</div>
      </Card>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search donor name or email" />
        <FilterSelect label="Status" value={status} onChange={(value) => setParams({ status: value })} options={[{ value: 'succeeded', label: 'Succeeded' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }]} />
        <span className="text-sm text-stone-600">{rows.length} gift{rows.length === 1 ? '' : 's'}</span>
      </Toolbar>
      <div className="mt-3"><DataTable rows={rows} columns={columns} rowId={(row) => row.id} loading={data.isLoading} error={data.isError ? errorMessage(data.error, 'Donations could not be loaded.') : null} selectedId={selectedId} onRowClick={(row) => setParams({ id: row.id })} initialSort={{ key: 'date', dir: 'desc' }}
        empty={<EmptyState title="Nothing recorded yet">If a payment went through but is missing, check that the Stripe webhook endpoint and its signing secret are configured.</EmptyState>} /></div>
      {selected && (
        <Sheet open onOpenChange={(open) => { if (!open) setParams({ id: null }); }} title={formatMoney(selected.amountCents, selected.currency)} description={selected.donorName ?? 'Name not provided'} width="max-w-md">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Status"><StatusBadge status={selected.status} /></Detail>
            <Detail label="Mode">{selected.livemode ? 'Live' : 'Test (not real money)'}</Detail>
            <Detail label="Donor">{selected.donorName}</Detail>
            <Detail label="Email">{selected.donorEmail}</Detail>
            <div className="col-span-2"><Detail label="Received">{new Date(selected.createdAt).toLocaleString()}</Detail></div>
          </dl>
          <section className="mt-6 border-t border-stone-200 pt-5" aria-labelledby="supporter-wall-heading">
            <h3 id="supporter-wall-heading" className="text-base font-semibold text-stone-950">Supporter wall</h3>
            {!selected.publicOptIn ? <p className="mt-2 text-sm leading-6 text-stone-700">This donor did not opt in to a public display.</p> : (
              <div className="mt-3 grid gap-4">
                <Detail label="Review status"><StatusBadge status={selected.publicStatus} label={publicationLabel[selected.publicStatus]} /></Detail>
                <Detail label="Display name">{selected.publicDisplayName ?? 'No display name supplied'}</Detail>
                <Detail label="Message">{selected.publicMessage ?? 'No message supplied'}</Detail>
                <p className="text-xs leading-5 text-stone-600">Only opted-in successful live donations with a display name can be published. Published messages appear exactly as submitted.</p>
                <div className="flex flex-wrap gap-2">
                  {selected.publicStatus !== 'published' && <Button variant="primary" disabled={publicationBusy || !selected.livemode || selected.status !== 'succeeded' || !selected.publicDisplayName} onClick={() => void updatePublication('published')}>{publicationBusy ? 'Saving…' : 'Approve & publish'}</Button>}
                  {selected.publicStatus !== 'hidden' && <Button disabled={publicationBusy} onClick={() => void updatePublication('hidden')}>{publicationBusy ? 'Saving…' : selected.publicStatus === 'published' ? 'Unpublish' : 'Keep private'}</Button>}
                </div>
              </div>
            )}
          </section>
        </Sheet>
      )}
    </div>
  );
}
