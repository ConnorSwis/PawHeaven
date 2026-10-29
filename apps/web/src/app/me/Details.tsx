import { useEffect, useState, type SyntheticEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { passwordProblem, type ApiUser, type ChangeEmailInput, type ChangePasswordInput, type FieldErrors, type MemberProfileInput, type MemberProfileResponse } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, useApi } from '../../lib/fetch';
import { Button, ErrorSummary, Field, Input, Notice, Textarea } from '../../ui';
import { PasswordRules } from '../auth/AuthPage';
import { LoadState, Muted, Section } from './common';

/** Shared save-state line: a confirmation or an error, always announced. */
function Result({ ok, text }: { ok: boolean; text: string }) {
  if (!text) return <p role="status" className="sr-only" />;
  return ok ? <Notice tone="success">{text}</Notice> : <Notice tone="error">{text}</Notice>;
}

function ContactDetails() {
  const queryClient = useQueryClient();
  const profile = useApi<MemberProfileResponse>('/profile', { staleSeconds: 0 });
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState('');
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  useEffect(() => {
    if (profile.data && !loaded) { setPhone(profile.data.profile.phone ?? ''); setAddress(profile.data.profile.address ?? ''); setDob(profile.data.profile.dateOfBirth ?? ''); setLoaded(true); }
  }, [profile.data, loaded]);

  async function save(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true); setErrors({}); setSummary([]); setResult({ ok: true, text: '' });
    try {
      const payload: MemberProfileInput = { phone: phone.trim(), address: address.trim(), dateOfBirth: dob.trim() };
      const saved = await api<MemberProfileResponse>('/profile', { method: 'PUT', json: payload });
      queryClient.setQueryData(['/profile'], saved);
      setResult({ ok: true, text: 'Your details were saved. They will be filled in on your forms.' });
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) { setErrors(error.fieldErrors); setSummary(Object.values(error.fieldErrors)); }
      setResult({ ok: false, text: errorMessage(error, 'We could not save your details.') });
    } finally { setBusy(false); }
  }

  return (
    <Section id="contact" title="Saved contact details">
      <Muted className="mb-4">Saved once, then filled in on your adoption, foster, volunteer, and visit forms. Only you and shelter staff can see them.</Muted>
      <LoadState query={profile} label="your saved details" skeleton="h-40">
        <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
          <ErrorSummary errors={summary} />
          <Field label="Phone number" error={errors.phone}>{(a) => <Input {...a} type="tel" name="phone" autoComplete="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Field label="Mailing address" error={errors.address}>{(a) => <Textarea {...a} name="address" rows={2} maxLength={300} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
          <Field label="Date of birth" help="Used to check age rules for adoption, fostering, and volunteering." error={errors.dateOfBirth}>{(a) => <Input {...a} type="date" name="dateOfBirth" autoComplete="bday" min="1900-01-01" max={today || undefined} value={dob} onChange={(e) => setDob(e.target.value)} />}</Field>
          <div><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</Button></div>
          <Result {...result} />
        </form>
      </LoadState>
    </Section>
  );
}

function NameForm({ user }: { user: ApiUser }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [busy, setBusy] = useState(false);
  async function save(event: SyntheticEvent) {
    event.preventDefault();
    const next = name.trim().replace(/\s+/g, ' ');
    if (!next || next.length > 100) { setError('Enter a name up to 100 characters long.'); return; }
    setError(undefined); setBusy(true); setResult({ ok: true, text: '' });
    try {
      const response = await api<{ user: ApiUser }>('/auth/profile', { method: 'PUT', json: { name: next } });
      setName(response.user.name);
      queryClient.setQueryData(['/auth/me'], response.user);
      setResult({ ok: true, text: 'Your name was saved.' });
    } catch (exception) { setResult({ ok: false, text: errorMessage(exception, 'We could not save your name.') }); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
      <h3 className="text-lg font-semibold text-stone-950">Your name</h3>
      <Field label="Full name" error={error}>{(a) => <Input {...a} name="name" autoComplete="name" maxLength={100} value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} />}</Field>
      <div><Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save name'}</Button></div>
      <Result {...result} />
    </form>
  );
}

function EmailForm({ user }: { user: ApiUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [busy, setBusy] = useState(false);
  async function save(event: SyntheticEvent) {
    event.preventDefault();
    const problems: FieldErrors = {};
    if (!email.trim()) problems.email = 'Enter the new email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) problems.email = 'Enter an email address like name@example.com.';
    if (!password) problems.currentPassword = 'Enter your current password to confirm it is you.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true); setResult({ ok: true, text: '' });
    try {
      const payload: ChangeEmailInput = { email: email.trim(), currentPassword: password };
      const response = await api<{ message: string }>('/auth/email', { method: 'PUT', json: payload });
      setResult({ ok: true, text: response.message || 'Check your new inbox for a link to confirm the change.' });
      setEmail(''); setPassword('');
    } catch (exception) {
      if (exception instanceof ApiRequestError && exception.fieldErrors) setErrors(exception.fieldErrors);
      setResult({ ok: false, text: errorMessage(exception, 'We could not start that email change.') });
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
      <h3 className="text-lg font-semibold text-stone-950">Change email address</h3>
      <Muted className="text-sm">You sign in with <strong className="text-stone-950">{user.email}</strong>. We will email a link to the new address to confirm the change.</Muted>
      <Field label="New email address" error={errors.email}>{(a) => <Input {...a} type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setErrors((c) => ({ ...c, email: '' })); }} />}</Field>
      <Field label="Current password" error={errors.currentPassword}>{(a) => <Input {...a} type="password" name="current-password" autoComplete="current-password" maxLength={1024} value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, currentPassword: '' })); }} />}</Field>
      <div><Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save new email'}</Button></div>
      <Result {...result} />
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });
  const [busy, setBusy] = useState(false);
  async function save(event: SyntheticEvent) {
    event.preventDefault();
    const problems: FieldErrors = {};
    if (!current) problems.currentPassword = 'Enter your current password.';
    if (!next) problems.newPassword = 'Choose a new password.';
    else if (passwordProblem(next)) problems.newPassword = passwordProblem(next) ?? '';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true); setResult({ ok: true, text: '' });
    try {
      const payload: ChangePasswordInput = { currentPassword: current, newPassword: next };
      await api('/auth/change-password', { method: 'POST', json: payload });
      setResult({ ok: true, text: 'Your password was changed.' });
      setCurrent(''); setNext('');
    } catch (exception) {
      if (exception instanceof ApiRequestError && exception.fieldErrors) setErrors(exception.fieldErrors);
      setResult({ ok: false, text: errorMessage(exception, 'We could not change your password.') });
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
      <h3 className="text-lg font-semibold text-stone-950">Change password</h3>
      <Field label="Current password" error={errors.currentPassword}>{(a) => <Input {...a} type="password" name="current-password" autoComplete="current-password" maxLength={1024} value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((c) => ({ ...c, currentPassword: '' })); }} />}</Field>
      <PasswordRules value={next} id="change-password-rules" />
      <div>
        <Field label="New password" error={errors.newPassword}>{(a) => <Input {...a} aria-describedby={[a['aria-describedby'], 'change-password-rules'].filter(Boolean).join(' ')} type={show ? 'text' : 'password'} name="new-password" autoComplete="new-password" maxLength={1024} value={next} onChange={(e) => { setNext(e.target.value); setErrors((c) => ({ ...c, newPassword: '' })); }} />}</Field>
        <button type="button" aria-pressed={show} onClick={() => setShow((v) => !v)} className="mt-2 inline-flex min-h-11 items-center rounded-[var(--ph-radius)] px-2 text-sm font-semibold text-[var(--ph-brand-strong)] underline underline-offset-4">{show ? 'Hide password' : 'Show password'}</button>
      </div>
      <div><Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button></div>
      <Result {...result} />
    </form>
  );
}

function SignOut() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== '/auth/me' });
      queryClient.setQueryData(['/auth/me'], null);
      window.dispatchEvent(new CustomEvent('pawheaven:authchange', { detail: { signedIn: false } }));
    } catch (exception) { setError(errorMessage(exception, 'We could not log you out. Please try again.')); setBusy(false); }
  }
  return (
    <Section id="signout" title="Sign out">
      <Muted>Sign out on this device when you are done, especially on a shared computer.</Muted>
      <div className="mt-3"><Button variant="secondary" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out'}</Button></div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
    </Section>
  );
}

export function Details({ user }: { user: ApiUser }) {
  return (
    <div className="grid gap-6">
      <ContactDetails />
      <Section id="account" title="Name, email, and password">
        <div className="grid gap-8 divide-y divide-stone-200 [&>form:not(:first-child)]:pt-8">
          <NameForm user={user} />
          <EmailForm user={user} />
          <PasswordForm />
        </div>
      </Section>
      <SignOut />
    </div>
  );
}
