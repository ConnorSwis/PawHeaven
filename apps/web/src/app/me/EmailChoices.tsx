import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EmailPrefs, EmailPrefsInput, SavedSearch, SavedSearchListResponse } from '@pawheaven/contracts';
import { api, errorMessage, useApi } from '../../lib/fetch';
import { Button, ButtonLink, Choice } from '../../ui';
import { LoadState, Muted, Row, Section } from './common';

type PrefKey = 'matchDigest' | 'savedChanges' | 'newsletter' | 'fosterAlerts';
const PREFS_KEY = ['/me/email-prefs'];

const CHOICES: { key: PrefKey; label: string; on: string; off: string }[] = [
  { key: 'matchDigest', label: 'Daily email when a new animal fits one of my saved searches', on: 'New-match emails are on.', off: 'New-match emails are off.' },
  { key: 'savedChanges', label: 'Daily email when an animal I saved changes', on: 'Saved-animal emails are on.', off: 'Saved-animal emails are off.' },
  { key: 'newsletter', label: 'Monthly adoption news', on: 'Monthly adoption news is on.', off: 'Monthly adoption news is off.' },
  { key: 'fosterAlerts', label: 'Email me when a foster home is needed now', on: 'Foster emails are on.', off: 'Foster emails are off.' },
];

/** Optional emails. Each switch saves the moment it changes; the box flips at once and flips back with a message if the save fails. */
export function EmailChoices() {
  const queryClient = useQueryClient();
  const prefs = useApi<EmailPrefs>('/me/email-prefs', { staleSeconds: 0 });
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');
  const pending = useRef(0);

  async function change(key: PrefKey, value: boolean, text: { on: string; off: string }) {
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
      setStatus(`Saved. ${value ? text.on : text.off}`);
    } catch (error) {
      patch({ [key]: !value });
      setProblem(`${errorMessage(error, 'We could not save that change.')} Your choice was put back the way it was.`);
    } finally { pending.current -= 1; }
  }

  return (
    <Section id="email-choices" title="Email choices">
      <Muted className="mb-4 text-sm">Choose which optional emails you get. Every email has an unsubscribe link too.</Muted>
      <LoadState query={prefs} label="your email choices" skeleton="h-40">
        {prefs.data && (
          <div className="grid max-w-2xl gap-4">
            <fieldset className="border-0 p-0">
              <legend className="sr-only">Optional emails</legend>
              <div className="grid gap-2">
                {CHOICES.filter((choice) => choice.key !== 'fosterAlerts' || prefs.data.approvedFoster).map((choice) => (
                  <Choice key={choice.key} label={choice.label} checked={prefs.data[choice.key]} onChange={(event) => void change(choice.key, event.target.checked, choice)} />
                ))}
              </div>
            </fieldset>
            <div className="-mt-2 grid">
              <p role="status" className="text-sm font-semibold text-green-900 [&:not(:empty)]:mt-1">{status}</p>
              <p role="alert" className="text-sm font-semibold text-red-800 [&:not(:empty)]:mt-1">{problem}</p>
            </div>
            <div className="border-t border-stone-200 pt-4">
              <h3 className="text-base font-semibold text-stone-950">Always sent</h3>
              <ul className="mt-1 list-disc pl-5 text-base leading-7 text-stone-800">
                <li>Reminders for your visits and shifts</li>
                <li>Updates on your applications</li>
              </ul>
            </div>
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
      setStatus(`Removed the search "${search.label}". You will not get emails for it.`);
    } catch (error) { setProblem(errorMessage(error, 'We could not remove that search. Please try again.')); }
    finally { setBusy(''); }
  }

  const list = searches.data?.searches ?? [];
  return (
    <Section id="saved-searches" title="Your saved searches">
      <LoadState query={searches} label="your saved searches" skeleton="h-24">
        {list.length === 0 ? (
          <div className="max-w-2xl">
            <Muted>You have no saved searches. On the Adopt page, choose some filters, such as large dogs who are good with kids, then choose Email me new matches. We will email you when a new animal fits.</Muted>
            <div className="mt-3"><ButtonLink variant="secondary" href="/adopt">Go to the Adopt page</ButtonLink></div>
          </div>
        ) : (
          <>
            {prefs.data && !prefs.data.matchDigest && <Muted className="mb-3 text-sm">New-match emails are turned off above, so these searches will not email you until you turn them on.</Muted>}
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
