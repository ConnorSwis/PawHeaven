import { useEffect, useState } from 'react';
import { ApiRequestError, api, errorMessage } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, ButtonLink, Card, TextLink } from '../../ui';
import { Mascot, type MascotPose } from '../../ui/Mascot';

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

  const pose: MascotPose = state === 'done' ? 'celebrating' : state === 'missing' || state === 'error' ? 'searching' : 'welcome';
  return (
    <Card className="text-center sm:p-10">
      <div aria-live="polite" className="flex flex-col items-center gap-3">
        <Mascot pose={pose} size={132} />
        {state === 'loading' && <p className="text-base text-stone-800">Checking your link…</p>}
        {(state === 'ready' || state === 'busy') && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">Confirm your subscription</h1>
            <p className="max-w-md text-base leading-7 text-stone-800">Choose the button to start getting our monthly adoption news.</p>
            <Button variant="primary" disabled={state === 'busy'} onClick={() => void confirm()}>{state === 'busy' ? 'Confirming…' : 'Confirm my subscription'}</Button>
          </>
        )}
        {state === 'done' && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">You are subscribed</h1>
            <p className="max-w-md text-base leading-7 text-stone-800">Thank you. You will get adoption news about once a month, and every email has an unsubscribe link.</p>
            <ButtonLink variant="primary" href="/adopt">Meet the animals</ButtonLink>
          </>
        )}
        {(state === 'missing' || state === 'error') && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">We could not confirm that link</h1>
            <p className="max-w-md text-base leading-7 text-stone-800">{state === 'missing' ? 'This link is missing its code. Open the link from your email again, or subscribe again to get a new one.' : problem}</p>
            <TextLink className="inline-flex min-h-11 items-center" href="#newsletter-email">Subscribe again with the form at the bottom of this page</TextLink>
          </>
        )}
      </div>
    </Card>
  );
}

export const ConfirmPage = () => <Providers><ConfirmContent /></Providers>;
