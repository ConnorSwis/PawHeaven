import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EmailPrefs, SavedSearchFilters, SavedSearchListResponse } from '@pawheaven/contracts';
import { api, errorMessage, loginUrl, useMe } from '../../lib/fetch';
import { Button, buttonClass, TextLink } from '../../ui';
import { activeFilterCount, type Filters } from './filters';

/** The filters that can be emailed about. The search words and sort order are not part of a saved search. */
export function alertFilters(filters: Filters): SavedSearchFilters {
  const result: SavedSearchFilters = {};
  if (filters.species) result.species = filters.species;
  if (filters.size) result.size = filters.size;
  if (filters.age) result.age = filters.age;
  if (filters.sex) result.sex = filters.sex;
  if (filters.energy) result.energy = filters.energy;
  if (filters.kids) result.kids = true;
  if (filters.dogs) result.dogs = true;
  if (filters.cats) result.cats = true;
  if (filters.foster) result.foster = true;
  return result;
}

const sameFilters = (a: SavedSearchFilters, b: SavedSearchFilters) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof SavedSearchFilters>;
  return [...keys].every((key) => a[key] === b[key]);
};

type Outcome = { kind: 'saved' | 'info' | 'error' | 'signin'; text: string; extra?: string } | null;

/** "Email me new matches": saves the current filters as an alert for members, and asks guests to sign in first. */
export function EmailAlert({ filters }: { filters: Filters }) {
  const queryClient = useQueryClient();
  const me = useMe();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const wanted = alertFilters(filters);
  const signature = JSON.stringify(wanted);
  const active = activeFilterCount(filters) > 0;

  // A confirmation belongs to the search it was made for, so it goes away when the filters change.
  useEffect(() => setOutcome(null), [signature]);

  if (!active) return <div role="status" className="sr-only" />;

  async function start() {
    if (busy) return;
    setBusy(true); setOutcome(null);
    try {
      const user = me.data ?? (me.isPending ? (await me.refetch()).data : null);
      if (!user) { setOutcome({ kind: 'signin', text: 'Sign in to get email alerts' }); return; }
      const existing = await api<SavedSearchListResponse>('/me/searches');
      if (existing.searches.some((search) => sameFilters(search.filters, wanted))) {
        setOutcome({ kind: 'info', text: 'You already get emails for this search. You can change this in My PawHeaven.' });
        return;
      }
      const saved = await api<SavedSearchListResponse>('/me/searches', { method: 'POST', json: { filters: wanted } });
      queryClient.setQueryData(['/me/searches'], saved);
      void queryClient.invalidateQueries({ queryKey: ['/me/email-prefs'] });
      const prefs = await api<EmailPrefs>('/me/email-prefs').catch(() => null);
      setOutcome({
        kind: 'saved',
        text: 'We will email you once a day when a new animal fits this search. Change this in My PawHeaven.',
        extra: prefs && !prefs.matchDigest ? 'New-match emails are turned off right now. Turn them on in My PawHeaven.' : undefined,
      });
    } catch (error) {
      setOutcome({ kind: 'error', text: errorMessage(error, 'We could not save this search. Please try again.') });
    } finally { setBusy(false); }
  }

  const tone = outcome?.kind === 'error' ? 'border-red-300 bg-red-50 text-red-900' : outcome?.kind === 'saved' ? 'border-green-300 bg-green-50 text-green-900' : 'border-stone-300 bg-stone-50 text-stone-900';
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  return (
    <div className="w-full">
      <Button variant="secondary" disabled={busy} onClick={() => void start()}>{busy ? 'Saving this search…' : 'Email me new matches'}</Button>
      <div role="status" className="mt-3">
        {outcome && (
          <div className={`rounded-[var(--ph-radius)] border p-4 text-sm leading-6 ${tone}`}>
            <p className="font-semibold">{outcome.text}</p>
            {outcome.extra && <p className="mt-1">{outcome.extra}</p>}
            {outcome.kind === 'signin' && (
              <div className="mt-3 flex flex-wrap gap-3">
                <a className={buttonClass('primary')} href={loginUrl()}>Sign in<span className="sr-only"> to get email alerts</span></a>
                <a className={buttonClass('secondary')} href={`/sign-up?next=${next}`}>Create account<span className="sr-only"> to get email alerts</span></a>
              </div>
            )}
            {(outcome.kind === 'saved' || outcome.kind === 'info') && <p className="mt-2"><TextLink className="inline-flex min-h-11 items-center" href="/me#details">Manage your email choices</TextLink></p>}
          </div>
        )}
      </div>
    </div>
  );
}
