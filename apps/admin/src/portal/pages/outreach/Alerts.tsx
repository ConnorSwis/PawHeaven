import type { UseQueryResult } from '@tanstack/react-query';
import type { OutreachSummary } from '@pawheaven/contracts';
import { errorMessage } from '../../lib/api';
import { Card, EmptyState, Meter, Notice, Skeleton, StatCard } from '../../ui';
import { HeartIcon, MailIcon, SearchIcon } from '../../ui/icons';

const SPECIES_LABEL: Record<string, string> = { dog: 'Dogs', dogs: 'Dogs', cat: 'Cats', cats: 'Cats', other: 'Other animals', any: 'Any animal' };
const speciesLabel = (species: string) => SPECIES_LABEL[species.toLowerCase()] ?? species;

export function AlertsTab({ summary }: { summary: UseQueryResult<OutreachSummary> }) {
  if (summary.isLoading) return <div className="mt-5 grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (summary.isError || !summary.data) return <p className="mt-5 text-sm text-red-800" role="alert">{errorMessage(summary.error, 'The alert numbers could not be loaded.')}</p>;
  const { searches, savedAnimals, outbox } = summary.data;
  const max = Math.max(1, ...searches.bySpecies.map((row) => row.count));
  return (
    <div className="mt-5 grid gap-6">
      <p className="max-w-2xl text-sm leading-6 text-stone-700">What members are waiting for. Members get an email when a new animal matches a saved search, and when a saved animal changes.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={SearchIcon} label="Saved searches" value={searches.total} hint="Across all members" />
        <StatCard icon={MailIcon} label="Members with alerts" value={searches.members} hint="At least one saved search" />
        <StatCard icon={HeartIcon} label="Saved animals" value={savedAnimals} hint="Animals members have saved" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-bold text-stone-950">What saved searches look for</h2>
          {searches.bySpecies.length === 0 ? <EmptyState title="No saved searches yet">When a member saves a search on the adoption page, it is counted here.</EmptyState> : (
            <ul className="mt-4 grid gap-3" aria-label="Saved searches by animal">
              {searches.bySpecies.map((row) => (
                <li key={row.species} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-medium text-stone-950">{speciesLabel(row.species)}</span><span className="tabular-nums text-stone-800">{row.count}</span></div>
                  <Meter decorative level="ok" label={speciesLabel(row.species)} percent={Math.max(2, Math.round((row.count / max) * 100))} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-base font-bold text-stone-950">Email delivery</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard flat icon={MailIcon} tone="neutral" label="Queued" value={outbox.queued} />
            <StatCard flat icon={MailIcon} label="Sent, last 7 days" value={outbox.sentLast7Days} />
            <StatCard flat icon={MailIcon} tone={outbox.failed > 0 ? 'danger' : 'good'} label="Failed" value={outbox.failed} />
          </div>
          <p className="mt-3 text-xs leading-5 text-stone-600">Messages are queued first and sent by an hourly job, plus a run right after you send an issue.</p>
          {outbox.failed > 0 && <div className="mt-4"><Notice tone="warn" title={`${outbox.failed} message${outbox.failed === 1 ? '' : 's'} failed`}>Some messages could not be sent after three tries. Check the email service settings, then ask engineering to retry.</Notice></div>}
        </Card>
      </div>
    </div>
  );
}
