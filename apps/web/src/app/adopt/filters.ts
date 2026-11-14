import { matchesPetSearch, type Pet } from '@pawheaven/contracts';
import { AGE_BANDS, ageBand, type AgeBand } from './age';
import { byHelpSince, helpLabel } from '../status/help';

/** Every filter lives in the address (`/adopt?species=dog&size=small&kids=1`), so a filtered view can be shared. */
export type Filters = {
  q: string;
  species: '' | 'dog' | 'cat' | 'other';
  size: '' | 'small' | 'medium' | 'large' | 'extra-large';
  age: '' | AgeBand;
  sex: '' | 'male' | 'female';
  energy: '' | 'low' | 'medium' | 'high';
  kids: boolean;
  dogs: boolean;
  cats: boolean;
  foster: boolean;
  sort: 'waiting' | 'help' | 'newest' | 'name';
};

export const DEFAULT_FILTERS: Filters = { q: '', species: '', size: '', age: '', sex: '', energy: '', kids: false, dogs: false, cats: false, foster: false, sort: 'waiting' };

export const SPECIES_OPTIONS = [{ value: 'dog', label: 'Dogs' }, { value: 'cat', label: 'Cats' }, { value: 'other', label: 'Other animals' }] as const;
export const SIZE_OPTIONS = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'extra-large', label: 'Extra large' }] as const;
export const SEX_OPTIONS = [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] as const;
export const ENERGY_OPTIONS = [{ value: 'low', label: 'Low: relaxed' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High: very active' }] as const;
export const SORT_OPTIONS = [{ value: 'waiting', label: 'Waiting longest' }, { value: 'help', label: 'Needs help first' }, { value: 'newest', label: 'Newest arrivals' }, { value: 'name', label: 'Name, A to Z' }] as const;

const pick = <T extends string>(value: string | null, allowed: readonly { value: T }[], fallback: '' | T = ''): '' | T => allowed.find((option) => option.value === value)?.value ?? fallback;

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    species: pick(params.get('species'), SPECIES_OPTIONS),
    size: pick(params.get('size'), SIZE_OPTIONS),
    age: pick(params.get('age'), [{ value: 'baby' }, { value: 'young' }, { value: 'adult' }, { value: 'senior' }] as const),
    sex: pick(params.get('sex'), SEX_OPTIONS),
    energy: pick(params.get('energy'), ENERGY_OPTIONS),
    kids: params.get('kids') === '1',
    dogs: params.get('dogs') === '1',
    cats: params.get('cats') === '1',
    foster: params.get('foster') === '1',
    sort: pick(params.get('sort'), SORT_OPTIONS, 'waiting') as Filters['sort'],
  };
}

export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  for (const key of ['species', 'size', 'age', 'sex', 'energy'] as const) if (filters[key]) params.set(key, filters[key]);
  for (const key of ['kids', 'dogs', 'cats', 'foster'] as const) if (filters[key]) params.set(key, '1');
  if (filters.sort !== 'waiting') params.set('sort', filters.sort);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** How many filters (not counting the search words or sort order) are switched on. */
export function activeFilterCount(filters: Filters): number {
  return (['species', 'size', 'age', 'sex', 'energy'] as const).filter((key) => filters[key]).length + (['kids', 'dogs', 'cats', 'foster'] as const).filter((key) => filters[key]).length;
}
export const hasAnyFilter = (filters: Filters) => Boolean(filters.q.trim()) || activeFilterCount(filters) > 0;

const speciesOf = (pet: Pet): 'dog' | 'cat' | 'other' => (pet.type.toLowerCase() === 'dog' ? 'dog' : pet.type.toLowerCase() === 'cat' ? 'cat' : 'other');

export function applyFilters(pets: Pet[], filters: Filters): Pet[] {
  const result = pets.filter((pet) => {
    if (filters.q.trim() && !matchesPetSearch(pet, filters.q)) return false;
    if (filters.species && speciesOf(pet) !== filters.species) return false;
    if (filters.size && pet.size.toLowerCase().replace(/\s+/g, '-') !== filters.size) return false;
    if (filters.age && ageBand(pet.age) !== filters.age) return false;
    if (filters.sex && pet.sex.toLowerCase() !== filters.sex) return false;
    if (filters.energy && pet.energyLevel.toLowerCase() !== filters.energy) return false;
    if (filters.kids && pet.goodWithKids !== 'Yes') return false;
    if (filters.dogs && pet.goodWithDogs !== 'Yes') return false;
    if (filters.cats && pet.goodWithCats !== 'Yes') return false;
    if (filters.foster && !pet.fosterAvailable) return false;
    return true;
  });
  const byName = (a: Pet, b: Pet) => a.name.localeCompare(b.name);
  const byWaiting = (a: Pet, b: Pet) => b.daysInShelter - a.daysInShelter || byName(a, b);
  // "Needs help first": flagged animals (longest flagged first), then everyone else the way "Waiting longest" does.
  const byHelp = (a: Pet, b: Pet) => (helpLabel(b) ? 1 : 0) - (helpLabel(a) ? 1 : 0) || (helpLabel(a) ? byHelpSince(a, b) : byWaiting(a, b));
  return result.sort(filters.sort === 'name' ? byName : filters.sort === 'newest' ? (a, b) => a.daysInShelter - b.daysInShelter || byName(a, b) : filters.sort === 'help' ? byHelp : byWaiting);
}


/** A ready-made choice shown above the results. Each one is a plain filter, so the address stays the same as before. */
export type QuickChip = { id: string; label: string; on: (filters: Filters) => boolean; toggle: (filters: Filters) => Filters };
const flag = (id: 'kids' | 'foster', label: string): QuickChip => ({ id, label, on: (f) => f[id], toggle: (f) => ({ ...f, [id]: !f[id] }) });
export const QUICK_CHIPS: readonly QuickChip[] = [
  { id: 'dog', label: 'Dogs', on: (f) => f.species === 'dog', toggle: (f) => ({ ...f, species: f.species === 'dog' ? '' : 'dog' }) },
  { id: 'cat', label: 'Cats', on: (f) => f.species === 'cat', toggle: (f) => ({ ...f, species: f.species === 'cat' ? '' : 'cat' }) },
  { id: 'small', label: 'Small', on: (f) => f.size === 'small', toggle: (f) => ({ ...f, size: f.size === 'small' ? '' : 'small' }) },
  flag('kids', 'Good with kids'),
  { id: 'senior', label: 'Seniors', on: (f) => f.age === 'senior', toggle: (f) => ({ ...f, age: f.age === 'senior' ? '' : 'senior' }) },
  flag('foster', 'Open to foster'),
];

/** One switched-on filter, for the removable chips under the search bar. `quick` filters are already shown as pressed chips above. */
export type ActiveFilter = { id: string; label: string; quick: boolean; remove: (filters: Filters) => Filters };
export function activeFilters(filters: Filters): ActiveFilter[] {
  const labelOf = (options: readonly { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? value;
  const quickOn = QUICK_CHIPS.filter((chip) => chip.on(filters));
  const quickMatches = (id: string) => quickOn.some((chip) => chip.id === id);
  const list: ActiveFilter[] = [];
  if (filters.species) list.push({ id: 'species', label: labelOf(SPECIES_OPTIONS, filters.species), quick: quickMatches(filters.species), remove: (f) => ({ ...f, species: '' }) });
  if (filters.size) list.push({ id: 'size', label: `${labelOf(SIZE_OPTIONS, filters.size)} size`, quick: quickMatches(filters.size), remove: (f) => ({ ...f, size: '' }) });
  if (filters.age) list.push({ id: 'age', label: labelOf(AGE_BANDS, filters.age).replace(/ \(.*\)$/, ''), quick: filters.age === 'senior', remove: (f) => ({ ...f, age: '' }) });
  if (filters.sex) list.push({ id: 'sex', label: labelOf(SEX_OPTIONS, filters.sex), quick: false, remove: (f) => ({ ...f, sex: '' }) });
  if (filters.energy) list.push({ id: 'energy', label: `${labelOf(ENERGY_OPTIONS, filters.energy).split(':')[0]} energy`, quick: false, remove: (f) => ({ ...f, energy: '' }) });
  if (filters.kids) list.push({ id: 'kids', label: 'Good with kids', quick: true, remove: (f) => ({ ...f, kids: false }) });
  if (filters.dogs) list.push({ id: 'dogs', label: 'Good with dogs', quick: false, remove: (f) => ({ ...f, dogs: false }) });
  if (filters.cats) list.push({ id: 'cats', label: 'Good with cats', quick: false, remove: (f) => ({ ...f, cats: false }) });
  if (filters.foster) list.push({ id: 'foster', label: 'Open to foster', quick: true, remove: (f) => ({ ...f, foster: false }) });
  return list;
}
