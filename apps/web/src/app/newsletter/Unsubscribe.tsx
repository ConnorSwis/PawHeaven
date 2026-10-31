import { useEffect, useState } from 'react';
import type { UnsubscribeResponse, UnsubscribeScope } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, TextLink } from '../../ui';

const SCOPES: UnsubscribeScope[] = ['newsletter', 'alerts', 'all'];

/** Reads the readable half of the signed token only to describe what the button will do. The server checks the signature. */
function describe(token: string): { email: string; scope: UnsubscribeScope } | null {
  try {
    if (!token || token.length > 2000) return null;
    const payload = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), (character) => character.charCodeAt(0)))) as { e?: unknown; s?: unknown };
    if (typeof parsed.e !== 'string' || !parsed.e.includes('@') || !SCOPES.includes(parsed.s as UnsubscribeScope)) return null;
    return { email: parsed.e, scope: parsed.s as UnsubscribeScope };
  } catch { return null; }
}

const mask = (email: string) => {
  const at = email.lastIndexOf('@');
  return `${email.slice(0, 1)}***${email.slice(at)}`;
};

const ACTION: Record<UnsubscribeScope, (email: string) => string> = {
  newsletter: (email) => `Stop the monthly newsletter for ${email}`,
  alerts: (email) => `Stop new-match and saved-animal emails for ${email}`,
  all: (email) => `Stop all optional email for ${email}`,
};
const DONE: Record<UnsubscribeScope, string> = {
  newsletter: 'You will not get the monthly newsletter any more.',
  alerts: 'You will not get new-match or saved-animal emails any more.',
  all: 'You will not get any optional email from us any more.',
};

type State = 'loading' | 'ready' | 'invalid' | 'busy' | 'done' | 'error';

function UnsubscribeContent() {
  const [state, setState] = useState<State>('loading');
  const [token, setToken] = useState('');
  const [info, setInfo] = useState<{ email: string; scope: UnsubscribeScope } | null>(null);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState<UnsubscribeScope>('newsletter');
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('t') ?? '';
    const found = describe(value);
    setToken(value); setInfo(found); setState(found ? 'ready' : 'invalid');
  }, []);

  // Opening the link only shows this page. Nothing changes until the button is pressed.
  async function unsubscribe() {
    setState('busy'); setProblem('');
    try {
      const result = await api<UnsubscribeResponse>('/public/unsubscribe', { method: 'POST', json: { token } });
      setDone(result.scope);
      setState('done');
    } catch (error) {
      const message = errorMessage(error, 'We could not unsubscribe you just now. Please try again.');
      setProblem(message);
      // A refused link (400) will never work, so say so instead of offering the button again.
      setState(error instanceof ApiRequestError && error.status === 400 ? 'invalid' : 'error');
    }
  }

  const manage = <TextLink className="inline-flex min-h-11 items-center" href="/me#details">Manage your email choices in My PawHeaven</TextLink>;
  return (
    <div aria-live="polite">
      {state === 'loading' && <p>Checking your link…</p>}
      {(state === 'ready' || state === 'busy' || state === 'error') && info && (
        <>
          <h2>{ACTION[info.scope](mask(info.email))}</h2>
          {info.scope !== 'newsletter' && <p>You will still get reminders for your visits and shifts, and updates on your applications.</p>}
          <p><Button variant="primary" disabled={state === 'busy'} onClick={() => void unsubscribe()}>{state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe'}</Button></p>
          {state === 'error' && <p role="alert" className="font-semibold text-red-800">{problem}</p>}
        </>
      )}
      {state === 'done' && (
        <>
          <h2>You are unsubscribed</h2>
          <p>{DONE[done]}</p>
          <p>Changed your mind? {manage}.</p>
          <p><TextLink className="inline-flex min-h-11 items-center" href="/">Go to the home page</TextLink></p>
        </>
      )}
      {state === 'invalid' && (
        <>
          <h2>That unsubscribe link did not work</h2>
          <p>{problem || 'The unsubscribe link looks incomplete or out of date. Try the link in your most recent email, or change your choices yourself in My PawHeaven.'}</p>
          <p>{manage}</p>
          <p><TextLink className="inline-flex min-h-11 items-center" href="/">Go to the home page</TextLink></p>
        </>
      )}
    </div>
  );
}

export const UnsubscribePage = () => <Providers><UnsubscribeContent /></Providers>;
