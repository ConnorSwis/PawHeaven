import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EmailPrefs, EmailPrefsInput, SavedSearch, SavedSearchListResponse } from '@pawheaven/contracts';
import { api, errorMessage, useApi } from '../../lib/fetch';
import { Button, Switch } from '../../ui';
import { LoadState, Muted, Row, Section } from './common';

type PrefKey = 'matchDigest' | 'savedChanges' | 'newsletter' | 'fosterAlerts';
const PREFS_KEY = ['/me/email-prefs'];

const CHOICES: { key: PrefKey; label: string }[] = [
  { key: 'matchDigest', label: 'New animals that fit my saved searches' },
  { key: 'savedChanges', label: 'Changes to animals I saved' },
  { key: 'newsletter', label: 'Monthly adoption news' },
  { key: 'fosterAlerts', label: 'When a foster home is needed' },
];

/** Optional emails. Each switch saves the moment it changes; the box flips at once and flips back with a message if the save fails. */
export function EmailChoices() {
  const queryClient = useQueryClient();
  const prefs = useApi<EmailPrefs>('/me/email-prefs', { staleSeconds: 0 });
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');
  const pending = useRef(0);

  async function change(key: PrefKey, value: boolean) {
    const patch = (next: Partial<EmailPrefs>) => queryClient.setQueryData<EmailPrefs>(PREFS_KEY, (current) => (current ? { ...current, ...next } : current));
    setProblem(''); setStatus('');
    patch({ [key]: value });
    pending.current += 1;
    try {
      if (key === 'fosterAlerts') {
        await api('/me/foster-alerts', { method: 'PUT', json: { optIn: value } });
        void queryClient.invalidateQueries({ queryKey: ['/me/involvement'] });
      } else {
        const saved = await api<EmailPrefs>('/me/email-prefs', { method: 'PUT', json: { [key]: value } satisfies EmailPrefsInput });
        patch({ [key]: saved[key] });
      }
      setStatus('Saved');
    } catch (error) {
      patch({ [key]: !value });
      setProblem(`${errorMessage(error, 'We could not save that change.')} It was put back.`);
    } finally { pending.current -= 1; }
  }

  return (
    <Section id="email-choices" title="Emails">
      <LoadState query={prefs} label="your email choices" skeleton="h-36">
        {prefs.data && (
          <div className="grid max-w-2xl gap-4">
            <fieldset className="border-0 p-0">
              <legend className="sr-only">Optional emails</legend>
              <div className="grid gap-2">
                {CHOICES.filter((choice) => choice.key !== 'fosterAlerts' || prefs.data.approvedFoster).map((choice) => (
                  <Switch key={choice.key} label={choice.label} checked={prefs.data[choice.key]} onChange={(event) => void change(choice.key, event.target.checked)} />
                ))}
              </div>
            </fieldset>
            <div className="grid">
              <p role="status" className="text-sm font-semibold text-green-900 [&:not(:empty)]:mt-1">{status}</p>
              <p role="alert" className="text-sm font-semibold text-red-800 [&:not(:empty)]:mt-1">{problem}</p>
            </div>
            <p className="text-sm text-stone-700">Reminders and application updates are always sent.</p>
          </div>
        )}
      </LoadState>
    </Section>
  );
}

const SEARCHES_KEY = ['/me/searches'];

/** The searches that email this member. Removing one stops its emails. */
export function SavedSearches() {
  const queryClient = useQueryClient();
  const searches = useApi<SavedSearchListResponse>('/me/searches', { staleSeconds: 0 });
  const prefs = useApi<EmailPrefs>('/me/email-prefs', { staleSeconds: 0 });
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');

  async function remove(search: SavedSearch) {
    setBusy(search.id); setStatus(''); setProblem('');
    try {
      const response = await api<SavedSearchListResponse>(`/me/searches/${search.id}`, { method: 'DELETE' });
      queryClient.setQueryData(SEARCHES_KEY, response);
      void queryClient.invalidateQueries({ queryKey: PREFS_KEY });
      setStatus(`Removed "${search.label}".`);
    } catch (error) { setProblem(errorMessage(error, 'We could not remove that search. Please try again.')); }
    finally { setBusy(''); }
  }

  const list = searches.data?.searches ?? [];
  return (
    <Section id="saved-searches" title="Saved searches">
      <LoadState query={searches} label="your saved searches" skeleton="h-24">
        {list.length === 0 ? (
          <Muted>No saved searches. Pick filters on the <a className="font-medium underline underline-offset-4" href="/adopt">animals page</a>, then choose Email me new matches.</Muted>
        ) : (
          <>
            {prefs.data && !prefs.data.matchDigest && <Muted className="mb-3 text-sm">New-match emails are off in Settings.</Muted>}
            <ul className="max-w-2xl">
              {list.map((search) => (
                <Row key={search.id} className="items-center">
                  <span className="text-base font-medium text-stone-950">{search.label}</span>
                  <Button variant="secondary" disabled={busy === search.id} onClick={() => void remove(search)}>{busy === search.id ? 'Removing…' : 'Remove'}<span className="sr-only"> the search {search.label}</span></Button>
                </Row>
              ))}
            </ul>
          </>
        )}
        <p role="status" className="text-sm font-semibold text-green-900 [&:not(:empty)]:mt-3">{status}</p>
        <p role="alert" className="text-sm font-semibold text-red-800 [&:not(:empty)]:mt-1">{problem}</p>
      </LoadState>
    </Section>
  );
}
