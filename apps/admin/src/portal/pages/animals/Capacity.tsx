import { useEffect, useState } from 'react';
import type { ShelterGroupStatus, ShelterLevel, ShelterStatus } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../../lib/api';
import { Badge, Button, Card, Field, Input, Sheet, Skeleton, cx } from '../../ui';
import { useToast } from '../../ui/toast';

type Group = ShelterGroupStatus['group'];
const GROUPS: Group[] = ['Dog', 'Cat', 'Other'];
const GROUP_LABEL: Record<Group, string> = { Dog: 'Dogs', Cat: 'Cats', Other: 'Other animals' };

/** The words are always shown next to the bar, so the level never depends on color alone. */
export const LEVEL_WORDS: Record<ShelterLevel, string> = { unset: 'Not set', ok: 'Roomy', busy: 'Getting full', full: 'Full', over: 'Over capacity' };
const LEVEL_TONE: Record<ShelterLevel, 'neutral' | 'good' | 'warn' | 'danger'> = { unset: 'neutral', ok: 'good', busy: 'warn', full: 'danger', over: 'danger' };
const LEVEL_FILL: Record<ShelterLevel, string> = {
  unset: 'bg-stone-400',
  ok: 'bg-[var(--ph-brand)]',
  busy: 'bg-[var(--ph-warning)]',
  full: 'bg-[var(--ph-danger)]',
  over: 'bg-[var(--ph-danger)]',
};

function Meter({ group, onSetUp }: { group: ShelterGroupStatus; onSetUp?: () => void }) {
  const name = GROUP_LABEL[group.group];
  if (group.level === 'unset' || group.percent === null) {
    return (
      <li className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-medium text-stone-950">{name}</span><span className="text-sm text-stone-700">Not set</span></div>
        <p className="text-xs leading-5 text-stone-600">No kennel count yet, so no banner shows on the public site.</p>
        {onSetUp && <Button size="sm" className="min-h-11 justify-self-start" onClick={onSetUp}>Set kennel count</Button>}
      </li>
    );
  }
  const usable = group.kennels - group.heldBack;
  const width = Math.max(0, Math.min(100, group.percent));
  return (
    <li className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-stone-950">{name} {group.used} of {usable}</span>
        <span className="text-sm font-semibold tabular-nums text-stone-950">{group.percent}%</span>
      </div>
      <div role="meter" aria-label={`${name}: ${group.percent} percent full`} aria-valuemin={0} aria-valuemax={Math.max(100, group.percent)} aria-valuenow={group.percent}
        aria-valuetext={`${group.used} of ${usable} kennels in use, ${group.percent} percent. ${LEVEL_WORDS[group.level]}.`}
        className="h-3 w-full overflow-hidden border border-stone-400 bg-stone-100">
        <div className={cx('h-full transition-[width] duration-300 motion-reduce:transition-none', LEVEL_FILL[group.level])} style={{ width: `${width}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={LEVEL_TONE[group.level]}>{LEVEL_WORDS[group.level]}</Badge>
        {group.heldBack > 0 && <span className="text-xs text-stone-600">{group.heldBack} held back</span>}
      </div>
    </li>
  );
}

/** Dog, cat and other kennel meters. Shared by the Animals page and the Home tile. */
export function CapacityCard({ onEdit, showEdit, onHelp }: { onEdit: () => void; showEdit?: boolean; onHelp?: () => void }) {
  const status = useApi<ShelterStatus>('/admin/capacity', { refetchSeconds: 120 });
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-950">Shelter capacity</h2>
        {showEdit && <Button size="sm" variant="ghost" className="min-h-11" onClick={onEdit}>Edit capacity</Button>}
      </div>
      {status.isLoading && <div className="mt-3 grid gap-3 sm:grid-cols-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
      {status.isError && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage(status.error, 'Capacity could not be loaded.')}</p>}
      {status.data && (
        <>
          <ul className="mt-3 grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
            {GROUPS.map((name) => {
              const group = status.data.groups.find((item) => item.group === name);
              return group ? <Meter key={name} group={group} onSetUp={onEdit} /> : null;
            })}
          </ul>
          {onHelp && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 border-t border-stone-200 pt-3 text-sm text-stone-700">
              <span>{status.data.needHelp === 0 ? 'No animals are flagged as needing help.' : `${status.data.needHelp} animal${status.data.needHelp === 1 ? '' : 's'} flagged as needing help.`}</span>
              {status.data.needHelp > 0 && <Button size="sm" variant="ghost" className="min-h-11 underline underline-offset-4" onClick={onHelp}>See them</Button>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

type Draft = Record<Group, { kennels: string; heldBack: string }>;
const draftFrom = (status: ShelterStatus): Draft => {
  const out = {} as Draft;
  for (const name of GROUPS) {
    const group = status.groups.find((item) => item.group === name);
    out[name] = { kennels: String(group?.kennels ?? 0), heldBack: String(group?.heldBack ?? 0) };
  }
  return out;
};
const toNumber = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

function validate(entry: { kennels: string; heldBack: string }) {
  const errors: { kennels?: string; heldBack?: string } = {};
  const kennels = toNumber(entry.kennels);
  const heldBack = toNumber(entry.heldBack);
  if (!Number.isInteger(kennels) || kennels < 0 || kennels > 500) errors.kennels = 'Enter a whole number from 0 to 500.';
  if (!Number.isInteger(heldBack) || heldBack < 0) errors.heldBack = 'Enter a whole number, or 0 if none.';
  else if (!errors.kennels && heldBack > kennels) errors.heldBack = 'Held back cannot be more than the number of kennels.';
  return errors;
}

export function CapacitySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const refresh = useRefresh();
  const status = useApi<ShelterStatus>('/admin/capacity', { enabled: open });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = Boolean(status.data);

  // Fill the form when the panel opens (and once the numbers arrive), but never overwrite what staff are typing.
  useEffect(() => { if (open && status.data) setDraft(draftFrom(status.data)); else if (!open) setDraft(null); }, [open, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const original = status.data ? draftFrom(status.data) : null;
  const errors = draft ? Object.fromEntries(GROUPS.map((name) => [name, validate(draft[name])])) as Record<Group, ReturnType<typeof validate>> : null;
  const invalid = errors ? GROUPS.some((name) => errors[name].kennels || errors[name].heldBack) : false;
  const changed = draft && original ? GROUPS.filter((name) => draft[name].kennels !== original[name].kennels || draft[name].heldBack !== original[name].heldBack) : [];

  const set = (name: Group, key: 'kennels' | 'heldBack', value: string) => setDraft((current) => (current ? { ...current, [name]: { ...current[name], [key]: value } } : current));

  const save = async () => {
    if (!draft || invalid || changed.length === 0) return;
    setBusy(true);
    try {
      for (const name of changed) await api<ShelterStatus>(`/admin/capacity/${name}`, { method: 'PUT', json: { kennels: Number(draft[name].kennels), heldBack: Number(draft[name].heldBack) } });
      toast.success('Capacity saved.');
      await refresh('/admin/capacity', '/admin/attention');
      onOpenChange(false);
    } catch (error) {
      await refresh('/admin/capacity');
      toast.error(errorMessage(error));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} title="Capacity" width="max-w-lg"
      description="How many kennels the shelter has for each kind of animal. The meters and the public status banner are worked out from these numbers."
      footer={(
        <>
          <Button className="min-h-11" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" className="min-h-11" onClick={() => void save()} disabled={busy || invalid || changed.length === 0}>{busy ? 'Saving…' : 'Save capacity'}</Button>
        </>
      )}>
      {status.isError && <p className="text-sm text-red-800" role="alert">{errorMessage(status.error, 'Capacity could not be loaded.')}</p>}
      {!draft && !status.isError && <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {draft && errors && (
        <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {GROUPS.map((name) => {
            const group = status.data?.groups.find((item) => item.group === name);
            return (
              <fieldset key={name} className="grid gap-3 border border-stone-300 p-4 sm:grid-cols-2">
                <legend className="px-1 text-sm font-semibold text-stone-950">{GROUP_LABEL[name]}{group && group.level !== 'unset' ? <span className="ml-2 font-normal text-stone-600">{group.used} in use now</span> : null}</legend>
                <Field label="Kennels" error={errors[name].kennels} help="Total kennels, including any held back. 0 kennels means not set, so no banner is shown.">
                  <Input type="number" inputMode="numeric" min={0} max={500} step={1} className="min-h-11" value={draft[name].kennels} aria-invalid={Boolean(errors[name].kennels)} onChange={(event) => set(name, 'kennels', event.target.value)} />
                </Field>
                <Field label="Held back (quarantine)" error={errors[name].heldBack} help="Kennels kept empty on purpose. They do not count as space.">
                  <Input type="number" inputMode="numeric" min={0} max={500} step={1} className="min-h-11" value={draft[name].heldBack} aria-invalid={Boolean(errors[name].heldBack)} onChange={(event) => set(name, 'heldBack', event.target.value)} />
                </Field>
              </fieldset>
            );
          })}
          <p className="text-sm text-stone-700">Animals count toward a group while they are Available or Pending and are not in a foster home. Leave kennels at 0 for any group you do not want to track.</p>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Save</button>
        </form>
      )}
    </Sheet>
  );
}
