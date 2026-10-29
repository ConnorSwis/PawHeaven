import { useMemo, useState } from 'react';
import type { GetInvolvedFeed, Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { inlineData, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, ButtonLink, Card, Input, Select, Skeleton, TextLink, buttonClass, cx } from '../../ui';
import { CalendarIcon, ClockIcon, PawIcon, PinIcon, SearchIcon } from '../../ui/icons';
import { AnimalCard, AnimalCardSkeleton } from '../adopt/AnimalCard';
import { ClientOnly } from '../adopt/client';
import { petPath } from '../adopt/slug';

const quickLinks = [
  { label: 'Dogs', href: '/adopt?species=dog' },
  { label: 'Cats', href: '/adopt?species=cat' },
  { label: 'Small dogs', href: '/adopt?species=dog&size=small' },
  { label: 'Good with kids', href: '/adopt?kids=1' },
  { label: 'Seniors', href: '/adopt?age=senior' },
  { label: 'Open to foster', href: '/adopt?foster=1' },
];

function Hero() {
  return (
    <section className="border-b border-stone-300 bg-white" aria-labelledby="home-title">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <p className="text-sm font-semibold text-[var(--ph-brand-strong)]">PawHeaven animal shelter</p>
        <h1 id="home-title" className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">Find the pet who will make your home theirs.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-800">Search the dogs, cats, and other animals waiting at our shelter right now.</p>

        <form action="/adopt" method="get" role="search" aria-label="Find an animal" className="mt-8 grid max-w-4xl gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-[var(--ph-surface-alt)] p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-end">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="home-q" className="mb-1.5 block text-sm font-semibold text-stone-950">Name, breed, or what you want</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-700" />
              <Input id="home-q" type="search" name="q" autoComplete="off" placeholder="For example: lab, calm, senior" className="pl-11" />
            </div>
          </div>
          <div>
            <label htmlFor="home-species" className="mb-1.5 block text-sm font-semibold text-stone-950">Kind of animal</label>
            <Select id="home-species" name="species" defaultValue=""><option value="">Any animal</option><option value="dog">Dogs</option><option value="cat">Cats</option><option value="other">Other animals</option></Select>
          </div>
          <div>
            <label htmlFor="home-size" className="mb-1.5 block text-sm font-semibold text-stone-950">Size</label>
            <Select id="home-size" name="size" defaultValue=""><option value="">Any size</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="extra-large">Extra large</option></Select>
          </div>
          <Button type="submit" variant="primary" className="sm:col-span-2 lg:col-span-1">Search animals</Button>
        </form>

        <nav aria-label="Popular searches" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {quickLinks.map((link) => <li key={link.href}><a href={link.href} className="inline-flex min-h-11 items-center rounded-full border border-stone-400 bg-white px-4 text-base font-medium text-stone-900 hover:bg-stone-100">{link.label}</a></li>)}
          </ul>
        </nav>
        <p className="mt-5 text-base text-stone-800">Not sure what you want? <TextLink href="/adopt/match">Find your match with a short quiz</TextLink>.</p>
      </div>
    </section>
  );
}

function FeaturedSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="Animals looking for a home">
      <Skeleton className="h-8 w-72" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <AnimalCardSkeleton key={index} />)}</div>
    </section>
  );
}

type Mode = 'waiting' | 'new';

function Featured() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data, isError } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  const [mode, setMode] = useState<Mode>('waiting');
  const pets = data?.pets;

  const picks = useMemo(() => {
    if (!pets) return [];
    const withPhoto = pets.filter((pet) => pet.imageUrl);
    const pool = withPhoto.length >= 4 ? withPhoto : pets;
    return [...pool].sort((a, b) => (mode === 'waiting' ? b.daysInShelter - a.daysInShelter : a.daysInShelter - b.daysInShelter) || a.name.localeCompare(b.name)).slice(0, 4);
  }, [pets, mode]);
  const urgent = useMemo(() => pets?.filter((pet) => pet.fosterUrgent) ?? [], [pets]);

  if (isError && !pets) return null;
  if (!pets) return <FeaturedSkeleton />;
  return (
    <>
      {picks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="featured-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="featured-title" className="text-3xl font-semibold tracking-tight text-stone-950">{mode === 'waiting' ? 'Waiting the longest' : 'Just arrived'}</h2>
              <p className="mt-1 text-base text-stone-800">{mode === 'waiting' ? 'These animals have been here a while and would love a family.' : 'The newest animals to arrive at the shelter.'}</p>
            </div>
            <div role="group" aria-label="Show animals" className="flex gap-2">
              {([['waiting', 'Waiting longest'], ['new', 'Newest']] as [Mode, string][]).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cx('min-h-11 rounded-full border px-4 text-base font-semibold', mode === value ? 'border-[var(--ph-brand)] bg-[var(--ph-brand)] text-[var(--ph-on-brand)]' : 'border-stone-400 bg-white text-stone-900 hover:bg-stone-100')}>{label}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{picks.map((pet, index) => <AnimalCard key={pet.id} pet={pet} priority={index < 2} />)}</div>
          <p className="mt-6"><ButtonLink href="/adopt" variant="secondary">See all {pets.length} animals</ButtonLink></p>
        </section>
      )}
      {urgent.length > 0 && (
        <section className="border-y border-amber-700 bg-amber-50" aria-labelledby="foster-now-title">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="foster-now-title" className="text-2xl font-semibold tracking-tight text-stone-950">{urgent.length === 1 ? 'An animal needs a foster home now' : `${urgent.length} animals need a foster home now`}</h2>
              <p className="mt-1 text-base text-stone-900">
                {urgent.slice(0, 4).map((pet, index, list) => (
                  <span key={pet.id}><a className="font-semibold underline underline-offset-4" href={petPath(pet)}>{pet.name}</a>{index < list.length - 2 ? ', ' : index === list.length - 2 ? ' and ' : ''}</span>
                ))}
                {urgent.length > 4 ? ` and ${urgent.length - 4} more` : ''} could leave the shelter this week with your help.
              </p>
            </div>
            <ButtonLink variant="primary" href="/foster" className="shrink-0">Learn about fostering</ButtonLink>
          </div>
        </section>
      )}
    </>
  );
}

function WaysToHelp() {
  const { data } = useApi<GetInvolvedFeed>('/get-involved', { staleSeconds: 120 });
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const cards = [
    { title: 'Foster', href: '/foster', icon: PawIcon, text: 'Give an animal a quiet home for a few weeks and free up space for another.', count: data?.foster ? `${plural(data.foster.open, 'animal needs', 'animals need')} a foster home` : null },
    { title: 'Volunteer', href: '/volunteer', icon: ClockIcon, text: 'Walk dogs, socialize cats, and help around the shelter on your schedule.', count: data?.shifts ? plural(data.shifts.length, 'open shift', 'open shifts') : null },
    { title: 'Visit', href: '/visit', icon: CalendarIcon, text: 'Come meet the animals in person. No account needed to look at times.', count: data?.visits ? `${plural(data.visits.length, 'visit time', 'visit times')} open` : null },
  ];
  return (
    <section className="border-y border-stone-300 bg-white" aria-labelledby="help-title">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="help-title" className="text-3xl font-semibold tracking-tight text-stone-950">Not ready to adopt? Help in another way</h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {cards.map(({ title, href, icon: Icon, text, count }) => (
            <li key={title}>
              <Card as="div" className="relative flex h-full flex-col gap-2 hover:shadow-md">
                <Icon width={28} height={28} className="text-[var(--ph-brand-strong)]" />
                <h3 className="text-xl font-semibold text-stone-950"><a href={href} className="after:absolute after:inset-0 hover:underline hover:underline-offset-4">{title}</a></h3>
                <p className="text-base leading-7 text-stone-800">{text}</p>
                {count && <p className="mt-auto pt-1 text-base font-semibold text-[var(--ph-brand-strong)]">{count}</p>}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: 'Find', text: 'Search and filter the animals, or take the short matching quiz. Save the ones you love.' },
    { title: 'Meet', text: 'Plan a visit and spend time with the animals you picked. Applying does not hold an animal, so visit soon.' },
    { title: 'Take them home', text: 'Apply, talk with an adoption counselor, pay the fee, and take your new family member home.' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="how-title">
      <h2 id="how-title" className="text-3xl font-semibold tracking-tight text-stone-950">How adoption works</h2>
      <ol className="mt-6 grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[var(--ph-brand)] text-base font-semibold text-[var(--ph-on-brand)]">{index + 1}</span>
            <h3 className="mt-3 text-xl font-semibold text-stone-950"><span className="sr-only">Step {index + 1}: </span>{step.title}</h3>
            <p className="mt-1 text-base leading-7 text-stone-800">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5"><ButtonLink href="/adopt/process" className="whitespace-normal text-center">Fees, what to bring, and the full process</ButtonLink></p>
    </section>
  );
}

function Hours() {
  const { address } = SHELTER;
  return (
    <section className="border-t border-stone-300 bg-white" aria-labelledby="hours-title">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div>
          <h2 id="hours-title" className="text-3xl font-semibold tracking-tight text-stone-950">Come say hello</h2>
          <address className="mt-4 flex items-start gap-3 text-lg not-italic leading-7 text-stone-900">
            <PinIcon className="mt-1 shrink-0 text-[var(--ph-brand-strong)]" />
            <span>{address.line1}<br />{address.city}, {address.state} {address.zip}<br /><a className="font-medium underline underline-offset-4" href={SHELTER.phoneHref}>{SHELTER.phone}</a></span>
          </address>
          <p className="mt-5 flex flex-wrap gap-3"><a className={buttonClass('primary')} href="/visit">Plan a visit</a><a className={buttonClass('secondary')} href="/contact">Contact and directions</a></p>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-stone-950">Hours</h3>
          <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
            {SHELTER.hours.map((row) => (
              <div key={row.days} className="flex justify-between gap-4 py-3 text-base"><dt className="text-stone-800">{row.days}</dt><dd className="font-semibold text-stone-950">{row.open}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-6 text-stone-700">{SHELTER.hoursNote} Times are Eastern.</p>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Providers>
      <Hero />
      <ClientOnly fallback={<FeaturedSkeleton />}><Featured /></ClientOnly>
      <WaysToHelp />
      <HowItWorks />
      <Hours />
    </Providers>
  );
}
