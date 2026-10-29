import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Providers } from '../../lib/providers';
import { loginUrl, useMe } from '../../lib/fetch';
import { ButtonLink, Card, Notice, Skeleton, cx } from '../../ui';
import { Applications } from './Applications';
import { Details } from './Details';
import { Overview } from './Overview';
import { Saved } from './Saved';
import { Visits } from './Visits';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'visits', label: 'Visits and shifts' },
  { id: 'applications', label: 'Applications' },
  { id: 'saved', label: 'Saved' },
  { id: 'details', label: 'My details' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const readTab = (): TabId => {
  const value = new URLSearchParams(window.location.search).get('tab');
  return TABS.find((tab) => tab.id === value)?.id ?? 'overview';
};

function Heading({ lead, children }: { lead?: string; children?: string }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">My PawHeaven</h1>
      {lead && <p className="mt-2 text-lg leading-8 text-stone-700">{lead}</p>}
      {children}
    </header>
  );
}

function MeContent() {
  const me = useMe();
  const [tab, setTab] = useState<TabId>('overview');
  const [ready, setReady] = useState(false);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    setTab(readTab());
    setReady(true);
    const onPop = () => setTab(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (moved.current) panelHeading.current?.focus();
  }, [tab]);

  function go(next: TabId) {
    if (next === tab) return;
    moved.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setTab(next);
  }

  // Links inside the page that only change `?tab=` switch tabs without reloading.
  function onLinkClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!link || !href?.startsWith('?tab=') || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const id = new URLSearchParams(href.slice(1)).get('tab');
    const found = TABS.find((item) => item.id === id);
    if (found) { event.preventDefault(); go(found.id); }
  }

  if (!ready || me.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Heading />
        <div className="mt-8 grid gap-4" aria-hidden="true"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        <p role="status" className="sr-only">Loading your account</p>
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Heading />
        <Notice tone="error" title="We could not load your account." className="mt-6">Check your connection and refresh the page. If it keeps happening, call the shelter.</Notice>
      </div>
    );
  }

  const user = me.data;
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Heading lead="Your visits, shifts, applications, and saved animals, all in one place." />
        {tab === 'saved' ? (
          <div className="mt-8 grid gap-6">
            <Notice tone="info" title="You are not signed in.">Your saved animals are kept on this device, so you can see them here. <a className="font-semibold underline underline-offset-4" href={loginUrl()}>Log in</a> to see the rest of My PawHeaven.</Notice>
            <Saved />
          </div>
        ) : (
          <Card className="mt-8 max-w-xl">
            <h2 className="text-xl font-semibold text-stone-950">Log in to see your account</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Once you are logged in you can see your upcoming visits and volunteer shifts, check on your applications, and update your saved details. New here? An account takes a minute to create.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink variant="primary" href={loginUrl()}>Log in</ButtonLink>
              <ButtonLink variant="secondary" href={`/sign-up?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`}>Create an account</ButtonLink>
            </div>
            <p className="mt-5 text-sm text-stone-700"><a className="font-medium underline underline-offset-4" href="?tab=saved" onClick={(event) => { event.preventDefault(); go('saved'); }}>See animals you saved on this device</a></p>
          </Card>
        )}
      </div>
    );
  }

  const current = TABS.find((item) => item.id === tab) ?? TABS[0];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" onClick={onLinkClick}>
      <Heading lead={`Welcome back, ${user.name.split(' ')[0]}.`} />
      <nav aria-label="My PawHeaven sections" className="mt-6 border-b border-stone-300">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`?tab=${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); go(item.id); }}
                  className={cx('inline-flex min-h-11 items-center border-b-4 px-4 py-2 text-base font-semibold transition-colors', active ? 'border-[var(--ph-brand)] text-stone-950' : 'border-transparent text-stone-700 hover:border-stone-400 hover:text-stone-950')}
                >{item.label}</a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6" id="panel">
        <h2 ref={panelHeading} tabIndex={-1} className="sr-only focus:outline-none">{current.label}</h2>
        {tab === 'overview' && <Overview user={user} />}
        {tab === 'visits' && <Visits />}
        {tab === 'applications' && <Applications />}
        {tab === 'saved' && <Saved />}
        {tab === 'details' && <Details user={user} />}
      </div>
    </div>
  );
}

export const MePage = () => <Providers><MeContent /></Providers>;
