import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { Button, ButtonLink, ChipToggle, EmptyState, Notice, SearchPill, Select, TextLink } from '../../ui';
import { PawIcon } from '../../ui/icons';
import { errorMessage, inlineData, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { AnimalCard, AnimalCardSkeleton } from './AnimalCard';
import { ClientOnly } from './client';
import { DEFAULT_FILTERS, QUICK_CHIPS, SORT_OPTIONS, activeFilters, applyFilters, filtersToSearch, hasAnyFilter, parseFilters, type Filters } from './filters';
import { ActiveFilterChips, MoreFiltersSheet } from './FilterControls';
import { useSaved } from './saved';
import { EmailAlert } from './EmailAlert';
import { NeedsHelpRow } from '../status/NeedsHelp';
import { StatusBanner } from '../status/StatusBanner';

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;

function Heading() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">Meet the <span className="ph-highlight">animals</span></h1>
        <p className="mt-2 text-lg leading-7 text-stone-800">Every animal here needs a home. Search, save your favorites, then meet them, adopt, or foster.</p>
        <p className="mt-3"><ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink></p>
      </header>
      <aside aria-label="Matching quiz" className="flex items-center gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-[var(--ph-brand-soft)] p-3 pl-4 lg:max-w-md">
        <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--ph-brand-strong)] sm:grid"><PawIcon /></span>
        <p className="min-w-0 flex-1 text-sm leading-5 text-stone-950"><span className="font-bold">Not sure? Find your match.</span><span className="hidden sm:inline"> A few questions about your home and lifestyle.</span></p>
        <ButtonLink href="/adopt/match" className="shrink-0">Take the quiz</ButtonLink>
      </aside>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Heading />
      <div className="mt-6 h-14 animate-pulse rounded-[var(--ph-radius-pill)] bg-stone-200" aria-hidden="true" />
      <div className="mt-8"><Grid>{Array.from({ length: 8 }, (_, index) => <AnimalCardSkeleton key={index} />)}</Grid></div>
    </div>
  );
}

function Directory() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data, isError, error, refetch, isFetching } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  const [filters, setFilters] = useState<Filters>(() => parseFilters(window.location.search));
  const [sheetOpen, setSheetOpen] = useState(false);
  const { count: savedCount } = useSaved();
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  // Keep the address in step with the filters so the view can be shared or bookmarked.
  useEffect(() => {
    const target = `${window.location.pathname}${filtersToSearch(filters)}`;
    if (target !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', target);
  }, [filters]);
  useEffect(() => {
    const onPop = () => setFilters(parseFilters(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const pets = data?.pets;
  const results = useMemo(() => (pets ? applyFilters(pets, filters) : []), [pets, filters]);

  // Announce the count after typing pauses, so a screen reader is not read every keystroke.
  const summary = pets ? `${results.length} ${results.length === 1 ? 'animal' : 'animals'}${hasAnyFilter(filters) ? ' match your search' : ' looking for a home'}` : '';
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(summary), 500);
    return () => window.clearTimeout(timer);
  }, [summary]);

  const anyFilter = hasAnyFilter(filters);
  const insideSheet = activeFilters(filters).filter((filter) => !filter.quick).length;
  const clear = () => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
  const searchRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // A removed chip takes focus with it, so hand focus to the next chip, or to "More filters" when none are left.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-active-chip]')) return;
      window.requestAnimationFrame(() => (document.querySelector<HTMLButtonElement>('[data-active-chip] button') ?? moreRef.current)?.focus());
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Heading />

      <StatusBanner className="mt-6" />

      <form role="search" aria-label="Search animals" onSubmit={(event) => event.preventDefault()} className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchPill ref={searchRef} id="pet-search" name="q" label="Search by name, breed, or description" placeholder="Search by name or breed" wrapperClassName="flex-1 pr-4" value={filters.q} onChange={(event) => set('q', event.target.value)} />
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm font-semibold text-stone-950 sm:flex-none">
              <span>Sort</span>
              <Select id="pet-sort" className="rounded-[var(--ph-radius-pill)] pl-4 sm:w-48" value={filters.sort} onChange={(event) => set('sort', event.target.value as Filters['sort'])}>
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
            <Button ref={moreRef} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              More filters{insideSheet > 0 && <span className="rounded-full bg-[var(--ph-brand)] px-2 text-sm text-[var(--ph-on-brand)]">{insideSheet}<span className="sr-only"> on</span></span>}
            </Button>
          </div>
        </div>

        <div role="group" aria-label="Quick filters" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:mt-4 sm:flex-wrap sm:overflow-visible sm:px-0">
          {QUICK_CHIPS.map((chip) => <ChipToggle key={chip.id} className="shrink-0" pressed={chip.on(filters)} onClick={() => setFilters((current) => chip.toggle(current))}>{chip.label}</ChipToggle>)}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="mr-1 text-base font-bold text-stone-950" aria-hidden="true">{summary || 'Finding animals'}</p>
          <ActiveFilterChips filters={filters} setFilters={setFilters} />
          {anyFilter && <Button variant="ghost" onClick={() => { clear(); searchRef.current?.focus(); }}>Clear all</Button>}
          {savedCount > 0 && <TextLink href="/me?tab=saved" className="py-2 sm:ml-auto">Your saved animals ({savedCount})</TextLink>}
        </div>
        <p role="status" className="sr-only">{announced}</p>
        <div className={activeFilters(filters).length > 0 ? 'mt-3' : undefined}><EmailAlert filters={filters} /></div>
      </form>

      <MoreFiltersSheet open={sheetOpen} onOpenChange={setSheetOpen} filters={filters} setFilters={setFilters} resultCount={results.length} onClear={clear} canClear={anyFilter} />

      {pets && !anyFilter && filters.sort !== 'help' && (
        <NeedsHelpRow
          pets={pets}
          id="directory-needs-help"
          className="mt-8"
          action={<Button onClick={() => { set('sort', 'help'); document.getElementById('pet-sort')?.focus(); }}>Sort all animals by who needs help first</Button>}
        />
      )}

      <div className="mt-8">
        {isError && !pets ? (
          <Notice tone="error" title="We could not load the animals">
            <p>{errorMessage(error, 'Please check your connection and try again.')}</p>
            <Button className="mt-3" onClick={() => void refetch()} disabled={isFetching}>Try again</Button>
          </Notice>
        ) : !pets ? (
          <Grid>{Array.from({ length: 8 }, (_, index) => <AnimalCardSkeleton key={index} />)}</Grid>
        ) : results.length === 0 ? (
          <div className="rounded-[var(--ph-radius)] border border-dashed border-stone-400 bg-white">
            <EmptyState
              title={pets.length === 0 ? 'No animals are listed right now' : 'No animals match those filters'}
              action={<div className="mt-3 flex flex-wrap justify-center gap-3">{anyFilter && <Button variant="primary" onClick={clear}>Clear all</Button>}<ButtonLink href="/adopt/match">Take the matching quiz</ButtonLink></div>}
            >
              {pets.length === 0 ? 'New animals arrive often, so please check back soon. You can also foster or volunteer in the meantime.' : 'Try removing a filter or searching with fewer words. Animals are added all the time, so check back soon.'}
            </EmptyState>
          </div>
        ) : (
          <Grid>
            {results.map((pet, index) => (
              <div key={pet.id} className="ph-enter flex [&>article]:flex-1" style={{ animationDelay: `${Math.min(index, 7) * 30}ms` }}>
                <AnimalCard pet={pet} priority={index < 4} />
              </div>
            ))}
          </Grid>
        )}
      </div>
    </div>
  );
}

export default function AdoptDirectory() {
  return <Providers><ClientOnly fallback={<DirectorySkeleton />}><Directory /></ClientOnly></Providers>;
}
