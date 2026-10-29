import { matchesPetSearch, type Pet } from '@pawheaven/contracts';
import { ageBand, type AgeBand } from './age';

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
  sort: 'waiting' | 'newest' | 'name';
};

export const DEFAULT_FILTERS: Filters = { q: '', species: '', size: '', age: '', sex: '', energy: '', kids: false, dogs: false, cats: false, foster: false, sort: 'waiting' };

export const SPECIES_OPTIONS = [{ value: 'dog', label: 'Dogs' }, { value: 'cat', label: 'Cats' }, { value: 'other', label: 'Other animals' }] as const;
export const SIZE_OPTIONS = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'extra-large', label: 'Extra large' }] as const;
export const SEX_OPTIONS = [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] as const;
export const ENERGY_OPTIONS = [{ value: 'low', label: 'Low: relaxed' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High: very active' }] as const;
export const SORT_OPTIONS = [{ value: 'waiting', label: 'Waiting longest' }, { value: 'newest', label: 'Newest arrivals' }, { value: 'name', label: 'Name, A to Z' }] as const;

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
  return result.sort(filters.sort === 'name' ? byName : filters.sort === 'newest' ? (a, b) => a.daysInShelter - b.daysInShelter || byName(a, b) : (a, b) => b.daysInShelter - a.daysInShelter || byName(a, b));
}
