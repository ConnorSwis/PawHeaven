import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Providers } from '../../lib/providers';
import { loginUrl, useMe } from '../../lib/fetch';
import { ButtonLink, Card, Notice, Skeleton, chipClass } from '../../ui';
import { Mascot } from '../../ui/Mascot';
import { Activity } from './Activity';
import { SavedSearches } from './EmailChoices';
import { Matches, Overview } from './Overview';
import { Saved } from './Saved';
import { Settings, SignOutButton } from './Settings';

const TABS = [
  { id: 'overview', label: 'Home' },
  { id: 'activity', label: 'Activity' },
  { id: 'saved', label: 'Saved' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Older links, such as the ones already in emails, keep working. */
const ALIASES: Record<string, TabId> = { home: 'overview', visits: 'activity', applications: 'activity', details: 'settings' };
const findTab = (value: string | null | undefined): TabId | undefined => TABS.find((tab) => tab.id === value)?.id ?? (value ? ALIASES[value] : undefined);

/** `?tab=settings` or, for links in emails, `#settings`. */
const readTab = (): TabId => findTab(new URLSearchParams(window.location.search).get('tab') ?? window.location.hash.slice(1)) ?? 'overview';

function Heading({ lead, children }: { lead?: string; children?: string }) {
  return (
    <header>
      <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">My PawHeaven</h1>
      {lead && <p className="mt-2 text-lg leading-8 text-stone-700">{lead}</p>}
      {children}
    </header>
  );
}

/** A short greeting with the sign-out button, where people look for it. */
function Greeting({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || 'there';
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Mascot pose="welcome" size={64} className="hidden shrink-0 sm:block" />
        <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl"><span className="sr-only">My PawHeaven: </span>Hi, <span className="ph-highlight">{first}</span></h1>
      </div>
      <div className="shrink-0"><SignOutButton /></div>
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
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
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
    const found = findTab(id);
    if (found) { event.preventDefault(); go(found); }
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
        <Heading lead="Your visits, applications, and saved animals." />
        {tab === 'saved' ? (
          <div className="mt-8 grid gap-6">
            <Notice tone="info" title="You are not signed in.">Saved animals stay on this device. <a className="font-semibold underline underline-offset-4" href={loginUrl()}>Log in</a> for the rest.</Notice>
            <Saved />
          </div>
        ) : (
          <Card className="mt-8 max-w-xl">
            <Mascot pose="welcome" size={96} className="mb-2" />
            <h2 className="text-xl font-bold text-stone-950">Log in to see your account</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">See your visits, shifts and applications. New here? An account takes a minute.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink variant="primary" href={loginUrl()}>Log in</ButtonLink>
              <ButtonLink variant="secondary" href={`/sign-up?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`}>Create an account</ButtonLink>
            </div>
            <p className="mt-5 text-sm text-stone-700"><a className="font-medium underline underline-offset-4" href="?tab=saved" onClick={(event) => { event.preventDefault(); go('saved'); }}>Saved animals on this device</a></p>
          </Card>
        )}
      </div>
    );
  }

  const current = TABS.find((item) => item.id === tab) ?? TABS[0];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" onClick={onLinkClick}>
      <Greeting name={user.name} />
      <nav aria-label="My PawHeaven sections" className="mt-6">
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <li key={item.id}>
                <a
                  href={`?tab=${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); go(item.id); }}
                  className={chipClass(active)}
                >{item.label}</a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6" id="panel">
        <h2 ref={panelHeading} tabIndex={-1} className="sr-only focus:outline-none">{current.label}</h2>
        {tab === 'overview' && <Overview />}
        {tab === 'activity' && <Activity />}
        {tab === 'saved' && <div className="grid gap-6"><Saved /><SavedSearches /><Matches /></div>}
        {tab === 'settings' && <Settings user={user} />}
      </div>
    </div>
  );
}

export const MePage = () => <Providers><MeContent /></Providers>;
