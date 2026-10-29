import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiUser, FieldErrors, PublicAvailability, VolunteerRegistration, VolunteerRegistrationListResponse, VolunteerShift, VolunteerShiftListResponse } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Select, Sheet, Skeleton, TextLink } from '../../ui';
import { api, ApiRequestError, errorMessage, loginUrl, useApi, useMe } from '../../lib/fetch';
import { loadProfile, saveProfile } from '../../lib/profile';
import { Providers } from '../../lib/providers';
import { useToast } from '../../ui/toast';
import { ageFrom, ClientOnly, Problems, plainDate, dayKey, dayLong, groupBy, plural, shelterToday, timeRange, weekLabel, weekStart, zoneName } from '../involve/common';

type Shift = Omit<VolunteerShift, 'spotsRemaining'> & { spotsLeft: number };

const normalizeMember = (shift: VolunteerShift): Shift => ({ ...shift, spotsLeft: shift.spotsRemaining });
const normalizePublic = (shift: PublicAvailability['shifts'][number]): Shift => ({ ...shift, registered: false });

function SignUpSheet({ shift, user, onClose, onDone }: { shift: Shift; user: ApiUser; onClose: () => void; onDone: () => void }) {
  const profile = useQuery({ queryKey: ['/profile'], queryFn: loadProfile, staleTime: 30_000 });
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [changePhone, setChangePhone] = useState(false);
  const [changeDob, setChangeDob] = useState(false);
  const [saveDetails, setSaveDetails] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const savedPhone = profile.data?.phone ?? '';
  const savedDob = profile.data?.dateOfBirth ?? '';
  const askPhone = !savedPhone || changePhone;
  const askDob = !savedDob || changeDob;
  const toast = useToast();
  const queryClient = useQueryClient();

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    const chosenPhone = (askPhone ? phone : savedPhone).trim();
    const chosenDob = (askDob ? dob : savedDob).trim();
    const problems: FieldErrors = {};
    if (chosenPhone.replace(/\D/g, '').length < 10) problems.phone = chosenPhone ? 'Enter a valid phone number with at least 10 digits.' : 'Enter a phone number where the shelter can reach you.';
    const age = chosenDob ? ageFrom(chosenDob) : null;
    if (!chosenDob) problems.dateOfBirth = 'Enter your date of birth.';
    else if (age === null || age < 0 || age > 120) problems.dateOfBirth = 'Enter a valid date of birth.';
    else if (shift.minAge > 0 && age < shift.minAge) problems.dateOfBirth = `Volunteers on this shift must be at least ${shift.minAge} years old.`;
    setFieldErrors(problems);
    setSummary(Object.values(problems));
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      await api(`/volunteer/shifts/${encodeURIComponent(shift.id)}/register`, { method: 'POST', json: { phone: chosenPhone, dateOfBirth: chosenDob } });
      if (saveDetails && (askPhone || askDob)) void saveProfile({ phone: chosenPhone, dateOfBirth: chosenDob });
      toast.success(`You are signed up for ${shift.title}. We emailed a confirmation.`);
      onDone();
    } catch (failure) {
      const errors = failure instanceof ApiRequestError ? failure.fieldErrors : undefined;
      if (errors) {
        setFieldErrors(errors);
        setSummary(Object.values(errors));
        if (errors.phone) setChangePhone(true);
        if (errors.dateOfBirth) setChangeDob(true);
      } else {
        setSummary([errorMessage(failure, 'We could not sign you up. Please try again.')]);
        // A full, canceled, or overlapping shift changes the list, so refresh it.
        void queryClient.invalidateQueries({ queryKey: ['/volunteer/shifts'] });
      }
    } finally { setBusy(false); }
  }

  const formId = `signup-${shift.id}`;
  return (
    <Sheet
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Sign up for ${shift.title}`}
      description={`${dayLong(shift.startsAt)}, ${timeRange(shift.startsAt, shift.endsAt)} ${zoneName(shift.startsAt)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Not now</Button><Button variant="primary" type="submit" form={formId} disabled={busy || profile.isLoading}>{busy ? 'Signing up…' : 'Confirm sign-up'}</Button></>}
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-5">
        <Problems errors={summary} />
        <p className="text-base leading-7 text-stone-800">We will email a confirmation to <strong>{user.email}</strong>. {shift.minAge > 0 ? `Volunteers on this shift must be at least ${shift.minAge} years old.` : ''}</p>
        {profile.isLoading ? (
          <div aria-hidden="true" className="grid gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : (
          <>
            {!askPhone ? (
              <div className="flex items-center justify-between gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 p-3">
                <p className="text-base text-stone-900"><span className="block text-sm font-semibold text-stone-950">Phone number</span>{savedPhone}</p>
                <Button variant="ghost" onClick={() => { setPhone(savedPhone); setChangePhone(true); }}>Change<span className="sr-only"> phone number</span></Button>
              </div>
            ) : (
              <Field label="Phone number" required error={fieldErrors.phone} help="So the shelter can reach you if plans change.">
                {(aria) => <Input {...aria} name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => { setPhone(event.target.value); setFieldErrors((current) => ({ ...current, phone: '' })); }} placeholder="(404) 555-0142" />}
              </Field>
            )}
            {!askDob ? (
              <div className="flex items-center justify-between gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 p-3">
                <p className="text-base text-stone-900"><span className="block text-sm font-semibold text-stone-950">Date of birth</span>{plainDate(savedDob)}</p>
                <Button variant="ghost" onClick={() => { setDob(savedDob); setChangeDob(true); }}>Change<span className="sr-only"> date of birth</span></Button>
              </div>
            ) : (
              <Field label="Date of birth" required error={fieldErrors.dateOfBirth} help="Used only to check each shift's age rule.">
                {(aria) => <Input {...aria} name="dateOfBirth" type="date" autoComplete="bday" min="1900-01-01" max={shelterToday()} value={dob} onChange={(event) => { setDob(event.target.value); setFieldErrors((current) => ({ ...current, dateOfBirth: '' })); }} />}
              </Field>
            )}
            {(askPhone || askDob) && (
              <label className="flex min-h-11 items-start gap-3 text-base text-stone-900">
                <input type="checkbox" className="mt-1 size-4 shrink-0" checked={saveDetails} onChange={(event) => setSaveDetails(event.target.checked)} />
                <span>Save these details to My PawHeaven so I do not have to type them again. I can change them any time.</span>
              </label>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}

function CancelSheet({ registration, onClose, onDone }: { registration: VolunteerRegistration; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await api(`/volunteer/registrations/${encodeURIComponent(registration.id)}/cancel`, { method: 'POST' });
      toast.success(`Your sign-up for ${registration.title} is canceled. Your spot is open for someone else.`);
      onDone();
    } catch (failure) { setError(errorMessage(failure, 'We could not cancel that. Please try again.')); } finally { setBusy(false); }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Cancel your sign-up?"
      description={`${registration.title}, ${dayLong(registration.startsAt)}, ${timeRange(registration.startsAt, registration.endsAt)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Keep my spot</Button><Button variant="danger" onClick={() => void cancel()} disabled={busy}>{busy ? 'Canceling…' : 'Cancel my sign-up'}</Button></>}
    >
      <p className="text-base leading-7 text-stone-800">Your spot will open for someone else. If you change your mind later, you can sign up again if the shift still has room.</p>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Sheet>
  );
}

function SpotsBadge({ shift }: { shift: Shift }) {
  if (shift.spotsLeft <= 0) return <Badge tone="neutral">Full</Badge>;
  return <Badge tone={shift.spotsLeft <= 2 ? 'warn' : 'good'}>{shift.spotsLeft === 1 ? 'Last spot' : `${shift.spotsLeft} of ${shift.capacity} spots open`}</Badge>;
}

function ShiftCard({ shift, registration, overlaps, onSignUp, onCancel }: { shift: Shift; registration?: VolunteerRegistration; overlaps?: string; onSignUp: () => void; onCancel: () => void }) {
  const full = shift.spotsLeft <= 0 && !shift.registered;
  return (
    <article className={`rounded-[var(--ph-radius)] border p-5 ${shift.registered ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]' : 'border-stone-300 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-stone-950">{shift.title}</h4>
          <p className="mt-0.5 text-base text-stone-900">{dayLong(shift.startsAt)}, {timeRange(shift.startsAt, shift.endsAt)} {zoneName(shift.startsAt)}</p>
        </div>
        {shift.registered ? <Badge tone="good">You are signed up</Badge> : <SpotsBadge shift={shift} />}
      </div>
      <dl className="mt-3 grid gap-2 text-base leading-7 text-stone-800">
        <div><dt className="inline font-semibold text-stone-950">Duties: </dt><dd className="inline whitespace-pre-wrap">{shift.description}</dd></div>
        <div><dt className="inline font-semibold text-stone-950">Who can join: </dt><dd className="inline">{shift.minAge > 0 ? `Ages ${shift.minAge} and up. ` : 'No minimum age for this shift. '}{shift.requirements}</dd></div>
      </dl>
      {overlaps && <p className="mt-3 text-sm text-stone-700">This overlaps your shift “{overlaps}”.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {shift.registered ? (
          <Button variant="danger" onClick={onCancel} disabled={!registration}>Cancel my sign-up<span className="sr-only"> for {shift.title} on {dayLong(shift.startsAt)}</span></Button>
        ) : (
          <Button variant="primary" onClick={onSignUp} disabled={full}>{full ? 'Full' : 'Sign up'}<span className="sr-only"> for {shift.title} on {dayLong(shift.startsAt)}</span></Button>
        )}
      </div>
    </article>
  );
}

function Shifts() {
  const me = useMe();
  const user = me.data ?? null;
  const queryClient = useQueryClient();
  const publicShifts = useApi<PublicAvailability>(me.isSuccess && !user ? '/public/availability' : null, { staleSeconds: 15 });
  const memberShifts = useApi<VolunteerShiftListResponse>(user ? '/volunteer/shifts' : null, { staleSeconds: 10 });
  const registrations = useApi<VolunteerRegistrationListResponse>(user ? '/volunteer/registrations' : null, { staleSeconds: 10 });
  const [role, setRole] = useState('');
  const [signing, setSigning] = useState<Shift | null>(null);
  const [canceling, setCanceling] = useState<VolunteerRegistration | null>(null);
  const [notice, setNotice] = useState('');
  const resumed = useRef(false);

  const shifts = useMemo<Shift[]>(() => {
    const list = user ? (memberShifts.data?.shifts ?? []).map(normalizeMember) : (publicShifts.data?.shifts ?? []).map(normalizePublic);
    return list.filter((shift) => Date.parse(shift.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [user, memberShifts.data, publicShifts.data]);
  const loading = me.isLoading || (user ? memberShifts.isLoading : publicShifts.isLoading);
  const failed = user ? memberShifts.isError : publicShifts.isError;
  const mine = (registrations.data?.registrations ?? []).filter((item) => item.status === 'registered' && Date.parse(item.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const registrationFor = (shiftId: string) => mine.find((item) => item.shiftId === shiftId);
  const roles = [...new Set(shifts.map((shift) => shift.title))].sort();
  const visible = role ? shifts.filter((shift) => shift.title === role) : shifts;
  const weeks = groupBy(visible, (shift) => weekStart(dayKey(shift.startsAt)));

  // After signing in, the shift the person chose is waiting in the address.
  useEffect(() => {
    if (resumed.current || !user || !memberShifts.data) return;
    const wanted = new URLSearchParams(window.location.search).get('shift');
    if (!wanted) return;
    resumed.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    const shift = shifts.find((item) => item.id === wanted);
    if (!shift) setNotice('That shift is no longer open. Here are the shifts that are.');
    else if (shift.registered) setNotice(`You are already signed up for ${shift.title} on ${dayLong(shift.startsAt)}.`);
    else if (shift.spotsLeft <= 0) setNotice(`${shift.title} filled up while you were signing in. Here are the other shifts.`);
    else setSigning(shift);
  }, [user, memberShifts.data, shifts]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['/volunteer/shifts'] });
    void queryClient.invalidateQueries({ queryKey: ['/volunteer/registrations'] });
    void queryClient.invalidateQueries({ queryKey: ['/public/availability'] });
  };
  const startSignUp = (shift: Shift) => {
    if (user) setSigning(shift);
    else window.location.assign(loginUrl(`/volunteer?shift=${encodeURIComponent(shift.id)}`));
  };
  const overlapFor = (shift: Shift) => mine.find((item) => item.shiftId !== shift.id && item.startsAt < shift.endsAt && shift.startsAt < item.endsAt)?.title;

  return (
    <div className="grid gap-10">
      {user && mine.length > 0 && (
        <section aria-labelledby="my-shifts">
          <h2 id="my-shifts" className="text-2xl font-semibold tracking-tight text-stone-950">Your sign-ups</h2>
          <ul className="mt-4 grid gap-3">
            {mine.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ph-radius)] border border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] p-4">
                <div>
                  <p className="font-semibold text-stone-950">{item.title}</p>
                  <p className="text-base text-stone-900">{dayLong(item.startsAt)}, {timeRange(item.startsAt, item.endsAt)} {zoneName(item.startsAt)}</p>
                </div>
                <Button variant="danger" onClick={() => setCanceling(item)}>Cancel<span className="sr-only"> {item.title} on {dayLong(item.startsAt)}</span></Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="open-shifts">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="open-shifts" className="text-2xl font-semibold tracking-tight text-stone-950">Open shifts</h2>
            <p className="mt-1 text-base text-stone-800">{user ? 'Tap Sign up and confirm your phone number and date of birth.' : 'You can look at every shift. You only log in when you sign up.'}</p>
          </div>
          {roles.length > 1 && (
            <Field label="Show" className="min-w-52">
              {(aria) => <Select {...aria} value={role} onChange={(event) => setRole(event.target.value)}><option value="">All shifts</option>{roles.map((title) => <option key={title} value={title}>{title}</option>)}</Select>}
            </Field>
          )}
        </div>
        {notice && <Notice tone="info" className="mt-4">{notice}</Notice>}
        <div className="mt-6 grid gap-8" aria-busy={loading}>
          {loading ? (
            <div aria-hidden="true" className="grid gap-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-44 w-full" /><Skeleton className="h-44 w-full" /></div>
          ) : failed ? (
            <Notice tone="error" title="We could not load the shifts.">Please try again, or call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink>. <Button variant="secondary" className="mt-3" onClick={refresh}>Try again</Button></Notice>
          ) : !weeks.length ? (
            <Card><EmptyState title="No open shifts right now" action={<TextLink href={`mailto:${SHELTER.email}?subject=Volunteering`}>Email us to hear about new shifts</TextLink>}>New shifts are added often. Check back soon or write to us and we will tell you when there is room.</EmptyState></Card>
          ) : (
            weeks.map(([key, items]) => (
              <div key={key}>
                <h3 className="text-xl font-semibold text-stone-950">{weekLabel(key)} <span className="text-base font-normal text-stone-700">({plural(items.length, 'shift')})</span></h3>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {items.map((shift) => <ShiftCard key={shift.id} shift={shift} registration={registrationFor(shift.id)} overlaps={user && !shift.registered ? overlapFor(shift) : undefined} onSignUp={() => startSignUp(shift)} onCancel={() => { const found = registrationFor(shift.id); if (found) setCanceling(found); }} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {signing && user && <SignUpSheet shift={signing} user={user} onClose={() => setSigning(null)} onDone={() => { setSigning(null); refresh(); }} />}
      {canceling && <CancelSheet registration={canceling} onClose={() => setCanceling(null)} onDone={() => { setCanceling(null); refresh(); }} />}
    </div>
  );
}

export default function VolunteerShifts() {
  return <Providers><ClientOnly fallback={<div aria-hidden="true" className="grid gap-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-44 w-full" /></div>}><Shifts /></ClientOnly></Providers>;
}
