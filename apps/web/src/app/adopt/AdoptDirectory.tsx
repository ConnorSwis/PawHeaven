import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { Button, ButtonLink, Choice, EmptyState, Fieldset, Input, Notice, PageHeading, Select, TextLink, cx } from '../../ui';
import { ChevronDownIcon, SearchIcon } from '../../ui/icons';
import { errorMessage, inlineData, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { AnimalCard, AnimalCardSkeleton } from './AnimalCard';
import { ClientOnly } from './client';
import { AGE_BANDS } from './age';
import { DEFAULT_FILTERS, ENERGY_OPTIONS, SEX_OPTIONS, SIZE_OPTIONS, SORT_OPTIONS, SPECIES_OPTIONS, activeFilterCount, applyFilters, filtersToSearch, hasAnyFilter, parseFilters, type Filters } from './filters';
import { useSaved } from './saved';
import { EmailAlert } from './EmailAlert';
import { NeedsHelpRow } from '../status/NeedsHelp';
import { StatusBanner } from '../status/StatusBanner';

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;

function DirectorySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeading title="Adopt a pet" intro="Every animal here is looking for a home. Search, filter, and save the ones you love." />
      <div className="mt-8 h-12 animate-pulse bg-stone-200" aria-hidden="true" />
      <div className="mt-6"><Grid>{Array.from({ length: 8 }, (_, index) => <AnimalCardSkeleton key={index} />)}</Grid></div>
    </div>
  );
}

function Directory() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data, isError, error, refetch, isFetching } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  const [filters, setFilters] = useState<Filters>(() => parseFilters(window.location.search));
  const [panelOpen, setPanelOpen] = useState(() => activeFilterCount(parseFilters(window.location.search)) > 0);
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

  const filterCount = activeFilterCount(filters);
  const clear = () => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeading title="Adopt a pet" intro="Every animal here is looking for a home. Search, filter, and save the ones you love." />

      <StatusBanner className="mt-6" />

      <div className="mt-6 flex flex-col gap-3 rounded-[var(--ph-radius)] border border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-stone-950"><span className="font-semibold">Not sure? Find your match.</span> Answer a few questions about your home and lifestyle.</p>
        <ButtonLink href="/adopt/match" variant="secondary">Take the matching quiz</ButtonLink>
      </div>

      <form role="search" aria-label="Search animals" onSubmit={(event) => event.preventDefault()} className="mt-6 rounded-[var(--ph-radius)] border border-stone-300 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <div>
            <label htmlFor="pet-search" className="mb-1.5 block text-sm font-semibold text-stone-950">Search by name, breed, or description</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-700" />
              <Input id="pet-search" ref={searchRef} type="search" name="q" autoComplete="off" placeholder="For example: lab, calm, good with cats" className="pl-11" value={filters.q} onChange={(event) => set('q', event.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="pet-sort" className="mb-1.5 block text-sm font-semibold text-stone-950">Sort by</label>
            <Select id="pet-sort" value={filters.sort} onChange={(event) => set('sort', event.target.value as Filters['sort'])}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
        </div>

        <button type="button" aria-expanded={panelOpen} aria-controls="pet-filters" onClick={() => setPanelOpen((open) => !open)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--ph-radius)] border border-stone-400 px-4 py-2 text-base font-semibold text-stone-900 hover:bg-stone-100 md:hidden">
          Filters{filterCount > 0 && <span className="rounded-full bg-[var(--ph-brand)] px-2 text-sm text-[var(--ph-on-brand)]">{filterCount}<span className="sr-only"> on</span></span>}
          <ChevronDownIcon className={cx('transition-transform', panelOpen && 'rotate-180')} />
        </button>

        <div id="pet-filters" className={cx('mt-4 border-t border-stone-200 pt-4 md:block', panelOpen ? 'block' : 'hidden')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect id="f-species" label="Kind of animal" value={filters.species} onChange={(value) => set('species', value as Filters['species'])} any="Any animal" options={SPECIES_OPTIONS} />
            <FilterSelect id="f-size" label="Size" value={filters.size} onChange={(value) => set('size', value as Filters['size'])} any="Any size" options={SIZE_OPTIONS} />
            <FilterSelect id="f-age" label="Age" value={filters.age} onChange={(value) => set('age', value as Filters['age'])} any="Any age" options={AGE_BANDS} />
            <FilterSelect id="f-sex" label="Sex" value={filters.sex} onChange={(value) => set('sex', value as Filters['sex'])} any="Any" options={SEX_OPTIONS} />
            <FilterSelect id="f-energy" label="Energy level" value={filters.energy} onChange={(value) => set('energy', value as Filters['energy'])} any="Any energy" options={ENERGY_OPTIONS} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Fieldset legend="Good with">
              <div className="grid gap-2 sm:grid-cols-3">
                <Choice label="Kids" checked={filters.kids} onChange={(event) => set('kids', event.target.checked)} />
                <Choice label="Dogs" checked={filters.dogs} onChange={(event) => set('dogs', event.target.checked)} />
                <Choice label="Cats" checked={filters.cats} onChange={(event) => set('cats', event.target.checked)} />
              </div>
            </Fieldset>
            <Fieldset legend="Fostering">
              <Choice label="Open to foster" checked={filters.foster} onChange={(event) => set('foster', event.target.checked)} />
            </Fieldset>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <p className="text-base font-semibold text-stone-950" aria-hidden="true">{summary || 'Finding animals'}</p>
          <div className="flex flex-wrap items-center gap-3">
            {savedCount > 0 && <TextLink href="/me?tab=saved" className="py-2">Your saved animals ({savedCount})</TextLink>}
            {hasAnyFilter(filters) && <Button variant="ghost" onClick={() => { clear(); searchRef.current?.focus(); }}>Clear filters</Button>}
          </div>
        </div>
        <p role="status" className="sr-only">{announced}</p>
        <div className={filterCount > 0 ? 'mt-3' : undefined}><EmailAlert filters={filters} /></div>
      </form>

      {pets && !hasAnyFilter(filters) && filters.sort !== 'help' && (
        <NeedsHelpRow
          pets={pets}
          id="directory-needs-help"
          className="mt-8"
          action={<Button onClick={() => { set('sort', 'help'); document.getElementById('pet-sort')?.focus(); }}>Sort all animals by who needs help first</Button>}
        />
      )}

      <div className="mt-6">
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
              action={<div className="mt-3 flex flex-wrap justify-center gap-3">{hasAnyFilter(filters) && <Button variant="primary" onClick={clear}>Clear filters</Button>}<ButtonLink href="/adopt/match">Take the matching quiz</ButtonLink></div>}
            >
              {pets.length === 0 ? 'New animals arrive often, so please check back soon. You can also foster or volunteer in the meantime.' : 'Try removing a filter or searching with fewer words. Animals are added all the time, so check back soon.'}
            </EmptyState>
          </div>
        ) : (
          <Grid>{results.map((pet, index) => <AnimalCard key={pet.id} pet={pet} priority={index < 4} />)}</Grid>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, any, options }: { id: string; label: string; value: string; onChange: (value: string) => void; any: string; options: readonly { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-950">{label}</label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{any}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </div>
  );
}

export default function AdoptDirectory() {
  return <Providers><ClientOnly fallback={<DirectorySkeleton />}><Directory /></ClientOnly></Providers>;
}
