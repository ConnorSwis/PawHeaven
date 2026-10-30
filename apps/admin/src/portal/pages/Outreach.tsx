import type { OutreachSummary } from '@pawheaven/contracts';
import { useApi } from '../lib/api';
import { useRoute } from '../lib/router';
import type { PageProps } from '../routes';
import { PageHeader, Tabs } from '../ui';
import { AlertsTab } from './outreach/Alerts';
import { NewsletterTab } from './outreach/Newsletter';
import { SubscribersTab } from './outreach/Subscribers';

const TABS = ['newsletter', 'subscribers', 'alerts'] as const;
type Tab = (typeof TABS)[number];

export default function Outreach(_props: PageProps) {
  const { params, setParams } = useRoute();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'newsletter';
  const summary = useApi<OutreachSummary>('/admin/outreach', { refetchSeconds: 60 });
  return (
    <div>
      <PageHeader title="Outreach" description="Write the newsletter, see who is signed up, and check that email alerts are flowing." />
      <div className="mt-5"><Tabs value={tab} onChange={(next) => setParams({ tab: next === 'newsletter' ? null : next, id: null, status: null })} items={[{ id: 'newsletter', label: 'Newsletter' }, { id: 'subscribers', label: 'Subscribers' }, { id: 'alerts', label: 'Alerts' }]} /></div>
      {tab === 'newsletter' && <NewsletterTab summary={summary.data} />}
      {tab === 'subscribers' && <SubscribersTab summary={summary.data} />}
      {tab === 'alerts' && <AlertsTab summary={summary} />}
    </div>
  );
}
