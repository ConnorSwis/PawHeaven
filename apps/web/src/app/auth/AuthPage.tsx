import { useEffect, useRef, useState, type ComponentProps, type SyntheticEvent, type ReactNode } from 'react';
import { passwordProblem, type FieldErrors } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, useMe } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, ButtonLink, Card, ErrorSummary, Field, Input, Notice, TextLink } from '../../ui';
import { CheckIcon } from '../../ui/icons';
import { finishSignIn, readNext, withNext } from './next';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turns a failed request into wording a person can act on. */
function requestMessage(error: unknown, kind: 'log in' | 'create your account'): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) return 'Too many attempts. Please wait a few minutes before trying again.';
    if (error.status >= 500) return 'Our account service is having trouble right now. Please try again in a few minutes.';
    return error.message;
  }
  if (error instanceof TypeError) return `We could not reach the account service to ${kind}. Check your connection and try again.`;
  return errorMessage(error);
}

function PasswordInput({ show, ...props }: ComponentProps<typeof Input> & { show: boolean }) {
  return <Input {...props} type={show ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} maxLength={1024} />;
}

/** The "Show password" control sits under the field so it is easy to reach and reads clearly. */
function ShowPassword({ show, onToggle, label = 'Show password' }: { show: boolean; onToggle: () => void; label?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={show} className="mt-2 inline-flex min-h-11 items-center rounded-[var(--ph-radius)] px-2 text-sm font-semibold text-[var(--ph-brand-strong)] underline underline-offset-4 hover:text-stone-950">
      {show ? 'Hide password' : label}
    </button>
  );
}

function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>
      <p className="mt-2 text-base leading-7 text-stone-700">{intro}</p>
      <Card className="mt-6">{children}</Card>
    </div>
  );
}

function AlreadySignedIn({ name, next }: { name: string; next: string }) {
  return (
    <Notice tone="info" title={`You are already signed in as ${name}.`} className="mb-5">
      <a className="font-semibold underline underline-offset-4" href={next}>Continue</a>
    </Notice>
  );
}

function LoginForm() {
  const me = useMe();
  const [next, setNext] = useState('/me');
  useEffect(() => setNext(readNext()), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [summaryTitle, setSummaryTitle] = useState('Please fix the following');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clear = (name: string) => { setSummary([]); setFieldErrors((current) => ({ ...current, [name]: '' })); };

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (busy) return;
    const problems: FieldErrors = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) problems.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(cleanEmail)) problems.email = 'Enter an email address like name@example.com.';
    if (!password) problems.password = 'Enter your password.';
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      setSummaryTitle('Please fix the following');
      setSummaryTitle('Please fix the following'); setSummary(Object.values(problems));
      (problems.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setSummary([]);
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', json: { email: cleanEmail, password }, signal: AbortSignal.timeout(15_000) });
      finishSignIn(next);
    } catch (error) {
      setSummaryTitle('We could not log you in');
      setSummaryTitle('We could not log you in');
      setSummary([error instanceof DOMException && error.name === 'TimeoutError' ? 'Logging in is taking too long. Check your connection and try again.' : requestMessage(error, 'log in')]);
      setBusy(false);
    }
  }

  return (
    <Shell title="Log in" intro="Welcome back. Log in to see your visits, applications, and saved details.">
      {me.data && <AlreadySignedIn name={me.data.name} next={next} />}
      <form onSubmit={submit} noValidate className="grid gap-5">
        <ErrorSummary errors={summary} title={summaryTitle} />
        <Field label="Email address" error={fieldErrors.email || undefined}>
          {(a) => <Input {...a} ref={emailRef} type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); clear('email'); }} />}
        </Field>
        <div>
          <Field label="Password" error={fieldErrors.password || undefined}>
            {(a) => <PasswordInput {...a} ref={passwordRef} show={show} name="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} />}
          </Field>
          <ShowPassword show={show} onToggle={() => setShow((value) => !value)} />
        </div>
        <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
        <p role="status" className="sr-only">{busy ? 'Logging in' : ''}</p>
      </form>
      <p className="mt-6 text-base text-stone-800">New here? <TextLink href={withNext('/sign-up', next)}>Create an account</TextLink></p>
    </Shell>
  );
}

const RULES: { text: string; test: (value: string) => boolean }[] = [
  { text: 'At least 8 characters', test: (v) => v.length >= 8 },
  { text: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { text: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { text: 'A number', test: (v) => /[0-9]/.test(v) },
  { text: 'A special character, such as ! or ?', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** Shown before anyone submits. Each rule says "met" or "needed" in words, not only with an icon. */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  return (
    <div id={id} className="rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 p-3 text-sm text-stone-800">
      <p className="font-semibold text-stone-950">Your password needs:</p>
      <ul className="mt-1.5 grid gap-1">
        {RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.text} className="flex items-center gap-2">
              {met ? <CheckIcon width={16} height={16} aria-hidden="true" /> : <span aria-hidden="true" className="inline-block size-4 rounded-full border border-stone-500" />}
              <span>{rule.text}<span className="sr-only">{met ? ' (met)' : ' (needed)'}</span></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SignUpForm() {
  const me = useMe();
  const [next, setNext] = useState('/me');
  useEffect(() => setNext(readNext()), []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [summaryTitle, setSummaryTitle] = useState('Please fix the following');
  const [checkInbox, setCheckInbox] = useState(false);
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  const inboxRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (checkInbox) inboxRef.current?.focus(); }, [checkInbox]);

  const clear = (field: string) => { setSummary([]); setFieldErrors((current) => ({ ...current, [field]: '' })); };

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (busy) return;
    const problems: FieldErrors = {};
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim();
    if (!cleanName) problems.name = 'Enter your full name.';
    else if (cleanName.length > 100) problems.name = 'Please use 100 characters or fewer for your name.';
    if (!cleanEmail) problems.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(cleanEmail)) problems.email = 'Enter an email address like name@example.com.';
    if (!password) problems.password = 'Create a password.';
    else if (passwordProblem(password)) problems.password = passwordProblem(password) ?? '';
    if (!confirm) problems.confirm = 'Type your password again to confirm it.';
    else if (confirm !== password) problems.confirm = 'The two passwords do not match.';
    setFieldErrors(problems);
    const order = ['name', 'email', 'password', 'confirm'] as const;
    const first = order.find((key) => problems[key]);
    if (first) {
      setSummaryTitle('Please fix the following');
      setSummaryTitle('Please fix the following'); setSummary(order.flatMap((key) => (problems[key] ? [problems[key]] : [])));
      refs[first].current?.focus();
      return;
    }
    setSummary([]);
    setBusy(true);
    try {
      const result = await api<{ requiresEmailConfirmation?: boolean }>('/auth/register', { method: 'POST', json: { name: cleanName, email: cleanEmail, password }, signal: AbortSignal.timeout(15_000) });
      if (result.requiresEmailConfirmation) { setCheckInbox(true); setBusy(false); return; }
      finishSignIn(next);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) setFieldErrors((current) => ({ ...current, ...error.fieldErrors }));
      setSummaryTitle('We could not create your account');
      setSummaryTitle('We could not create your account');
      setSummary([error instanceof DOMException && error.name === 'TimeoutError' ? 'Creating your account is taking too long. Check your connection and try again.' : requestMessage(error, 'create your account')]);
      setBusy(false);
    }
  }

  if (checkInbox) {
    return (
      <Shell title="Check your inbox" intro="One more step before you can log in.">
        <div ref={inboxRef} tabIndex={-1} className="grid gap-4 focus:outline-none">
          <Notice tone="success" title="We sent you an email.">
            If the address can be used for an account, the next steps are in your inbox. Open the email and confirm your address, then log in. If it does not arrive in a few minutes, check your spam folder.
          </Notice>
          <ButtonLink variant="primary" href={withNext('/login', next)}>Go to log in</ButtonLink>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Create your account" intro="An account lets you book a visit, apply to adopt or foster, and sign up to volunteer. You can look around the whole site without one.">
      {me.data && <AlreadySignedIn name={me.data.name} next={next} />}
      <form onSubmit={submit} noValidate className="grid gap-5">
        <ErrorSummary errors={summary} title={summaryTitle} />
        <Field label="Full name" error={fieldErrors.name || undefined}>
          {(a) => <Input {...a} ref={refs.name} name="name" autoComplete="name" maxLength={100} value={name} onChange={(e) => { setName(e.target.value); clear('name'); }} />}
        </Field>
        <Field label="Email address" help="We email confirmations and reminders here." error={fieldErrors.email || undefined}>
          {(a) => <Input {...a} ref={refs.email} type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); clear('email'); }} />}
        </Field>
        <PasswordRules value={password} id="password-rules" />
        <div>
          <Field label="Create a password" error={fieldErrors.password || undefined}>
            {(a) => <PasswordInput {...a} aria-describedby={[a['aria-describedby'], 'password-rules'].filter(Boolean).join(' ')} ref={refs.password} show={show} name="new-password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} />}
          </Field>
          <ShowPassword show={show} onToggle={() => setShow((value) => !value)} label="Show passwords" />
        </div>
        <Field label="Type the password again" error={fieldErrors.confirm || undefined}>
          {(a) => <PasswordInput {...a} ref={refs.confirm} show={show} name="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); clear('confirm'); }} />}
        </Field>
        <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? 'Creating account…' : 'Create account'}</Button>
        <p role="status" className="sr-only">{busy ? 'Creating your account' : ''}</p>
      </form>
      <p className="mt-6 text-base text-stone-800">Already have an account? <TextLink href={withNext('/login', next)}>Log in</TextLink></p>
    </Shell>
  );
}

export const LoginPage = () => <Providers><LoginForm /></Providers>;
export const SignUpPage = () => <Providers><SignUpForm /></Providers>;
