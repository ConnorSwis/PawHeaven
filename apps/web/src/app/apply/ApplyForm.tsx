import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { Button, ButtonLink, Card, Field, Input, Notice, Select, Skeleton, Stepper, Textarea, TextLink } from '../../ui';
import { api, ApiRequestError, errorMessage, loginUrl, useApi, useMe } from '../../lib/fetch';
import { loadProfile, saveProfile } from '../../lib/profile';
import { Providers } from '../../lib/providers';
import { ageFrom, ClientOnly, draftStore, petAlt, petFactsLine, petHref, PetPicture, plainDate, Problems, shelterToday, UUID, useStepFocus } from '../involve/common';

type Kind = 'adopt' | 'foster';
type Key = 'phone' | 'address' | 'dob' | 'household' | 'from' | 'until' | 'experience' | 'note';
type Values = Record<Key, string>;
type Draft = { values: Values; step: number; save: boolean };

const BLANK: Values = { phone: '', address: '', dob: '', household: '', from: '', until: '', experience: '', note: '' };
const STEPS = ['About you', 'Your home', 'Experience', 'Review'];
const FIELD_STEP: Record<Key, number> = { phone: 0, address: 0, dob: 0, household: 1, from: 1, until: 1, experience: 2, note: 2 };
const MINIMUM_AGE = 18;

const apiName = (kind: Kind): Record<Key, string> => ({
  phone: 'applicantPhone', address: 'applicantAddress', dob: 'applicantDateOfBirth', household: 'householdSummary',
  experience: kind === 'foster' ? 'fosterExperience' : 'adoptionExperience', from: 'availableFrom', until: 'availableUntil', note: 'note',
});

const dayNumber = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) / 86_400_000 : null);

/** The same rules the API applies, so most problems are caught before anything is sent. */
function problemWith(key: Key, values: Values, kind: Kind): string | undefined {
  const text = values[key].trim();
  switch (key) {
    case 'phone': {
      const digits = text.replace(/\D/g, '');
      if (!text) return 'Enter a phone number where the shelter can reach you.';
      if (!/^\+?[0-9 ().-]{7,30}$/.test(text) || digits.length < 10 || digits.length > 15) return 'Enter a valid phone number with at least 10 digits.';
      return undefined;
    }
    case 'address':
      if (!text) return 'Enter your mailing address.';
      if (text.length < 5 || text.length > 300) return 'Enter your full address using 5 to 300 characters.';
      return undefined;
    case 'dob': {
      const age = text ? ageFrom(text) : null;
      if (!text) return 'Enter your date of birth.';
      if (age === null || age < 0 || age > 120) return 'Enter a valid date of birth.';
      if (age < MINIMUM_AGE) return `Applicants must be at least ${MINIMUM_AGE} years old.`;
      return undefined;
    }
    case 'household':
      if (text.length < 20) return 'Tell us a little more about your household and the care you can provide.';
      if (text.length > 2000) return 'Keep the household summary under 2,000 characters.';
      return undefined;
    case 'experience':
      if (text.length < 20) return kind === 'foster' ? 'Tell us about your pet-care or fostering experience, or how you will prepare.' : 'Tell us about your pet-care experience or how you will prepare for the responsibility.';
      if (text.length > 1000) return 'Keep your experience answer under 1,000 characters.';
      return undefined;
    case 'note':
      return text.length > 1000 ? 'Keep the note under 1,000 characters.' : undefined;
    case 'from': {
      if (kind !== 'foster') return undefined;
      if (!text) return 'Choose the first day you can provide care.';
      const from = dayNumber(text);
      if (from === null) return 'Enter a valid start date.';
      if (from < dayNumber(shelterToday())!) return 'The start date cannot be in the past.';
      return undefined;
    }
    case 'until': {
      if (kind !== 'foster') return undefined;
      if (!text) return 'Choose the last day you can provide care.';
      const until = dayNumber(text);
      const from = dayNumber(values.from.trim());
      if (until === null) return 'Enter a valid end date.';
      if (from !== null && until < from) return 'The end date must be on or after the start date.';
      if (from !== null && until - from > 365) return 'Choose a care period of one year or less.';
      return undefined;
    }
  }
}

const keysFor = (kind: Kind): Key[] => (kind === 'foster' ? ['phone', 'address', 'dob', 'household', 'from', 'until', 'experience', 'note'] : ['phone', 'address', 'dob', 'household', 'experience', 'note']);
const stepKeys = (kind: Kind, step: number) => keysFor(kind).filter((key) => FIELD_STEP[key] === step);

function readQuery(): { kind: Kind; petId: string } {
  const params = new URLSearchParams(window.location.search);
  const pet = params.get('pet') ?? '';
  return { kind: params.get('type') === 'foster' ? 'foster' : 'adopt', petId: UUID.test(pet) ? pet.toLowerCase() : '' };
}

function PetSummary({ pet, kind }: { pet: Pet; kind: Kind }) {
  return (
    <Card as="div" className="flex gap-4 p-4 sm:p-4 lg:flex-col">
      <PetPicture pet={pet} className="aspect-[4/3] w-28 shrink-0 rounded-[var(--ph-radius)] lg:w-full" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-700">{kind === 'foster' ? 'You are applying to foster' : 'You are applying to adopt'}</p>
        <p className="text-xl font-semibold text-stone-950">{pet.name}</p>
        <p className="text-sm leading-5 text-stone-800">{petFactsLine(pet)}</p>
        <p className="mt-2"><TextLink href={petHref(pet)} className="inline-flex min-h-11 items-center text-sm" aria-label={`About ${petAlt(pet)}`}>About {pet.name}</TextLink></p>
      </div>
    </Card>
  );
}

function AnimalPicker({ kind, onChoose }: { kind: Kind; onChoose: (id: string) => void }) {
  const petsQuery = useApi<{ pets: Pet[] }>('/pets', { staleSeconds: 60 });
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const pets = (petsQuery.data?.pets ?? []).filter((pet) => (kind === 'foster' ? pet.fosterAvailable : true));
  return (
    <section aria-labelledby="pick-heading" className="grid max-w-xl gap-4">
      <h2 id="pick-heading" className="text-2xl font-semibold tracking-tight text-stone-950">Choose an animal</h2>
      <p className="text-base leading-7 text-stone-800">{kind === 'foster' ? 'These animals are open to foster applications.' : 'Applications are for one animal at a time.'} You can also <TextLink href={kind === 'foster' ? '/foster' : '/adopt'}>look through the photos first</TextLink>.</p>
      {petsQuery.isLoading ? <Skeleton className="h-12 w-full" /> : petsQuery.isError ? <Notice tone="error">We could not load the animals. Please refresh the page.</Notice> : (
        <Field label="Animal" required error={error}>
          {(aria) => (
            <Select {...aria} value={choice} onChange={(event) => { setChoice(event.target.value); setError(''); }}>
              <option value="">Choose an animal</option>
              {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} ({pet.breed || pet.type})</option>)}
            </Select>
          )}
        </Field>
      )}
      <div><Button variant="primary" onClick={() => (choice ? onChoose(choice) : setError('Choose the animal you would like to apply for.'))}>Continue</Button></div>
    </section>
  );
}

function Application({ kind, petId }: { kind: Kind; petId: string }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const petQuery = useApi<Pet>(petId ? `/pets/${petId}` : null, { staleSeconds: 20 });
  const profile = useQuery({ queryKey: ['/profile'], queryFn: loadProfile, enabled: Boolean(me.data), staleTime: 30_000 });
  const draftKey = `ph:apply:${kind}:${petId}`;
  const start = useMemo(() => draftStore.read<Draft>(draftKey), [draftKey]);
  const [values, setValues] = useState<Values>({ ...BLANK, ...start?.values });
  const [step, setStep] = useState(Math.min(Math.max(start?.step ?? 0, 0), 3));
  const [saveDetails, setSaveDetails] = useState(start?.save ?? true);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<{ tone: 'warning' | 'info'; text: string; duplicate: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const heading = useStepFocus(done ? 4 : step);
  const prefilled = useRef(false);
  const pet = petQuery.data;
  const names = apiName(kind);

  // Fill empty contact fields from the saved profile (anything typed or restored from a draft wins).
  useEffect(() => {
    if (prefilled.current || !profile.data) return;
    prefilled.current = true;
    const saved = profile.data;
    setValues((current) => ({ ...current, phone: current.phone || saved.phone || '', address: current.address || saved.address || '', dob: current.dob || saved.dateOfBirth || '' }));
  }, [profile.data]);

  useEffect(() => { if (!done) draftStore.write(draftKey, { values, step, save: saveDetails } satisfies Draft); }, [values, step, saveDetails, draftKey, done]);

  const set = (key: Key, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  function validate(keys: Key[]) {
    const found: Partial<Record<Key, string>> = {};
    for (const key of keys) { const problem = problemWith(key, values, kind); if (problem) found[key] = problem; }
    return found;
  }
  const showProblems = (found: Partial<Record<Key, string>>) => {
    setErrors((current) => ({ ...current, ...found }));
    setSummary(Object.values(found).filter((message): message is string => Boolean(message)));
  };

  function next() {
    const found = validate(stepKeys(kind, step));
    if (Object.keys(found).length) return showProblems(found);
    setSummary([]);
    setStep(step + 1);
  }
  const edit = (target: number) => { setSummary([]); setBlocked(null); setStep(target); };

  function signIn() {
    draftStore.write(draftKey, { values, step: 3, save: saveDetails } satisfies Draft);
    window.location.assign(loginUrl());
  }

  async function submit() {
    const found = validate(keysFor(kind));
    if (Object.keys(found).length) {
      const firstKey = keysFor(kind).find((key) => found[key])!;
      showProblems(found);
      setStep(FIELD_STEP[firstKey]);
      return;
    }
    setBusy(true);
    setBlocked(null);
    setSummary([]);
    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])) as Values;
    const body = kind === 'foster'
      ? { applicantPhone: trimmed.phone, applicantAddress: trimmed.address, applicantDateOfBirth: trimmed.dob, householdSummary: trimmed.household, fosterExperience: trimmed.experience, availableFrom: trimmed.from, availableUntil: trimmed.until, note: trimmed.note }
      : { applicantPhone: trimmed.phone, applicantAddress: trimmed.address, applicantDateOfBirth: trimmed.dob, householdSummary: trimmed.household, adoptionExperience: trimmed.experience, note: trimmed.note };
    try {
      await api(kind === 'foster' ? `/foster-applications/pets/${petId}` : `/applications/pets/${petId}`, { method: 'POST', json: body });
      if (saveDetails) void saveProfile({ phone: trimmed.phone, address: trimmed.address, dateOfBirth: trimmed.dob });
      draftStore.clear(draftKey);
      void queryClient.invalidateQueries({ queryKey: ['/applications'] });
      void queryClient.invalidateQueries({ queryKey: ['/foster-applications'] });
      setDone(true);
    } catch (failure) {
      const status = failure instanceof ApiRequestError ? failure.status : 0;
      const message = errorMessage(failure, 'We could not send your application. Please try again.');
      if (failure instanceof ApiRequestError && failure.fieldErrors && Object.keys(failure.fieldErrors).length) {
        const found: Partial<Record<Key, string>> = {};
        for (const key of keysFor(kind)) { const text = failure.fieldErrors[names[key]]; if (text) found[key] = text; }
        showProblems(found);
        const firstKey = keysFor(kind).find((key) => found[key]);
        if (firstKey) setStep(FIELD_STEP[firstKey]);
        else setSummary([message]);
      } else if (status === 401) {
        void queryClient.invalidateQueries({ queryKey: ['/auth/me'] });
        setSummary(['You have been signed out. Log in again and your answers will still be here.']);
      } else if (status === 409) {
        setBlocked({ tone: 'warning', text: /already/i.test(message) ? `You have already applied for ${pet?.name ?? 'this animal'}. We are looking at it, and you can follow along in My PawHeaven.` : message, duplicate: /already/i.test(message) });
      } else setSummary([message]);
    } finally { setBusy(false); }
  }

  // --- Loading and dead ends -----------------------------------------------------------------------
  if (petQuery.isLoading) return <div aria-hidden="true" className="grid gap-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-12 w-1/2" /></div>;
  if (petQuery.isError || !pet) {
    return (
      <div className="grid max-w-xl gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">We cannot find that animal</h1>
        <Notice tone="info">This animal may have been adopted or is no longer taking applications. {petQuery.isError && petQuery.error instanceof ApiRequestError && petQuery.error.status !== 404 ? errorMessage(petQuery.error) : ''}</Notice>
        <div className="flex flex-wrap gap-3"><ButtonLink variant="primary" href="/adopt">See animals looking for a home</ButtonLink><ButtonLink href="/foster">Foster an animal</ButtonLink></div>
      </div>
    );
  }
  const verb = kind === 'foster' ? 'foster' : 'adopt';
  const title = `Apply to ${verb} ${pet.name}`;
  if (kind === 'foster' && !pet.fosterAvailable) {
    return (
      <div className="grid max-w-xl gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
        <Notice tone="warning" title={`${pet.name} is not open to foster applications right now.`}>Staff choose which animals need a foster home, and this one does not at the moment. You can apply to adopt {pet.name} or look at the animals who do need a foster home.</Notice>
        <div className="flex flex-wrap gap-3"><ButtonLink variant="primary" href={`/apply?type=adopt&pet=${pet.id}`}>Apply to adopt {pet.name}</ButtonLink><ButtonLink href="/foster">See animals who need a foster home</ButtonLink></div>
      </div>
    );
  }

  // --- Confirmation ---------------------------------------------------------------------------------
  if (done) {
    return (
      <div className="grid max-w-3xl gap-6">
        <div>
          <h1 className="sr-only">{title}</h1>
          <h2 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-stone-950 focus:outline-none sm:text-4xl">Thank you, your application is in</h2>
          <p className="mt-3 text-lg leading-8 text-stone-800">Your application to {verb} {pet.name} has been sent{me.data?.email ? `, and we emailed a confirmation to ${me.data.email}` : ''}.</p>
        </div>
        <Card>
          <h3 className="text-lg font-semibold text-stone-950">What happens next</h3>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-base leading-7 text-stone-800">
            <li>Our team reads your application. We may call or email with questions.</li>
            {kind === 'foster'
              ? <li>If it is a good fit, we agree on a pick-up time and go over what {pet.name} needs.</li>
              : <li>If it is a good fit, we invite you to meet {pet.name}. Bring a government-issued photo ID. <TextLink href="/adopt/process">See how adoption works</TextLink>.</li>}
            <li>You can check the status any time in My PawHeaven.</li>
          </ol>
        </Card>
        <div className="flex flex-wrap gap-3">
          <ButtonLink variant="primary" href="/me?tab=applications">See my applications</ButtonLink>
          <ButtonLink href={kind === 'foster' ? '/foster' : '/adopt'}>{kind === 'foster' ? 'See more animals to foster' : 'Keep looking'}</ButtonLink>
        </div>
      </div>
    );
  }

  // --- The form ----------------------------------------------------------------------------------------
  const review: [string, string, number][] = [
    ['Phone', values.phone, 0], ['Address', values.address, 0], ['Date of birth', values.dob ? plainDate(values.dob) : '', 0],
    ['Household', values.household, 1],
    ...(kind === 'foster' ? [['Available from', values.from ? plainDate(values.from) : '', 1], ['Available until', values.until ? plainDate(values.until) : '', 1]] as [string, string, number][] : []),
    [kind === 'foster' ? 'Foster experience' : 'Experience with pets', values.experience, 2],
    ['Anything else', values.note || 'Nothing added', 2],
  ];
  const savedHint = profile.data && (profile.data.phone || profile.data.address || profile.data.dateOfBirth) ? 'Filled in from My PawHeaven. Change it if it is out of date.' : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="lg:col-start-2 lg:row-start-1"><PetSummary pet={pet} kind={kind} /></div>
      <div className="grid gap-6 lg:col-start-1 lg:row-start-1">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-base leading-7 text-stone-800">It takes about five minutes. We save your answers on this device as you go.</p>
        </header>
        <Stepper steps={STEPS} current={step} />
        <Problems errors={summary} />
        {blocked && (
          <Notice tone={blocked.tone}>
            {blocked.text}{' '}
            {blocked.duplicate ? <TextLink href="/me?tab=applications">See my applications</TextLink> : <TextLink href={kind === 'foster' ? '/foster' : '/adopt'}>See other animals</TextLink>}
          </Notice>
        )}

        {step === 0 && (
          <section aria-labelledby="apply-step" className="grid gap-5">
            <h2 id="apply-step" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none">About you</h2>
            {me.data === null && <Notice tone="info">You can fill this in now. We will ask you to log in or create an account when you send it, and keep your answers.</Notice>}
            <Field label="Phone number" required error={errors.phone} help={savedHint ?? 'Where the shelter can reach you.'}>
              {(aria) => <Input {...aria} name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={values.phone} onChange={(event) => set('phone', event.target.value)} />}
            </Field>
            <Field label="Mailing address" required error={errors.address} help="Street, city, state, and ZIP.">
              {(aria) => <Textarea {...aria} name="address" rows={3} maxLength={300} autoComplete="street-address" value={values.address} onChange={(event) => set('address', event.target.value)} />}
            </Field>
            <Field label="Date of birth" required error={errors.dob} help={`Applicants must be at least ${MINIMUM_AGE}.`}>
              {(aria) => <Input {...aria} name="dob" type="date" autoComplete="bday" min="1900-01-01" max={shelterToday()} value={values.dob} onChange={(event) => set('dob', event.target.value)} className="sm:max-w-60" />}
            </Field>
            {me.data && (
              <label className="flex min-h-11 items-start gap-3 text-base text-stone-900">
                <input type="checkbox" className="mt-1 size-4 shrink-0" checked={saveDetails} onChange={(event) => setSaveDetails(event.target.checked)} />
                <span>Save my phone, address, and date of birth to My PawHeaven so I do not have to type them again. I can change them any time.</span>
              </label>
            )}
            <div><Button variant="primary" onClick={next}>Continue</Button></div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="apply-step" className="grid gap-5">
            <h2 id="apply-step" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none">Your home</h2>
            <Field label="Tell us about your household" required error={errors.household} help="Who lives with you, any other pets, whether you rent or own, and who is home during the day. At least 20 characters.">
              {(aria) => <Textarea {...aria} name="household" rows={6} maxLength={2000} value={values.household} onChange={(event) => set('household', event.target.value)} />}
            </Field>
            <p className="-mt-3 text-sm text-stone-700" aria-hidden="true">{values.household.length} of 2,000 characters</p>
            {kind === 'foster' && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Available from" required error={errors.from} help="The first day you can provide care.">
                  {(aria) => <Input {...aria} name="from" type="date" min={shelterToday()} value={values.from} onChange={(event) => set('from', event.target.value)} />}
                </Field>
                <Field label="Available until" required error={errors.until} help="The last day. A stay is usually a few weeks.">
                  {(aria) => <Input {...aria} name="until" type="date" min={values.from || shelterToday()} value={values.until} onChange={(event) => set('until', event.target.value)} />}
                </Field>
              </div>
            )}
            <div className="flex flex-wrap gap-3"><Button variant="ghost" onClick={() => edit(0)}>Back</Button><Button variant="primary" onClick={next}>Continue</Button></div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="apply-step" className="grid gap-5">
            <h2 id="apply-step" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none">Experience</h2>
            <Field label={kind === 'foster' ? 'Your experience with pets or fostering' : 'Your experience with pets'} required error={errors.experience} help={kind === 'foster' ? 'Past pets, fostering, or how you will prepare. At least 20 characters.' : 'Past pets, training, or how you will prepare for the responsibility. At least 20 characters.'}>
              {(aria) => <Textarea {...aria} name="experience" rows={5} maxLength={1000} value={values.experience} onChange={(event) => set('experience', event.target.value)} />}
            </Field>
            <Field label="Anything else you would like us to know? (optional)" error={errors.note}>
              {(aria) => <Textarea {...aria} name="note" rows={3} maxLength={1000} value={values.note} onChange={(event) => set('note', event.target.value)} />}
            </Field>
            <div className="flex flex-wrap gap-3"><Button variant="ghost" onClick={() => edit(1)}>Back</Button><Button variant="primary" onClick={next}>Review</Button></div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="apply-step" className="grid gap-5">
            <h2 id="apply-step" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none">Check your answers</h2>
            <Card>
              <dl className="grid gap-4">
                {review.map(([label, value, target]) => (
                  <div key={label} className="grid gap-1 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
                    <dt className="font-semibold text-stone-950">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-stone-900">{value || <span className="text-red-800">Missing</span>}</dd>
                    <dd><Button variant="ghost" className="-ml-3 min-h-11 px-3 sm:ml-0" onClick={() => edit(target)}>Edit<span className="sr-only"> {label}</span></Button></dd>
                  </div>
                ))}
              </dl>
            </Card>
            {me.isLoading ? <Skeleton className="h-12 w-60" /> : me.data ? (
              <div className="grid gap-3">
                <p className="text-base text-stone-800">Sending as <strong>{me.data.name}</strong> ({me.data.email}). We will email you a confirmation.</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost" onClick={() => edit(2)}>Back</Button>
                  <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Sending…' : 'Send my application'}</Button>
                </div>
              </div>
            ) : (
              <Card className="grid gap-4 border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]">
                <div>
                  <h3 className="text-lg font-semibold text-stone-950">Log in to send your application</h3>
                  <p className="mt-1 text-base leading-7 text-stone-800">We need an account so we can email you and so you can follow your application. Your answers are saved and will be here when you come back.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" onClick={signIn}>Log in</Button>
                  <Button variant="secondary" onClick={() => { draftStore.write(draftKey, { values, step: 3, save: saveDetails } satisfies Draft); window.location.assign(`/sign-up?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`); }}>Create an account</Button>
                  <Button variant="ghost" onClick={() => edit(2)}>Back</Button>
                </div>
              </Card>
            )}
            <p className="text-sm text-stone-700">Questions first? Call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink> or email <TextLink href={`mailto:${SHELTER.adoptionEmail}`}>{SHELTER.adoptionEmail}</TextLink>.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Page() {
  const [query, setQuery] = useState(readQuery);
  const choosePet = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('type', query.kind);
    params.set('pet', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    setQuery({ kind: query.kind, petId: id });
  };
  if (!query.petId) {
    return (
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{query.kind === 'foster' ? 'Apply to foster' : 'Apply to adopt'}</h1>
        <AnimalPicker kind={query.kind} onChoose={choosePet} />
      </div>
    );
  }
  return <Application key={`${query.kind}:${query.petId}`} kind={query.kind} petId={query.petId} />;
}

function Loading() {
  return <div aria-hidden="true" className="grid gap-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-12 w-1/2" /></div>;
}

export default function ApplyForm() {
  return <Providers><ClientOnly fallback={<Loading />}><Page /></ClientOnly></Providers>;
}
