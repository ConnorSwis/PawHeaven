import { useEffect, useState } from 'react';
import { ApiRequestError, api, errorMessage } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, TextLink } from '../../ui';

type State = 'loading' | 'ready' | 'missing' | 'busy' | 'done' | 'error';

function ConfirmContent() {
  const [state, setState] = useState<State>('loading');
  const [token, setToken] = useState('');
  const [problem, setProblem] = useState('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('t') ?? '';
    setToken(value);
    setState(value ? 'ready' : 'missing');
  }, []);

  // A button, not the page load: link scanners open emails' links, and confirming should be a person's choice.
  async function confirm() {
    setState('busy'); setProblem('');
    try {
      await api('/public/newsletter/confirm', { method: 'POST', json: { token } });
      setState('done');
    } catch (error) {
      setProblem(error instanceof ApiRequestError && error.status === 404 ? error.message : errorMessage(error, 'We could not confirm your subscription. Please try again.'));
      setState('error');
    }
  }

  return (
    <div aria-live="polite">
      {state === 'loading' && <p>Checking your link…</p>}
      {(state === 'ready' || state === 'busy') && (
        <>
          <h2>Confirm your subscription</h2>
          <p>Choose the button to start getting our monthly adoption news.</p>
          <p><Button variant="primary" disabled={state === 'busy'} onClick={() => void confirm()}>{state === 'busy' ? 'Confirming…' : 'Confirm my subscription'}</Button></p>
        </>
      )}
      {state === 'done' && (
        <>
          <h2>You are subscribed</h2>
          <p>Thank you. You will get adoption news about once a month, and every email has an unsubscribe link.</p>
          <p><TextLink className="inline-flex min-h-11 items-center" href="/adopt">Meet the animals</TextLink></p>
        </>
      )}
      {(state === 'missing' || state === 'error') && (
        <>
          <h2>We could not confirm that link</h2>
          <p>{state === 'missing' ? 'This link is missing its code. Open the link from your email again, or subscribe again to get a new one.' : problem}</p>
          <p><a className="inline-flex min-h-11 items-center" href="#newsletter-email">Subscribe again with the form at the bottom of this page</a></p>
        </>
      )}
    </div>
  );
}

export const ConfirmPage = () => <Providers><ConfirmContent /></Providers>;
