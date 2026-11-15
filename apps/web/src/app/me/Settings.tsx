import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { passwordProblem, type ApiUser, type ChangeEmailInput, type ChangePasswordInput, type FieldErrors, type MemberProfileInput, type MemberProfileResponse } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, useApi } from '../../lib/fetch';
import { Button, ErrorSummary, Field, Input, Textarea } from '../../ui';
import { CheckIcon } from '../../ui/icons';
import { PasswordRules } from '../auth/AuthPage';
import { LoadState, Section } from './common';
import { EmailChoices } from './EmailChoices';
import { forgetAccountSaved } from '../adopt/saved';

/** Save-state line: a small tick or a plain error, always announced. */
function Result({ ok, text }: { ok: boolean; text: string }) {
  if (!text) return <p role="status" className="sr-only" />;
  return ok ? <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-green-900"><CheckIcon aria-hidden="true" /> {text}</p> : <p role="alert" className="text-sm font-semibold text-red-800">{text}</p>;
}

function Profile({ user }: { user: ApiUser }) {
  const queryClient = useQueryClient();
  const profile = useApi<MemberProfileResponse>('/profile', { staleSeconds: 0 });
  const [name, setName] = useState(user.name);
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
    const next = name.trim().replace(/\s+/g, ' ');
    if (!next || next.length > 100) { setErrors({ name: 'Enter a name up to 100 characters long.' }); setSummary(['Enter a name up to 100 characters long.']); return; }
    setBusy(true); setErrors({}); setSummary([]); setResult({ ok: true, text: '' });
    try {
      if (next !== user.name) {
        const response = await api<{ user: ApiUser }>('/auth/profile', { method: 'PUT', json: { name: next } });
        setName(response.user.name);
        queryClient.setQueryData(['/auth/me'], response.user);
      }
      const payload: MemberProfileInput = { phone: phone.trim(), address: address.trim(), dateOfBirth: dob.trim() };
      const saved = await api<MemberProfileResponse>('/profile', { method: 'PUT', json: payload });
      queryClient.setQueryData(['/profile'], saved);
      setResult({ ok: true, text: 'Saved' });
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) { setErrors(error.fieldErrors); setSummary(Object.values(error.fieldErrors)); }
      setResult({ ok: false, text: errorMessage(error, 'We could not save your details.') });
    } finally { setBusy(false); }
  }

  return (
    <Section id="profile" title="About you">
      <LoadState query={profile} label="your details" skeleton="h-56">
        <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
          <ErrorSummary errors={summary} />
          <Field label="Name" error={errors.name}>{(a) => <Input {...a} name="name" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone}>{(a) => <Input {...a} type="tel" name="phone" autoComplete="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
            <Field label="Date of birth" help="Used for age rules." error={errors.dateOfBirth}>{(a) => <Input {...a} type="date" name="dateOfBirth" autoComplete="bday" min="1900-01-01" max={today || undefined} value={dob} onChange={(e) => setDob(e.target.value)} />}</Field>
          </div>
          <Field label="Mailing address" error={errors.address}>{(a) => <Textarea {...a} name="address" rows={2} maxLength={300} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
          <div className="flex flex-wrap items-center gap-4"><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button><Result {...result} /></div>
        </form>
      </LoadState>
    </Section>
  );
}

function EmailForm() {
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
      setResult({ ok: true, text: response.message || 'Check your new inbox for a link to confirm.' });
      setEmail(''); setPassword('');
    } catch (exception) {
      if (exception instanceof ApiRequestError && exception.fieldErrors) setErrors(exception.fieldErrors);
      setResult({ ok: false, text: errorMessage(exception, 'We could not start that email change.') });
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
      <Field label="New email address" error={errors.email}>{(a) => <Input {...a} type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setErrors((c) => ({ ...c, email: '' })); }} />}</Field>
      <Field label="Current password" error={errors.currentPassword}>{(a) => <Input {...a} type="password" name="current-password" autoComplete="current-password" maxLength={1024} value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, currentPassword: '' })); }} />}</Field>
      <div><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Send confirmation'}</Button></div>
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
      setResult({ ok: true, text: 'Password changed' });
      setCurrent(''); setNext('');
    } catch (exception) {
      if (exception instanceof ApiRequestError && exception.fieldErrors) setErrors(exception.fieldErrors);
      setResult({ ok: false, text: errorMessage(exception, 'We could not change your password.') });
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} noValidate className="grid max-w-xl gap-4">
      <Field label="Current password" error={errors.currentPassword}>{(a) => <Input {...a} type="password" name="current-password" autoComplete="current-password" maxLength={1024} value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((c) => ({ ...c, currentPassword: '' })); }} />}</Field>
      <PasswordRules value={next} id="change-password-rules" />
      <div>
        <Field label="New password" error={errors.newPassword}>{(a) => <Input {...a} aria-describedby={[a['aria-describedby'], 'change-password-rules'].filter(Boolean).join(' ')} type={show ? 'text' : 'password'} name="new-password" autoComplete="new-password" maxLength={1024} value={next} onChange={(e) => { setNext(e.target.value); setErrors((c) => ({ ...c, newPassword: '' })); }} />}</Field>
        <button type="button" aria-pressed={show} onClick={() => setShow((v) => !v)} className="mt-2 inline-flex min-h-11 items-center rounded-[var(--ph-radius)] px-2 text-sm font-semibold text-[var(--ph-brand-strong)] underline underline-offset-4">{show ? 'Hide password' : 'Show password'}</button>
      </div>
      <div><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button></div>
      <Result {...result} />
    </form>
  );
}

export function SignOutButton() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      forgetAccountSaved();
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== '/auth/me' });
      queryClient.setQueryData(['/auth/me'], null);
      window.dispatchEvent(new CustomEvent('pawheaven:authchange', { detail: { signedIn: false } }));
    } catch (exception) { setError(errorMessage(exception, 'We could not log you out. Please try again.')); setBusy(false); }
  }
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out'}</Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
    </>
  );
}

/** One row that opens to its form, so the page stays short. */
function Disclosure({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <details className="group border-t border-stone-200 first:border-t-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0"><span className="block font-semibold text-stone-950">{title}</span><span className="block truncate text-sm text-stone-700">{summary}</span></span>
        <span className="shrink-0 font-semibold text-[var(--ph-brand-strong)] group-open:hidden">Change</span>
        <span className="hidden shrink-0 font-semibold text-stone-700 group-open:inline">Close</span>
      </summary>
      <div className="pb-5 pt-2">{children}</div>
    </details>
  );
}

export function Settings({ user }: { user: ApiUser }) {
  return (
    <div className="grid gap-6">
      <Profile user={user} />
      <EmailChoices />
      <Section id="signin" title="Sign-in">
        <div className="max-w-xl">
          <Disclosure title="Email" summary={user.email}><EmailForm /></Disclosure>
          <Disclosure title="Password" summary="••••••••"><PasswordForm /></Disclosure>
        </div>
      </Section>
    </div>
  );
}
