import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useEffect, useState, type ReactNode } from 'react';
import type { AdminAdoptionApplicationListResponse, AdminFosterApplicationListResponse, AdminLostPetInquiryListResponse, AdminPetListResponse, AdminUser, AdminUserListResponse } from '@pawheaven/contracts';
import { SITE, THEMES } from '@pawheaven/contracts/site';
import { saveTheme } from '@pawheaven/contracts/ui';
import { api, useApi } from './lib/api';
import { useRoute } from './lib/router';
import { CalendarIcon, CoinIcon, ExternalIcon, HeartIcon, HomeIcon, InboxIcon, MenuIcon, PawIcon, SearchIcon, UsersIcon } from './ui/icons';
import { Badge, Button, DensityContext, cx } from './ui';

export const NAV = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/animals', label: 'Animals', icon: PawIcon },
  { path: '/requests', label: 'Requests', icon: InboxIcon },
  { path: '/schedule', label: 'Schedule', icon: CalendarIcon },
  { path: '/fostering', label: 'Fostering', icon: HeartIcon },
  { path: '/donations', label: 'Donations', icon: CoinIcon },
  { path: '/people', label: 'People', icon: UsersIcon },
] as const;

/** People and requests waiting on staff, shown as a count next to Requests. */
function useWaitingCount() {
  const adoption = useApi<AdminAdoptionApplicationListResponse>('/admin/applications', { refetchSeconds: 120 });
  const foster = useApi<AdminFosterApplicationListResponse>('/admin/foster-applications', { refetchSeconds: 120 });
  const lost = useApi<AdminLostPetInquiryListResponse>('/admin/lost-pet-inquiries', { refetchSeconds: 120 });
  return (adoption.data?.applications.filter((item) => item.status === 'Pending').length ?? 0)
    + (foster.data?.applications.filter((item) => item.status === 'Pending').length ?? 0)
    + (lost.data?.inquiries.filter((item) => item.status === 'New').length ?? 0);
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { path, navigate } = useRoute();
  const waiting = useWaitingCount();
  return (
    <nav aria-label="Staff sections" className="grid gap-0.5">
      {NAV.map((item) => {
        const active = item.path === '/' ? path === '/' : path.startsWith(item.path);
        return (
          <button key={item.path} type="button" aria-current={active ? 'page' : undefined}
            onClick={() => { navigate(item.path); onNavigate?.(); }}
            className={cx('flex items-center gap-3 rounded-[var(--ph-radius)] px-3 py-2 text-left text-sm font-medium', active ? 'bg-[var(--ph-brand-soft)] text-stone-950' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-950')}>
            <item.icon />
            <span className="flex-1">{item.label}</span>
            {item.path === '/requests' && waiting > 0 && <Badge tone="warn">{waiting}</Badge>}
          </button>
        );
      })}
    </nav>
  );
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { navigate } = useRoute();
  const pets = useApi<AdminPetListResponse>('/admin/pets', { enabled: open });
  const people = useApi<AdminUserListResponse>('/admin/users', { enabled: open });
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  const item = 'flex cursor-pointer items-center gap-2 rounded-[var(--ph-radius)] px-3 py-2 text-sm text-stone-900 data-[selected=true]:bg-[var(--ph-brand-soft)]';
  const heading = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-stone-600';
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label="Search the portal" overlayClassName="fixed inset-0 z-[70] bg-[color-mix(in_oklab,var(--ph-ink-strong)_45%,transparent)]" contentClassName="fixed left-1/2 top-[12vh] z-[71] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden border border-stone-300 bg-white shadow-md">
      <Dialog.Title className="sr-only">Search the portal</Dialog.Title>
      <div className="flex items-center gap-2 border-b border-stone-200 px-3"><SearchIcon className="text-stone-500" /><Command.Input placeholder="Jump to a page, an animal, or a person…" className="w-full bg-transparent py-3 text-sm text-stone-950 outline-none placeholder:text-stone-500" /></div>
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-stone-600">Nothing matches that.</Command.Empty>
        <Command.Group heading="Pages" className={heading}>
          {NAV.map((entry) => <Command.Item key={entry.path} value={`page ${entry.label}`} onSelect={() => go(entry.path)} className={item}><entry.icon />{entry.label}</Command.Item>)}
        </Command.Group>
        <Command.Group heading="Actions" className={heading}>
          <Command.Item value="action add pet new animal" onSelect={() => go('/animals?id=new')} className={item}><PawIcon />Add an animal</Command.Item>
          <Command.Item value="action add schedule visit shift event" onSelect={() => go('/schedule?add=1')} className={item}><CalendarIcon />Add to the schedule</Command.Item>
          <Command.Item value="action ask foster pool request" onSelect={() => go('/fostering?tab=pool')} className={item}><HeartIcon />Ask the foster pool for help</Command.Item>
        </Command.Group>
        {pets.data && (
          <Command.Group heading="Animals" className={heading}>
            {pets.data.pets.map((pet) => <Command.Item key={pet.id} value={`animal ${pet.name} ${pet.type} ${pet.breed}`} onSelect={() => go(`/animals?id=${pet.id}`)} className={item}><PawIcon />{pet.name}<span className="text-xs text-stone-600">{pet.type} · {pet.status}</span></Command.Item>)}
          </Command.Group>
        )}
        {people.data && (
          <Command.Group heading="People" className={heading}>
            {people.data.users.map((user) => <Command.Item key={user.id} value={`person ${user.name} ${user.email}`} onSelect={() => go(`/people?id=${user.id}`)} className={item}><UsersIcon />{user.name}<span className="text-xs text-stone-600">{user.email}</span></Command.Item>)}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

export function Shell({ user, children }: { user: AdminUser; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => { try { return localStorage.getItem('ph-density') === 'compact' ? 'compact' : 'comfortable'; } catch { return 'comfortable'; } });
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? '');
  const { path } = useRoute();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { try { localStorage.setItem('ph-density', density); } catch { /* Storage blocked. */ } }, [density]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path]);

  const signOut = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => undefined); window.location.assign('/login'); };
  const roleLabel = user.role === 'superuser' ? 'Superuser' : 'Staff';

  return (
    <DensityContext.Provider value={density}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-stone-300 bg-white p-3 lg:flex">
          <div className="px-3 pb-1 pt-2"><p className="text-base font-semibold tracking-tight text-stone-950">{SITE.adminName}</p><p className="text-xs text-stone-600">{roleLabel}</p></div>
          <NavList />
          <a href="https://pawheaven.online" className="mt-auto flex items-center gap-2 px-3 py-2 text-xs text-stone-700 hover:text-stone-950"><ExternalIcon width={14} height={14} />View the shelter site</a>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-stone-300 bg-white px-4 py-2.5">
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger asChild><Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open the menu"><MenuIcon /></Button></Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ph-ink-strong)_45%,transparent)]" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-64 border-r border-stone-300 bg-white p-3 shadow-md">
                  <Dialog.Title className="px-3 py-2 text-base font-semibold text-stone-950">{SITE.adminName}</Dialog.Title>
                  <Dialog.Description className="sr-only">Staff navigation</Dialog.Description>
                  <NavList onNavigate={() => setMenuOpen(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <button type="button" onClick={() => setPaletteOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 px-3 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-100 sm:max-w-sm">
              <SearchIcon width={16} height={16} /><span className="flex-1 truncate">Search animals, people, pages…</span><kbd className="hidden rounded border border-stone-300 px-1.5 text-xs sm:inline">⌘K</kbd>
            </button>
            <span className="flex-1" />
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--ph-radius)] px-2 py-1.5 text-sm font-medium text-stone-900 hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-xs font-semibold text-stone-950">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
                <span className="hidden max-w-40 truncate sm:inline">{user.name || user.email}</span>
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-64 border border-stone-300 bg-white p-3 shadow-md">
                <p className="truncate text-sm font-semibold text-stone-950">{user.name}</p>
                <p className="truncate text-xs text-stone-600">{user.email} · {roleLabel}</p>
                <label className="mt-3 block text-xs font-medium text-stone-700">Theme
                  <select className="mt-1 block w-full border border-stone-400 bg-white px-2 py-1.5 text-sm text-stone-950" value={theme} onChange={(event) => { const next = event.target.value; setTheme(next); if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme; saveTheme(next); }}>
                    {THEMES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs font-medium text-stone-700"><input type="checkbox" checked={density === 'compact'} onChange={(event) => setDensity(event.target.checked ? 'compact' : 'comfortable')} />Compact tables</label>
                <Button className="mt-3 w-full" onClick={signOut}>Sign out</Button>
              </div>
            </details>
          </header>
          <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
      <Palette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </DensityContext.Provider>
  );
}
