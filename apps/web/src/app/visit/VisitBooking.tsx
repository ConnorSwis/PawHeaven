import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Pet, PublicAvailability } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { Button, ButtonLink, Card, Field, Fieldset, Input, Notice, Select, Skeleton, Stepper, Textarea, TextLink, cx } from '../../ui';
import { CalendarIcon } from '../../ui/icons';
import { api, ApiRequestError, errorMessage, loginUrl, useApi, useMe } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Problems, useStepFocus, addressLine, calendarFile, ClientOnly, dayLong, dayMedium, directionsUrl, downloadFile, draftStore, groupBy, dayKey, minutesBetween, petFactsLine, PetPicture, plural, timeOnly, timeRange, UUID, zoneName } from '../involve/common';

const STEPS = ['Time', 'Animals', 'You', 'Done'];
const DRAFT_KEY = 'ph:visit-draft';
const PAGE_SIZE = 24;

type Draft = { slotId: string; petIds: string[]; party: number; purpose: string; step: number };
type Slot = PublicAvailability['visits'][number];
type Booked = { startsAt: string; endsAt: string; animals: string[]; party: number; appointmentId: string };

const stepHeading = 'text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none';

function readStart(): Draft {
  const saved = draftStore.read<Draft>(DRAFT_KEY);
  const wanted = new URLSearchParams(window.location.search).get('pet');
  const petIds = [...(saved?.petIds ?? [])];
  if (wanted && UUID.test(wanted) && !petIds.includes(wanted) && petIds.length < 5) petIds.push(wanted);
  return { slotId: saved?.slotId ?? '', petIds, party: saved?.party && saved.party >= 1 && saved.party <= 6 ? saved.party : 1, purpose: saved?.purpose ?? '', step: Math.min(saved?.step ?? 0, 2) };
}

function Booking() {
  const me = useMe();
  const queryClient = useQueryClient();
  const availability = useApi<PublicAvailability>('/public/availability', { staleSeconds: 10 });
  const petsQuery = useApi<{ pets: Pet[] }>('/pets', { staleSeconds: 60 });
  const start = useMemo(readStart, []);
  const [step, setStep] = useState(start.step);
  const [slotId, setSlotId] = useState(start.slotId);
  const [petIds, setPetIds] = useState(start.petIds);
  const [party, setParty] = useState(start.party);
  const [purpose, setPurpose] = useState(start.purpose);
  const [day, setDay] = useState('');
  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [moreDays, setMoreDays] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning' | 'success'; text: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const heading = useStepFocus(step);
  const errorList = useMemo(() => (error ? [error] : []), [error]);

  const slots = availability.data?.visits ?? [];
  const slot = slots.find((item) => item.id === slotId);
  const pets = useMemo(() => (petsQuery.data?.pets ?? []).filter((pet) => pet.visitsOpen !== false), [petsQuery.data]);
  const chosenPets = petIds.map((id) => pets.find((pet) => pet.id === id)).filter((pet): pet is Pet => Boolean(pet));
  const days = useMemo(() => groupBy(slots, (item) => dayKey(item.startsAt)), [slots]);
  const activeDay = (slot && dayKey(slot.startsAt)) || (days.some(([key]) => key === day) ? day : days[0]?.[0] ?? '');
  const dayItems: Slot[] = days.find(([key]) => key === activeDay)?.[1] ?? [];

  // Keep the draft so a trip to the sign-in page loses nothing.
  useEffect(() => { if (!booked) draftStore.write(DRAFT_KEY, { slotId, petIds, party, purpose, step } satisfies Draft); }, [slotId, petIds, party, purpose, step, booked]);

  // A time chosen earlier may have been taken since. Say so kindly and let them pick again.
  useEffect(() => {
    if (booked || !availability.data || !slotId || slot) return;
    setSlotId('');
    setStep(0);
    setNotice({ tone: 'warning', text: 'The time you chose is no longer open. Please pick another one below.' });
  }, [availability.data, slotId, slot, booked]);

  // An animal chosen earlier may have gone home or stopped taking visitors.
  useEffect(() => {
    if (booked || !petsQuery.data || !petIds.length) return;
    const stillOpen = petIds.filter((id) => pets.some((pet) => pet.id === id));
    if (stillOpen.length !== petIds.length) {
      setPetIds(stillOpen);
      setNotice({ tone: 'info', text: 'An animal you chose is not available for visits right now, so we took it off your list.' });
    }
  }, [petsQuery.data, pets, petIds, booked]);

  const togglePet = (id: string) => setPetIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current));
  const go = (next: number) => { setError(''); setNotice(null); setStep(next); };

  const reason = purpose.trim() || (chosenPets.length ? `Meet ${chosenPets.map((pet) => pet.name).join(', ')}`.slice(0, 500) : 'Shelter visit');

  function saveAndSignIn(path: 'login' | 'sign-up') {
    draftStore.write(DRAFT_KEY, { slotId, petIds, party, purpose, step: 2 } satisfies Draft);
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(path === 'login' ? loginUrl(next) : `/sign-up?next=${encodeURIComponent(next)}`);
  }

  async function book() {
    if (!slot) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ appointmentId: string }>('/appointments', { method: 'POST', json: { slotId: slot.id, purpose: reason, partySize: party, petIds } });
      setBooked({ startsAt: slot.startsAt, endsAt: slot.endsAt, animals: chosenPets.map((pet) => pet.name), party, appointmentId: result.appointmentId });
      draftStore.clear(DRAFT_KEY);
      void queryClient.invalidateQueries({ queryKey: ['/public/availability'] });
      void queryClient.invalidateQueries({ queryKey: ['/appointments'] });
      setStep(3);
    } catch (failure) {
      const status = failure instanceof ApiRequestError ? failure.status : 0;
      const message = errorMessage(failure, 'We could not book that visit. Please try again.');
      if (status === 401) {
        void queryClient.invalidateQueries({ queryKey: ['/auth/me'] });
        setError('You have been signed out. Log in again and we will keep your choices.');
      } else if (status === 409) {
        void availability.refetch();
        setSlotId('');
        setStep(0);
        setNotice({ tone: 'warning', text: /already have/i.test(message) ? `${message} Choose a different time, or manage your visits in My PawHeaven.` : 'Sorry, that time was just booked by someone else. We have refreshed the times, so please pick another.' });
      } else if (status === 400 && /animal/i.test(message)) {
        void petsQuery.refetch();
        setStep(1);
        setNotice({ tone: 'warning', text: `${message} Please check your choices.` });
      } else setError(message);
    } finally { setBusy(false); }
  }

  const stepper = <Stepper steps={STEPS} current={step} />;

  // --- Step 4: confirmation ---------------------------------------------------------------------
  if (step === 3 && booked) {
    const minutes = minutesBetween(booked.startsAt, booked.endsAt);
    const addToCalendar = () => downloadFile('pawheaven-visit.ics', calendarFile({
      uid: `visit-${booked.appointmentId}`,
      title: 'Visit PawHeaven',
      startsAt: booked.startsAt,
      endsAt: booked.endsAt,
      description: `${booked.animals.length ? `Meeting ${booked.animals.join(', ')}. ` : ''}${plural(booked.party, 'person', 'people')}. Bring a photo ID if you hope to adopt. Questions: ${SHELTER.phone}.`,
    }));
    return (
      <div className="grid gap-6">
        {stepper}
        <div>
          <h2 ref={heading} tabIndex={-1} className={stepHeading}>You are booked</h2>
          <p className="mt-2 text-base leading-7 text-stone-800">We saved your visit{me.data?.email ? ` and emailed a confirmation to ${me.data.email}` : ''}. We look forward to seeing you.</p>
        </div>
        <Card className="grid gap-4">
          <dl className="grid gap-3 text-base sm:grid-cols-[9rem_1fr]">
            <dt className="font-semibold text-stone-950">When</dt>
            <dd className="text-stone-900">{dayLong(booked.startsAt)}, {timeRange(booked.startsAt, booked.endsAt)} {zoneName(booked.startsAt)}{minutes > 0 ? ` (${minutes} minutes)` : ''}</dd>
            <dt className="font-semibold text-stone-950">Animals</dt>
            <dd className="text-stone-900">{booked.animals.length ? booked.animals.join(', ') : 'Whoever is ready to meet you. Our team will help you find a match.'}</dd>
            <dt className="font-semibold text-stone-950">Who is coming</dt>
            <dd className="text-stone-900">{plural(booked.party, 'person', 'people')}</dd>
            <dt className="font-semibold text-stone-950">Where</dt>
            <dd className="text-stone-900">{addressLine}. <TextLink href={directionsUrl} target="_blank" rel="noreferrer">Get directions<span className="sr-only"> (opens in a new tab)</span></TextLink></dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={addToCalendar}><CalendarIcon /> Add to calendar</Button>
            <ButtonLink href="/me?tab=visits">See it in My PawHeaven</ButtonLink>
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-stone-950">What to bring and what to expect</h3>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-base leading-7 text-stone-800">
            <li>Everyone in your household who will care for the animal, if you hope to adopt.</li>
            <li>A government-issued photo ID if you plan to start adoption paperwork.</li>
            <li>Closed-toe shoes. Animals can be excited and the floors can be wet.</li>
            <li>A staff member or volunteer will greet you and introduce the animals you chose.</li>
          </ul>
          <p className="mt-4 text-base text-stone-800">Need to change plans? Open <TextLink href="/me?tab=visits">My PawHeaven</TextLink> or call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink>.</p>
        </Card>
      </div>
    );
  }

  const summary = (
    <dl className="grid gap-3 text-base sm:grid-cols-[8rem_1fr_auto] sm:items-baseline">
      <dt className="font-semibold text-stone-950">Time</dt>
      <dd className="text-stone-900">{slot ? `${dayLong(slot.startsAt)}, ${timeRange(slot.startsAt, slot.endsAt)} ${zoneName(slot.startsAt)}` : 'Not chosen yet'}</dd>
      <dd><Button variant="ghost" className="-ml-3 min-h-11 px-3 sm:ml-0" onClick={() => go(0)}>Change<span className="sr-only"> time</span></Button></dd>
      <dt className="font-semibold text-stone-950">Animals</dt>
      <dd className="text-stone-900">{chosenPets.length ? chosenPets.map((pet) => pet.name).join(', ') : 'No one in particular'}</dd>
      <dd><Button variant="ghost" className="-ml-3 min-h-11 px-3 sm:ml-0" onClick={() => go(1)}>Change<span className="sr-only"> animals</span></Button></dd>
      <dt className="font-semibold text-stone-950">People</dt>
      <dd className="text-stone-900">{plural(party, 'person', 'people')}</dd>
      <dd><Button variant="ghost" className="-ml-3 min-h-11 px-3 sm:ml-0" onClick={() => go(1)}>Change<span className="sr-only"> number of people</span></Button></dd>
    </dl>
  );

  return (
    <div className="grid gap-6">
      {stepper}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {/* Step 1: time */}
      {step === 0 && (
        <section aria-labelledby="visit-step" className="grid gap-5">
          <div>
            <h2 id="visit-step" ref={heading} tabIndex={-1} className={stepHeading}>Pick a time</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">These are the open times. Each visit is for one group, so please book one that works for everyone coming. All times are Eastern time, the shelter's time.</p>
          </div>
          {availability.isLoading ? (
            <div aria-hidden="true" className="grid gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-12 w-1/2" /></div>
          ) : availability.isError ? (
            <Notice tone="error" title="We could not load the open times.">Please try again in a moment, or call us on <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink>. <Button variant="secondary" className="mt-3" onClick={() => void availability.refetch()}>Try again</Button></Notice>
          ) : !days.length ? (
            <Notice tone="info" title="No open times right now.">New times are added regularly. Call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink> or email <TextLink href={`mailto:${SHELTER.email}`}>{SHELTER.email}</TextLink> and we will find a time with you.</Notice>
          ) : (
            <>
              <div>
                <p id="day-label" className="mb-2 text-sm font-semibold text-stone-950">Day</p>
                <div role="group" aria-labelledby="day-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {days.filter(([key], index) => moreDays || index < 12 || key === activeDay).map(([key, items]) => (
                    <button key={key} type="button" aria-pressed={key === activeDay} onClick={() => setDay(key)} className={cx('min-h-11 rounded-[var(--ph-radius)] border px-3 py-2 text-left text-base', key === activeDay ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] font-semibold text-stone-950' : 'border-stone-300 bg-white text-stone-900 hover:bg-stone-100')}>
                      <span className="block">{dayMedium(items[0].startsAt)}</span>
                      <span className="block text-sm text-stone-700">{plural(items.length, 'time')}</span>
                    </button>
                  ))}
                </div>
                {!moreDays && days.length > 12 && <Button variant="ghost" className="mt-2" onClick={() => setMoreDays(true)}>Show later days ({days.length - 12} more)</Button>}
              </div>
              <Fieldset legend={dayItems[0] ? `Times on ${dayLong(dayItems[0].startsAt)}` : 'Times'}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {dayItems.map((item) => (
                    <label key={item.id} className="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[var(--ph-radius)] border border-stone-400 bg-white px-3 py-2 text-center text-base font-semibold text-stone-950 hover:bg-stone-100 has-[:checked]:border-[var(--ph-brand)] has-[:checked]:bg-[var(--ph-brand)] has-[:checked]:text-[var(--ph-on-brand)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
                      <input type="radio" name="visit-time" className="sr-only" checked={item.id === slotId} onChange={() => { setSlotId(item.id); setNotice(null); setError(''); }} />
                      {timeOnly(item.startsAt)}
                      {item.spotsLeft <= 2 && <span className="text-xs font-normal">{item.spotsLeft === 1 ? 'Last spot' : `${item.spotsLeft} spots left`}</span>}
                    </label>
                  ))}
                </div>
              </Fieldset>
              <p role="status" className="text-base text-stone-900">{slot ? <>Chosen: <strong>{dayLong(slot.startsAt)}, {timeRange(slot.startsAt, slot.endsAt)}</strong></> : 'Choose a time to continue.'}</p>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={!slot} onClick={() => go(1)}>Continue</Button>
          </div>
        </section>
      )}

      {/* Step 2: animals and people */}
      {step === 1 && (
        <section aria-labelledby="visit-step" className="grid gap-5">
          <div>
            <h2 id="visit-step" ref={heading} tabIndex={-1} className={stepHeading}>Who is coming, and who would you like to meet?</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Choosing animals lets us have them ready for you. It is fine to choose no one and let us show you around.</p>
          </div>
          <Field label="How many people are coming?" help="Include children. One visit holds up to 6 people.">
            {(aria) => <Select {...aria} className="sm:max-w-48" value={party} onChange={(event) => setParty(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</Select>}
          </Field>
          <div className="grid gap-3">
            <Field label="Find an animal" help="Search by name, breed, or kind.">
              {(aria) => <Input {...aria} type="search" value={filter} onChange={(event) => { setFilter(event.target.value); setShown(PAGE_SIZE); }} placeholder="For example Biscuit, beagle, or cat" autoComplete="off" />}
            </Field>
            <p role="status" className="text-base font-semibold text-stone-950">{chosenPets.length ? `${chosenPets.length} of 5 chosen` : 'No animals chosen yet (up to 5)'}</p>
            {chosenPets.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Animals you chose">
                {chosenPets.map((pet) => <li key={pet.id}><button type="button" onClick={() => togglePet(pet.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] px-4 text-base font-medium text-stone-950">{pet.name}<span aria-hidden="true">x</span><span className="sr-only">Remove {pet.name}</span></button></li>)}
              </ul>
            )}
            {petsQuery.isLoading ? (
              <div aria-hidden="true" className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
            ) : petsQuery.isError ? (
              <Notice tone="warning">We could not load the animals just now. You can still go on and choose no one in particular, or <button type="button" className="font-semibold underline" onClick={() => void petsQuery.refetch()}>try again</button>.</Notice>
            ) : (() => {
              const needle = filter.trim().toLowerCase();
              const matches = needle ? pets.filter((pet) => `${pet.name} ${pet.breed} ${pet.type}`.toLowerCase().includes(needle)) : pets;
              if (!matches.length) return <p className="text-base text-stone-800">{needle ? 'No animals match that search.' : 'No animals are open for visits right now. You can still come and meet whoever is out.'}</p>;
              return (
                <>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {matches.slice(0, shown).map((pet) => {
                      const checked = petIds.includes(pet.id);
                      return (
                        <li key={pet.id}>
                          <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--ph-radius)] border bg-white p-2 has-[:checked]:border-[var(--ph-brand)] has-[:checked]:bg-[var(--ph-brand-soft)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2', !checked && petIds.length >= 5 ? 'cursor-not-allowed border-stone-200 opacity-60' : 'border-stone-300')}>
                            <input type="checkbox" className="size-5 shrink-0" checked={checked} disabled={!checked && petIds.length >= 5} onChange={() => togglePet(pet.id)} />
                            <PetPicture pet={pet} decorative className="size-14 shrink-0 rounded-[var(--ph-radius)]" />
                            <span className="min-w-0"><span className="block font-semibold text-stone-950">{pet.name}</span><span className="block text-sm leading-5 text-stone-700">{petFactsLine(pet)}</span></span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {matches.length > shown && <Button variant="secondary" className="justify-self-start" onClick={() => setShown(shown + PAGE_SIZE)}>Show more animals</Button>}
                </>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => go(0)}>Back</Button>
            <Button variant="primary" onClick={() => go(2)}>Continue</Button>
          </div>
        </section>
      )}

      {/* Step 3: you */}
      {step === 2 && (
        <section aria-labelledby="visit-step" className="grid gap-5">
          <div>
            <h2 id="visit-step" ref={heading} tabIndex={-1} className={stepHeading}>Check your visit</h2>
          </div>
          <Card>{summary}</Card>
          <Field label="Anything we should know? (optional)" help="For example, whether you are looking for a dog that is good with cats. Leave it blank if not.">
            {(aria) => <Textarea {...aria} rows={3} maxLength={400} value={purpose} onChange={(event) => setPurpose(event.target.value)} />}
          </Field>
          <Problems errors={errorList} title="We could not book that visit" />
          {me.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : me.data ? (
            <div className="grid gap-4">
              <p className="text-base text-stone-800">Booking as <strong>{me.data.name}</strong> ({me.data.email}). We will email you a confirmation.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" onClick={() => go(1)}>Back</Button>
                <Button variant="primary" disabled={busy || !slot} onClick={() => void book()}>{busy ? 'Booking…' : 'Book this visit'}</Button>
              </div>
            </div>
          ) : (
            <Card className="grid gap-4 border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]">
              <div>
                <h3 className="text-lg font-semibold text-stone-950">Log in to confirm</h3>
                <p className="mt-1 text-base leading-7 text-stone-800">We need to know who is coming so we can send your confirmation and hold the time. We will keep your choices, so you can come straight back here and book.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={() => saveAndSignIn('login')}>Log in</Button>
                <Button variant="secondary" onClick={() => saveAndSignIn('sign-up')}>Create an account</Button>
                <Button variant="ghost" onClick={() => go(1)}>Back</Button>
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function BookingSkeleton() {
  return <div aria-hidden="true" className="grid gap-4"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-1/2" /></div>;
}

export default function VisitBooking() {
  return <Providers><ClientOnly fallback={<BookingSkeleton />}><Booking /></ClientOnly></Providers>;
}
