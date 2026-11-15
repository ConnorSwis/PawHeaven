import { useMemo, useState } from 'react';
import type { GetInvolvedFeed, Pet, ShelterEvent } from '@pawheaven/contracts';
import { SHELTER_TIME_ZONE } from '@pawheaven/contracts/ui';
import { errorMessage, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { ButtonLink, Card, EmptyState, Notice, Skeleton } from '../../ui';
import { ClockIcon, PinIcon } from '../../ui/icons';
import { petPath } from '../adopt/slug';
import { addressLine, dayLong, timeRange, zoneName } from '../involve/common';

const part = (options: Intl.DateTimeFormatOptions, iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, ...options }).format(new Date(iso));

/** The month and day as a tile. The full date is in the text beside it, so the tile is decorative. */
function DateBadge({ iso }: { iso: string }) {
  return (
    <div aria-hidden="true" className="flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-[calc(var(--ph-radius)-0.5rem)] bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]">
      <span className="text-xs font-bold uppercase tracking-wide">{part({ month: 'short' }, iso)}</span>
      <span className="text-3xl font-bold leading-none">{part({ day: 'numeric' }, iso)}</span>
    </div>
  );
}

/** Small round photos of the featured animals, each a link to the animal. Names stay in the text for everyone. */
function Featured({ pets, photos }: { pets: ShelterEvent['pets']; photos: Map<string, string> }) {
  return (
    <div className="mt-4 border-t border-stone-200 pt-4">
      <p className="text-sm font-semibold text-stone-950">Featured animals</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {pets.map((pet) => (
          <li key={pet.id}>
            <a href={petPath(pet)} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ph-radius-pill)] border border-stone-300 bg-white py-1 pl-1 pr-4 text-base font-semibold text-stone-950 hover:bg-stone-100">
              <PetAvatar pet={pet} photo={photos.get(pet.id)} />
              {pet.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PetAvatar({ pet, photo }: { pet: ShelterEvent['pets'][number]; photo?: string }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed
    ? <img src={photo} alt="" width={36} height={36} loading="lazy" onError={() => setFailed(true)} className="size-9 rounded-full bg-stone-200 object-cover" />
    : <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-sm font-bold text-[var(--ph-brand-strong)]">{pet.name.slice(0, 1).toUpperCase()}</span>;
}

function EventCard({ event, photos }: { event: ShelterEvent; photos: Map<string, string> }) {
  return (
    <li>
      <Card as="article" className="h-full">
        <div className="flex gap-4">
          <DateBadge iso={event.startsAt} />
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-tight text-stone-950">{event.title}</h3>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-stone-800"><ClockIcon aria-hidden="true" width={16} height={16} className="shrink-0" />{dayLong(event.startsAt)}, {timeRange(event.startsAt, event.endsAt)} {zoneName(event.startsAt)}</p>
            <p className="mt-1 flex items-start gap-2 text-sm text-stone-800"><PinIcon aria-hidden="true" width={16} height={16} className="mt-0.5 shrink-0" /><span>At the shelter: {addressLine}</span></p>
          </div>
        </div>
        {event.description && <p className="mt-4 text-base leading-7 text-stone-800">{event.description}</p>}
        {event.pets.length > 0 && <Featured pets={event.pets} photos={photos} />}
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink>
          <ButtonLink href="/volunteer">See volunteer shifts</ButtonLink>
        </div>
      </Card>
    </li>
  );
}

function EventListContent() {
  const feed = useApi<GetInvolvedFeed>('/get-involved', { staleSeconds: 60 });
  // Photos for the featured animals come from the animals list, which the other pages already cache.
  const animals = useApi<{ pets: Pet[] }>('/pets', { staleSeconds: 60 });
  const photos = useMemo(() => new Map((animals.data?.pets ?? []).flatMap((pet) => (pet.imageUrl ? [[pet.id, pet.imageUrl] as [string, string]] : []))), [animals.data]);
  const events = (feed.data?.events ?? []).filter((event) => Date.parse(event.endsAt) > Date.now());

  if (feed.isPending) return <div className="grid gap-5 lg:grid-cols-2" aria-label="Loading events"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (feed.isError) return <Notice tone="error" title="We could not load upcoming events">{errorMessage(feed.error, 'Please check your connection and try again.')}</Notice>;
  if (!events.length) return <Card><EmptyState pose="sleeping" title="No events are coming up right now" action={<ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink>}>Please check back soon, or come on a regular open day to meet the animals.</EmptyState></Card>;

  return <ul className="grid gap-5 lg:grid-cols-2" aria-label="Upcoming shelter events">{events.map((event) => <EventCard key={event.id} event={event} photos={photos} />)}</ul>;
}

export default function EventList() {
  return <Providers><EventListContent /></Providers>;
}
