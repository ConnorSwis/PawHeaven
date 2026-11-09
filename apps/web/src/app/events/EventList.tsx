import type { GetInvolvedFeed, ShelterEvent } from '@pawheaven/contracts';
import { formatShelterRange } from '@pawheaven/contracts/ui';
import { errorMessage, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { ButtonLink, Card, EmptyState, Notice, Skeleton, TextLink } from '../../ui';
import { petPath } from '../adopt/slug';

function EventCard({ event }: { event: ShelterEvent }) {
  return (
    <li>
      <Card as="article">
        <p className="text-sm font-semibold text-[var(--ph-brand-strong)]">{formatShelterRange(event.startsAt, event.endsAt)}</p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950">{event.title}</h2>
        {event.description && <p className="mt-2 text-base leading-7 text-stone-800">{event.description}</p>}
        {event.pets.length > 0 && (
          <p className="mt-3 text-sm leading-6 text-stone-700">
            <strong className="font-semibold text-stone-950">Featured animals: </strong>
            {event.pets.map((pet, index) => <span key={pet.id}>{index > 0 && ', '}<TextLink href={petPath(pet)}>{pet.name}</TextLink></span>)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink variant="primary" href="/visit">Plan a visit</ButtonLink>
          <ButtonLink href="/volunteer">See volunteer shifts</ButtonLink>
        </div>
      </Card>
    </li>
  );
}

function EventListContent() {
  const feed = useApi<GetInvolvedFeed>('/get-involved', { staleSeconds: 60 });
  const events = (feed.data?.events ?? []).filter((event) => Date.parse(event.endsAt) > Date.now());

  if (feed.isPending) return <div className="grid gap-4" aria-label="Loading events"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>;
  if (feed.isError) return <Notice tone="error" title="We could not load upcoming events">{errorMessage(feed.error, 'Please check your connection and try again.')}</Notice>;
  if (!events.length) return <Card><EmptyState title="No events are coming up right now">Please check back soon, or plan a regular visit to meet the animals.</EmptyState></Card>;

  return <ul className="grid gap-4" aria-label="Upcoming shelter events">{events.map((event) => <EventCard key={event.id} event={event} />)}</ul>;
}

export default function EventList() {
  return <Providers><EventListContent /></Providers>;
}
