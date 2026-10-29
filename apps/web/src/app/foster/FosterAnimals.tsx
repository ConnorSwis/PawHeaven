import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { MemberFosterRequest, Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { Badge, Button, ButtonLink, Card, EmptyState, Field, Input, Notice, Skeleton, TextLink } from '../../ui';
import { api, errorMessage, useApi, useMe } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { useToast } from '../../ui/toast';
import { addDays, ClientOnly, petFactsLine, petHref, PetPicture, plainDate, shelterToday } from '../involve/common';

function FosterRequest({ request, onDone }: { request: MemberFosterRequest; onDone: () => void }) {
  const today = shelterToday();
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(addDays(today, 28));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  async function answer(accept: boolean) {
    if (accept && (!from || !until || until < from)) { setError('Choose a start date, and an end date on or after it.'); return; }
    setBusy(true);
    setError('');
    try {
      await api(`/foster-requests/${encodeURIComponent(request.id)}/respond`, { method: 'POST', json: { accept, availableFrom: from, availableUntil: until } });
      toast.success(accept ? `Thank you. We told the team you can foster ${request.petName}.` : 'No problem. Thank you for letting us know.');
      onDone();
    } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }

  return (
    <li className="rounded-[var(--ph-radius)] border border-amber-700 bg-amber-50 p-4">
      <p className="text-lg font-semibold text-stone-950">{request.petName} needs a foster home</p>
      {request.note && <p className="mt-1 text-base text-stone-800">{request.note}</p>}
      {request.response === 'accepted' ? <p className="mt-2"><Badge tone="good">You said yes. Staff will be in touch.</Badge></p>
        : request.response === 'declined' ? <p className="mt-2"><Badge>You said not now</Badge></p>
        : (
          <div className="mt-3 grid gap-3">
            <p className="text-base text-stone-900">Can you take {request.petName} from {plainDate(from)} to {plainDate(until)}?</p>
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4">Change the dates</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Available from">{(aria) => <Input {...aria} type="date" min={today} value={from} onChange={(event) => setFrom(event.target.value)} />}</Field>
                <Field label="Available until">{(aria) => <Input {...aria} type="date" min={from || today} value={until} onChange={(event) => setUntil(event.target.value)} />}</Field>
              </div>
            </details>
            {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>{busy ? 'Sending…' : `Yes, I can foster ${request.petName}`}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>Not now</Button>
            </div>
          </div>
        )}
    </li>
  );
}

function AnimalCard({ pet }: { pet: Pet }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white">
      <PetPicture pet={pet} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">{pet.fosterUrgent ? <Badge tone="danger">Needs a home now</Badge> : <Badge>Open to foster</Badge>}</div>
        <h3 className="text-xl font-semibold leading-tight text-stone-950"><a href={petHref(pet)} className="hover:underline hover:underline-offset-4">{pet.name}</a></h3>
        <p className="text-sm leading-5 text-stone-800">{petFactsLine(pet)}</p>
        {pet.summary && <p className="line-clamp-3 text-sm leading-6 text-stone-700">{pet.summary}</p>}
        <div className="mt-auto pt-2"><ButtonLink variant="primary" className="w-full" href={`/apply?type=foster&pet=${pet.id}`}>Foster {pet.name}</ButtonLink></div>
      </div>
    </article>
  );
}

function Animals() {
  const me = useMe();
  const queryClient = useQueryClient();
  const petsQuery = useApi<{ pets: Pet[] }>('/pets', { staleSeconds: 60 });
  const requestsQuery = useApi<{ requests: MemberFosterRequest[] }>(me.data ? '/foster-requests' : null, { staleSeconds: 10 });
  const pets = useMemo(() => (petsQuery.data?.pets ?? []).filter((pet) => pet.fosterAvailable).sort((a, b) => Number(b.fosterUrgent) - Number(a.fosterUrgent) || a.name.localeCompare(b.name)), [petsQuery.data]);
  const requests = (requestsQuery.data?.requests ?? []).filter((item) => item.response === 'pending');
  const urgent = pets.filter((pet) => pet.fosterUrgent).length;

  return (
    <div className="grid gap-10">
      {requests.length > 0 && (
        <section aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="text-2xl font-semibold tracking-tight text-stone-950">The shelter is asking for your help</h2>
          <p className="mt-1 text-base text-stone-800">You are an approved foster, so staff sent you these requests.</p>
          <ul className="mt-4 grid gap-3">{requests.map((request) => <FosterRequest key={request.id} request={request} onDone={() => void queryClient.invalidateQueries({ queryKey: ['/foster-requests'] })} />)}</ul>
        </section>
      )}

      <section aria-labelledby="animals-heading">
        <h2 id="animals-heading" className="text-2xl font-semibold tracking-tight text-stone-950">Animals who need a foster home</h2>
        <p role="status" className="mt-1 text-base text-stone-800">{petsQuery.isLoading ? 'Loading animals…' : pets.length ? `${pets.length} ${pets.length === 1 ? 'animal is' : 'animals are'} open to foster${urgent ? `, ${urgent} who need${urgent === 1 ? 's' : ''} a home now` : ''}.` : ''}</p>
        <div className="mt-5">
          {petsQuery.isLoading ? (
            <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-80 w-full" />)}</div>
          ) : petsQuery.isError ? (
            <Notice tone="error" title="We could not load the animals.">Please try again, or call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink>. <Button variant="secondary" className="mt-3" onClick={() => void petsQuery.refetch()}>Try again</Button></Notice>
          ) : !pets.length ? (
            <Card><EmptyState title="No animals are listed for fostering right now" action={<TextLink href={`mailto:${SHELTER.email}?subject=Fostering`}>Email us and we will tell you when someone needs a home</TextLink>}>Needs change quickly. Write to us and we will reach out when an animal needs a foster home.</EmptyState></Card>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pets.map((pet) => <li key={pet.id} className="flex"><div className="flex w-full"><AnimalCard pet={pet} /></div></li>)}</ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function FosterAnimals() {
  return <Providers><ClientOnly fallback={<div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-80 w-full" />)}</div>}><Animals /></ClientOnly></Providers>;
}
