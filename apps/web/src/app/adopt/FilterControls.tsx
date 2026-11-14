import type { Dispatch, SetStateAction } from 'react';
import { Button, Choice, Fieldset, Select, Sheet, chipClass, cx } from '../../ui';
import { CloseIcon } from '../../ui/icons';
import { AGE_BANDS } from './age';
import { ENERGY_OPTIONS, SEX_OPTIONS, SIZE_OPTIONS, SPECIES_OPTIONS, activeFilters, type Filters } from './filters';

type Setter = Dispatch<SetStateAction<Filters>>;

/** The filters that are switched on and not already visible as a pressed quick chip, each removable with one press. */
export function ActiveFilterChips({ filters, setFilters }: { filters: Filters; setFilters: Setter }) {
  const hidden = activeFilters(filters).filter((filter) => !filter.quick);
  if (!hidden.length) return null;
  return (
    <ul aria-label="Filters you picked" className="flex flex-wrap gap-2">
      {hidden.map((filter) => (
        <li key={filter.id} data-active-chip>
          <button type="button" aria-label={`Remove filter: ${filter.label}`} onClick={() => setFilters((current) => filter.remove(current))} className={cx(chipClass(false), 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)] hover:bg-stone-100')}>
            {filter.label}<CloseIcon width={16} height={16} />
          </button>
        </li>
      ))}
    </ul>
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

/** Everything the quick chips do not cover. Changes apply straight away, so the sheet only needs a way to close it and to start over. */
export function MoreFiltersSheet({ open, onOpenChange, filters, setFilters, resultCount, onClear, canClear }: { open: boolean; onOpenChange: (open: boolean) => void; filters: Filters; setFilters: Setter; resultCount: number; onClear: () => void; canClear: boolean }) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="More filters"
      description="Narrow the animals down. Changes apply right away."
      footer={
        <>
          <Button variant="ghost" onClick={onClear} disabled={!canClear}>Clear all</Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>Show {resultCount} {resultCount === 1 ? 'animal' : 'animals'}</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <FilterSelect id="f-species" label="Kind of animal" value={filters.species} onChange={(value) => set('species', value as Filters['species'])} any="Any animal" options={SPECIES_OPTIONS} />
        <FilterSelect id="f-size" label="Size" value={filters.size} onChange={(value) => set('size', value as Filters['size'])} any="Any size" options={SIZE_OPTIONS} />
        <FilterSelect id="f-age" label="Age" value={filters.age} onChange={(value) => set('age', value as Filters['age'])} any="Any age" options={AGE_BANDS} />
        <FilterSelect id="f-sex" label="Sex" value={filters.sex} onChange={(value) => set('sex', value as Filters['sex'])} any="Any" options={SEX_OPTIONS} />
        <FilterSelect id="f-energy" label="Energy level" value={filters.energy} onChange={(value) => set('energy', value as Filters['energy'])} any="Any energy" options={ENERGY_OPTIONS} />
        <Fieldset legend="Good with">
          <Choice label="Dogs" checked={filters.dogs} onChange={(event) => set('dogs', event.target.checked)} />
          <Choice label="Cats" checked={filters.cats} onChange={(event) => set('cats', event.target.checked)} />
        </Fieldset>
      </div>
    </Sheet>
  );
}
