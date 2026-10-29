import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { matchStrength, type AdoptionApplicationListResponse, type ApiUser, type FosterApplicationListResponse, type LatestQuizResponse, type MemberFosterRequest, type MyInvolvement, type VisitAppointmentListResponse, type VolunteerRegistrationListResponse } from '@pawheaven/contracts';
import { daysUntil, formatShelterRange } from '@pawheaven/contracts/ui';
import { api, errorMessage, useApi } from '../../lib/fetch';
import { Badge, Button, ButtonLink, Field, Input, Notice, Skeleton } from '../../ui';
import { CheckIcon } from '../../ui/icons';
import { LoadState, Link, Muted, Row, Section, dayOnly, petPath } from './common';

type Attention = { key: string; title: string; detail: string; tab: string; action: string };

const upcoming = (startsAt: string) => Date.parse(startsAt) > Date.now();
const recent = (reviewedAt: string | null) => reviewedAt !== null && Date.now() - Date.parse(reviewedAt) < 7 * 86_400_000;

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

function Involvement() {
  const queryClient = useQueryClient();
  const involvement = useApi<MyInvolvement>('/me/involvement');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function setAlerts(optIn: boolean) {
    setBusy(true);
    try { await api('/me/foster-alerts', { method: 'PUT', json: { optIn } }); setNote(optIn ? 'You will get an email when an animal needs a foster home.' : 'Foster alerts are off.'); await queryClient.invalidateQueries({ queryKey: ['/me/involvement'] }); }
    catch (error) { setNote(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function dismiss() {
    await api('/me/foster-invitation/dismiss', { method: 'POST' }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ['/me/involvement'] });
  }
  return (
    <Section id="involvement" title="Your involvement">
      <LoadState query={involvement} label="your volunteer hours" skeleton="h-24">
        {involvement.data && (
          <div className="grid gap-4">
            <p className="text-base text-stone-800">Volunteering so far: <strong className="text-stone-950">{involvement.data.volunteerShifts} shift{involvement.data.volunteerShifts === 1 ? '' : 's'}, {involvement.data.volunteerHours} hours</strong></p>
            {involvement.data.fosterInvitation && (
              <Notice tone="info" title="The shelter invites you to foster">
                You have helped a lot already. Fostering gives an animal a break from the kennel.
                <div className="mt-2 flex flex-wrap gap-2">
                  <ButtonLink variant="primary" href="/foster">See animals to foster</ButtonLink>
                  <Button variant="secondary" onClick={() => void dismiss()}>Dismiss</Button>
                </div>
              </Notice>
            )}
            <div>
              <label className="flex min-h-11 items-center gap-3 text-base text-stone-950">
                <input type="checkbox" className="size-5" checked={involvement.data.fosterAlerts} disabled={!involvement.data.approvedFoster || busy} onChange={(e) => void setAlerts(e.target.checked)} />
                Email me when the shelter needs a foster
              </label>
              {!involvement.data.approvedFoster && <p className="mt-1 text-sm text-stone-700">Available once one of your foster applications is approved.</p>}
              <p role="status" className="mt-1 text-sm text-stone-800">{note}</p>
            </div>
          </div>
        )}
      </LoadState>
    </Section>
  );
}

function Matches() {
  const quiz = useApi<LatestQuizResponse>('/quiz/latest');
  const result = quiz.data?.result;
  return (
    <Section id="matches" title="Your matches" aside={<Link href="/adopt/match">{result ? 'Retake the quiz' : 'Take the quiz'}</Link>}>
      <LoadState query={quiz} label="your matches" skeleton="h-28">
        {!result && <Muted>Answer a few questions and we will suggest animals that suit you.</Muted>}
        {result && (
          <>
            <Muted className="text-sm">From your quiz on {dayOnly(result.createdAt)}.</Muted>
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

export function Overview({ user }: { user: ApiUser }) {
  const appointments = useApi<VisitAppointmentListResponse>('/appointments');
  const registrations = useApi<VolunteerRegistrationListResponse>('/volunteer/registrations');
  const adoption = useApi<AdoptionApplicationListResponse>('/applications');
  const foster = useApi<FosterApplicationListResponse>('/foster-applications');
  const requests = useApi<{ requests: MemberFosterRequest[] }>('/foster-requests');

  const visits = (appointments.data?.appointments ?? []).filter((item) => item.status === 'booked' && upcoming(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const shifts = (registrations.data?.registrations ?? []).filter((item) => item.status === 'registered' && upcoming(item.startsAt)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const open = (requests.data?.requests ?? []).filter((item) => item.response === 'pending');

  const attention: Attention[] = [];
  for (const visit of visits) if (daysUntil(visit.startsAt) <= 1) attention.push({ key: `v${visit.id}`, title: 'Your shelter visit is coming up', detail: formatShelterRange(visit.startsAt, visit.endsAt), tab: 'visits', action: 'See visit' });
  for (const shift of shifts) if (daysUntil(shift.startsAt) <= 1) attention.push({ key: `s${shift.id}`, title: `Volunteer shift soon: ${shift.title}`, detail: formatShelterRange(shift.startsAt, shift.endsAt), tab: 'visits', action: 'See shift' });
  for (const item of adoption.data?.applications ?? []) if ((item.status === 'Approved' || item.status === 'Declined') && recent(item.reviewedAt)) attention.push({ key: `a${item.id}`, title: `Your adoption application for ${item.petName} was ${item.status.toLowerCase()}`, detail: item.status === 'Approved' ? 'The shelter will contact you about next steps.' : 'Thank you for applying. Other animals are waiting for homes.', tab: 'applications', action: 'See application' });
  for (const item of foster.data?.applications ?? []) if ((item.status === 'Approved' || item.status === 'Declined') && recent(item.reviewedAt)) attention.push({ key: `f${item.id}`, title: `Your foster application for ${item.petName} was ${item.status.toLowerCase()}`, detail: item.status === 'Approved' ? 'The shelter will contact you about next steps.' : 'Thank you for offering. Other animals need a temporary home.', tab: 'applications', action: 'See application' });

  const loading = appointments.isPending || registrations.isPending || adoption.isPending || foster.isPending || requests.isPending;
  const nextVisit = visits[0];
  const nextShift = shifts[0];

  return (
    <div className="grid gap-6">
      <Section id="attention" title="Needs your attention">
        {loading ? <div className="grid gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
          <>
            {open.length > 0 && <ul className="grid gap-3" aria-label="Foster requests from the shelter">{open.map((request) => <FosterRequestRow key={request.id} request={request} />)}</ul>}
            {attention.length > 0 && (
              <ul className={open.length ? 'mt-4' : undefined}>
                {attention.map((item) => (
                  <Row key={item.key}>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.title}</p><p className="mt-1 text-sm text-stone-700">{item.detail}</p></div>
                    <ButtonLink variant="secondary" href={`?tab=${item.tab}`}>{item.action}</ButtonLink>
                  </Row>
                ))}
              </ul>
            )}
            {!open.length && !attention.length && (
              <p className="flex items-center gap-2 text-base text-stone-800"><CheckIcon aria-hidden="true" /> Nothing needs your attention, {user.name.split(' ')[0]}.</p>
            )}
            {(appointments.isError || registrations.isError || adoption.isError || foster.isError || requests.isError) && (
              <Muted className="mt-3 text-sm">Some of your information did not load, so this list may be incomplete. Refresh the page to try again.</Muted>
            )}
          </>
        )}
      </Section>

      <Section id="next" title="What is next" aside={<Link href="?tab=visits">All visits and shifts</Link>}>
        {loading ? <Skeleton className="h-20" /> : !nextVisit && !nextShift ? (
          <div>
            <Muted>Nothing is booked yet. Plan a visit to meet the animals, or sign up for a volunteer shift.</Muted>
            <div className="mt-3 flex flex-wrap gap-2"><ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink><ButtonLink variant="secondary" href="/volunteer">Find a volunteer shift</ButtonLink></div>
          </div>
        ) : (
          <ul>
            {nextVisit && (
              <Row>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-950">Shelter visit</p>
                  <p className="mt-1 text-base text-stone-800">{formatShelterRange(nextVisit.startsAt, nextVisit.endsAt)}</p>
                  <p className="mt-1 text-sm text-stone-700">{nextVisit.pets.length ? `Meeting ${nextVisit.pets.map((pet) => pet.name).join(', ')} · ` : ''}party of {nextVisit.partySize}</p>
                </div>
              </Row>
            )}
            {nextShift && (
              <Row>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-950">Volunteer shift: {nextShift.title}</p>
                  <p className="mt-1 text-base text-stone-800">{formatShelterRange(nextShift.startsAt, nextShift.endsAt)}</p>
                </div>
              </Row>
            )}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Matches />
        <Involvement />
      </div>
    </div>
  );
}
