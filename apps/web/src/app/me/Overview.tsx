import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { matchStrength, type Pet, type AdoptionApplicationListResponse, type FosterApplicationListResponse, type LatestQuizResponse, type MemberFosterRequest, type MyInvolvement, type VisitAppointmentListResponse, type VolunteerRegistrationListResponse } from '@pawheaven/contracts';
import { daysUntil, formatShelterRange } from '@pawheaven/contracts/ui';
import { api, errorMessage, useApi } from '../../lib/fetch';
import { Badge, Button, ButtonLink, Field, Input, Notice, Skeleton, TicketCard } from '../../ui';
import { dayLong, monthDay, PetPicture, timeRange, zoneName } from '../involve/common';
import { LoadState, Link, Muted, Row, Section, dayOnly, petPath } from './common';
import { useSavedIds } from './savedIds';
import { Mascot } from '../../ui/Mascot';
import { applyFilters, DEFAULT_FILTERS } from '../adopt/filters';
import { helpLabel } from '../status/help';

type Attention = { key: string; title: string; detail: string; tab: string; action: string };

const upcoming = (startsAt: string) => Date.parse(startsAt) > Date.now();
const recent = (reviewedAt: string | null) => reviewedAt !== null && Date.now() - Date.parse(reviewedAt) < 7 * 86_400_000;

/** The next thing on the calendar, as a ticket: a date block, what and when, and a stub with the details. */
function NextTicket({ label, title, startsAt, endsAt, detail }: { label: string; title: string; startsAt: string; endsAt: string; detail: string }) {
  const [month, day] = monthDay(startsAt).split(' ');
  return (
    <li>
      <TicketCard stub={<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p className="text-sm text-stone-800">{detail}</p><Link href="?tab=activity" className="text-sm">Manage<span className="sr-only"> {label.toLowerCase()}</span></Link></div>}>
        <div className="flex items-center gap-4">
          <div aria-hidden="true" className="grid w-16 shrink-0 place-items-center rounded-[var(--ph-radius-sm)] bg-[var(--ph-brand-soft)] py-2 text-[var(--ph-brand-strong)]">
            <span className="text-xs font-bold uppercase tracking-wide">{month}</span>
            <span className="text-2xl font-extrabold leading-none">{day}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-700">{label}</p>
            <p className="text-lg font-bold leading-snug text-stone-950">{title}</p>
            <p className="text-base text-stone-800">{dayLong(startsAt)}, {timeRange(startsAt, endsAt)} {zoneName(startsAt)}</p>
          </div>
        </div>
      </TicketCard>
    </li>
  );
}

/** Animals saved on this device or account, as a strip of photos. */
function SavedStrip() {
  const { ids, signedIn } = useSavedIds();
  const pets = useApi<{ pets: Pet[] }>(ids.length ? '/pets' : null, { staleSeconds: 60 });
  const byId = new Map((pets.data?.pets ?? []).map((pet) => [pet.id, pet]));
  const shown = ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as Pet] : [])).slice(0, 12);
  if (!ids.length) return null;
  return (
    <Section id="saved-strip" title="Saved animals" aside={<Link href="?tab=saved">See all {ids.length}</Link>}>
      {pets.isPending ? <Skeleton className="h-40" /> : pets.isError ? (
        <Muted>We could not load your saved animals. <Link href="?tab=saved">Try the Saved tab</Link>.</Muted>
      ) : shown.length === 0 ? (
        <Muted>The animals you saved are no longer listed. They may have found a home.</Muted>
      ) : (
        <>
          {!signedIn && <Muted className="mb-3 text-sm">Kept on this device.</Muted>}
          <ul className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3 pt-1">
            {shown.map((pet) => (
              <li key={pet.id} className="ph-lift w-40 shrink-0 snap-start rounded-[var(--ph-radius)] border border-stone-300 bg-white p-2 shadow-sm sm:w-44">
                <a href={petPath(pet)} className="block rounded-[calc(var(--ph-radius)-0.5rem)]">
                  <PetPicture pet={pet} decorative className="aspect-[4/3] w-full rounded-[calc(var(--ph-radius)-0.5rem)]" />
                  <span className="mt-2 block truncate px-1 pb-1 text-base font-bold text-stone-950">{pet.name}</span>
                  <span className="sr-only">{[pet.breed || pet.type, pet.age].filter(Boolean).join(', ')}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function FosterRequestRow({ request }: { request: MemberFosterRequest }) {
  const queryClient = useQueryClient();
  const today = new Date();
  const [from, setFrom] = useState(today.toISOString().slice(0, 10));
  const [until, setUntil] = useState(new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function answer(accept: boolean) {
    setBusy(true); setError('');
    try {
      await api(`/foster-requests/${encodeURIComponent(request.id)}/respond`, { method: 'POST', json: { accept, availableFrom: from, availableUntil: until } });
      await queryClient.invalidateQueries();
    } catch (exception) { setError(errorMessage(exception, 'That did not work. Please try again.')); setBusy(false); }
  }
  return (
    <li className="rounded-[var(--ph-radius)] border border-amber-700 bg-amber-50 p-4 text-stone-950">
      <p className="font-semibold">{request.petName} needs a foster home</p>
      {request.note && <p className="mt-1 text-base leading-7 text-stone-800">{request.note}</p>}
      <p className="mt-1 text-sm text-stone-800">Choose the dates you could have {request.petName}. Staff will review your answer.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:max-w-md">
        <Field label="Available from">{(a) => <Input {...a} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="Available until">{(a) => <Input {...a} type="date" value={until} min={from} onChange={(e) => setUntil(e.target.value)} />}</Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>Yes, I can foster<span className="sr-only"> {request.petName}</span></Button>
        <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>Not now<span className="sr-only"> for {request.petName}</span></Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
    </li>
  );
}

/** The shelter's invitation to foster, shown on Home until it is dismissed. Hours volunteered are one quiet line. */
function useInvolvement() {
  const queryClient = useQueryClient();
  const involvement = useApi<MyInvolvement>('/me/involvement');
  async function dismiss() {
    await api('/me/foster-invitation/dismiss', { method: 'POST' }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ['/me/involvement'] });
  }
  return { data: involvement.data, dismiss };
}

export function Matches() {
  const quiz = useApi<LatestQuizResponse>('/quiz/latest');
  const result = quiz.data?.result;
  return (
    <Section id="matches" title="Your matches" aside={<Link href="/adopt/match">{result ? 'Retake the quiz' : 'Take the quiz'}</Link>}>
      <LoadState query={quiz} label="your matches" skeleton="h-28">
        {!result && <Muted>Answer a few questions and we will suggest animals.</Muted>}
        {result && (
          <>
            <Muted className="text-sm">Quiz taken {dayOnly(result.createdAt)}</Muted>
            {!result.recommendations.length && <Muted className="mt-2">{result.notice ?? 'No available animals fit those answers right now.'}</Muted>}
            <ul className="mt-3">
              {result.recommendations.slice(0, 3).map((item) => {
                const strength = matchStrength(item.score);
                return (
                  <Row key={item.pet.id}>
                    <div className="min-w-0 flex-1">
                      <a className="font-semibold text-stone-950 underline underline-offset-4" href={petPath(item.pet)}>{item.pet.name}</a>
                      <p className="mt-1 text-sm leading-6 text-stone-700">{item.reason}</p>
                    </div>
                    <Badge tone={strength === 'Strong' ? 'good' : 'neutral'}>{strength} match</Badge>
                  </Row>
                );
              })}
            </ul>
          </>
        )}
      </LoadState>
    </Section>
  );
}

/** Four animals who could use a friend most, so Home always has someone to meet. Animals already saved are left out. */
function Discover() {
  const { ids } = useSavedIds();
  const pets = useApi<{ pets: Pet[] }>('/pets', { staleSeconds: 60 });
  const picks = pets.data ? applyFilters(pets.data.pets, { ...DEFAULT_FILTERS, sort: 'help' }).filter((pet) => !ids.includes(pet.id)).slice(0, 4) : [];
  if (pets.isError || (pets.data && !picks.length)) return null;
  return (
    <Section id="discover" title="Could use a friend" aside={<Link href="/adopt?sort=help">See more</Link>}>
      {pets.isPending ? <Skeleton className="h-40" /> : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {picks.map((pet) => (
            <li key={pet.id} className="ph-lift rounded-[var(--ph-radius)] border border-stone-300 bg-white p-2 shadow-sm">
              <a href={petPath(pet)} className="block">
                <PetPicture pet={pet} decorative className="aspect-[4/3] w-full rounded-[calc(var(--ph-radius)-0.5rem)]" />
                <span className="mt-2 block truncate px-1 text-base font-bold text-stone-950">{pet.name}</span>
                <span className="block truncate px-1 pb-1 text-sm text-stone-700">{helpLabel(pet) || [pet.breed || pet.type, pet.age].filter(Boolean).join(' · ')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const JUMP_IN = [
  { href: '/adopt/match', title: 'Find my match', text: 'A few quick questions' },
  { href: '/visit', title: 'Plan a visit', text: 'Meet animals in person' },
  { href: '/volunteer', title: 'Volunteer', text: 'Walk dogs, play with cats' },
  { href: '/foster', title: 'Foster', text: 'A temporary home' },
] as const;

function JumpIn() {
  return (
    <section aria-label="Things to do">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {JUMP_IN.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="ph-lift block h-full rounded-[var(--ph-radius)] border border-stone-300 bg-[var(--ph-brand-soft)] p-4 text-stone-950">
              <span className="block text-base font-bold">{item.title}</span>
              <span className="mt-0.5 block text-sm text-stone-800">{item.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Overview({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || 'there';
  const appointments = useApi<VisitAppointmentListResponse>('/appointments');
  const registrations = useApi<VolunteerRegistrationListResponse>('/volunteer/registrations');
  const adoption = useApi<AdoptionApplicationListResponse>('/applications');
  const foster = useApi<FosterApplicationListResponse>('/foster-applications');
  const requests = useApi<{ requests: MemberFosterRequest[] }>('/foster-requests');
  const involvement = useInvolvement();

  const visits = (appointments.data?.appointments ?? []).filter((item) => item.status === 'booked' && upcoming(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const shifts = (registrations.data?.registrations ?? []).filter((item) => item.status === 'registered' && upcoming(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const open = (requests.data?.requests ?? []).filter((item) => item.response === 'pending');

  const attention: Attention[] = [];
  for (const visit of visits) if (daysUntil(visit.startsAt) <= 1) attention.push({ key: `v${visit.id}`, title: 'Your visit is coming up', detail: formatShelterRange(visit.startsAt, visit.endsAt), tab: 'activity', action: 'See visit' });
  for (const shift of shifts) if (daysUntil(shift.startsAt) <= 1) attention.push({ key: `s${shift.id}`, title: `Volunteer shift soon: ${shift.title}`, detail: formatShelterRange(shift.startsAt, shift.endsAt), tab: 'activity', action: 'See shift' });
  for (const item of adoption.data?.applications ?? []) if ((item.status === 'Approved' || item.status === 'Declined') && recent(item.reviewedAt)) attention.push({ key: `a${item.id}`, title: `Your adoption application for ${item.petName} was ${item.status.toLowerCase()}`, detail: item.status === 'Approved' ? 'The shelter will contact you about next steps.' : 'Thank you for applying. Other animals are waiting for homes.', tab: 'activity', action: 'See application' });
  for (const item of foster.data?.applications ?? []) if ((item.status === 'Approved' || item.status === 'Declined') && recent(item.reviewedAt)) attention.push({ key: `f${item.id}`, title: `Your foster application for ${item.petName} was ${item.status.toLowerCase()}`, detail: item.status === 'Approved' ? 'The shelter will contact you about next steps.' : 'Thank you for offering. Other animals need a temporary home.', tab: 'activity', action: 'See application' });

  const loading = appointments.isPending || registrations.isPending || adoption.isPending || foster.isPending || requests.isPending;
  const nextVisit = visits[0];
  const nextShift = shifts[0];

  const invited = Boolean(involvement.data?.fosterInvitation);
  const failed = appointments.isError || registrations.isError || adoption.isError || foster.isError || requests.isError;
  const hours = involvement.data && involvement.data.volunteerShifts > 0 ? `${involvement.data.volunteerShifts} shift${involvement.data.volunteerShifts === 1 ? '' : 's'}, ${involvement.data.volunteerHours} hours volunteered` : '';

  return (
    <div className="grid gap-6">
      {loading && <Skeleton className="h-32" />}
      {!loading && (open.length > 0 || attention.length > 0 || invited) && (
        <Section id="attention" title="Needs you">
          {open.length > 0 && <ul className="grid gap-3" aria-label="Foster requests from the shelter">{open.map((request) => <FosterRequestRow key={request.id} request={request} />)}</ul>}
          {attention.length > 0 && (
            <ul className={open.length ? 'mt-4' : undefined}>
              {attention.map((item) => (
                <Row key={item.key} className="items-center">
                  <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.title}</p><p className="mt-0.5 text-sm text-stone-700">{item.detail}</p></div>
                  <ButtonLink variant="secondary" href={`?tab=${item.tab}`}>{item.action}</ButtonLink>
                </Row>
              ))}
            </ul>
          )}
          {invited && (
            <Notice tone="info" title="Could you foster?" className={open.length || attention.length ? 'mt-4' : undefined}>
              You have helped a lot already. A foster home gives an animal a break from the kennel.
              <div className="mt-2 flex flex-wrap gap-2">
                <ButtonLink variant="primary" href="/foster">See animals to foster</ButtonLink>
                <Button variant="secondary" onClick={() => void involvement.dismiss()}>Not now</Button>
              </div>
            </Notice>
          )}
        </Section>
      )}

      {!loading && (
        <Section id="next" title="Next up" aside={nextVisit || nextShift ? <Link href="?tab=activity">See all</Link> : undefined}>
          {!nextVisit && !nextShift ? (
            <div className="flex items-center gap-4">
              <Mascot pose="welcome" size={72} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold leading-snug text-stone-950">Nothing booked yet, {first}.</p>
                <p className="mt-0.5 text-base text-stone-800">Want to meet someone?</p>
                <p className="mt-2"><ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink></p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {[
                ...(nextVisit ? [{ key: 'visit', startsAt: nextVisit.startsAt, ticket: <NextTicket key="visit" label="Shelter visit" title={nextVisit.pets.length ? `Meeting ${nextVisit.pets.map((pet) => pet.name).join(', ')}` : 'Come and meet the animals'} startsAt={nextVisit.startsAt} endsAt={nextVisit.endsAt} detail={`Party of ${nextVisit.partySize}`} /> }] : []),
                ...(nextShift ? [{ key: 'shift', startsAt: nextShift.startsAt, ticket: <NextTicket key="shift" label="Volunteer shift" title={nextShift.title} startsAt={nextShift.startsAt} endsAt={nextShift.endsAt} detail={nextShift.requirements || 'Volunteer shift'} /> }] : []),
              ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).map((item) => item.ticket)}
            </ul>
          )}
        </Section>
      )}

      {failed && <Muted className="text-sm">Some of your information did not load. Refresh to try again.</Muted>}
      <SavedStrip />
      <Discover />
      <JumpIn />
      {hours && <Muted className="text-sm">{hours}</Muted>}
    </div>
  );
}
