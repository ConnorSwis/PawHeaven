import { useMemo, useState } from 'react';
import type { GetInvolvedFeed, Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { inlineData, useApi } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Button, ButtonLink, Card, ChipLink, ChipToggle, NoteCard, SearchPill, Section, SectionHeader, Skeleton, TextLink, buttonClass, cx } from '../../ui';
import { CalendarIcon, ClockIcon, PawIcon, PinIcon } from '../../ui/icons';
import { AnimalCard, AnimalCardSkeleton, PetPhoto, petPhotoAlt, waitingText } from '../adopt/AnimalCard';
import { ClientOnly } from '../adopt/client';
import { petPath } from '../adopt/slug';
import { NeedsHelpRow } from '../status/NeedsHelp';
import { needsHelpMost } from '../status/help';
import { StatusBanner } from '../status/StatusBanner';

const quickLinks = [
  { label: 'Dogs', href: '/adopt?species=dog' },
  { label: 'Cats', href: '/adopt?species=cat' },
  { label: 'Good with kids', href: '/adopt?kids=1' },
  { label: 'Seniors', href: '/adopt?age=senior' },
];

/** The animal shown beside the headline: one staff flagged as needing help (with a photo), else the one waiting longest. */
export function pickFeatured(pets: Pet[]): Pet | null {
  const withPhoto = pets.filter((pet) => pet.imageUrl);
  return needsHelpMost(withPhoto, 1)[0] ?? [...withPhoto].sort((a, b) => b.daysInShelter - a.daysInShelter || a.name.localeCompare(b.name))[0] ?? null;
}

const photoFrame = 'ph-photo-blob aspect-[1/1.05] w-full border-[6px] border-white shadow-lg';

/** The live count in the eyebrow pill. Falls back to a plain line until the animals have loaded. */
function HeroEyebrow() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  const count = data?.pets.length ?? 0;
  return <>{count > 0 ? `${count} ${count === 1 ? 'animal is' : 'animals are'} waiting today` : 'Animals are waiting for you today'}</>;
}

function HeroPhoto() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  const pet = useMemo(() => (data ? pickFeatured(data.pets) : null), [data]);
  if (!pet) return <HeroPhotoPlaceholder />;
  return (
    <div className="ph-blob relative mx-auto w-[min(78%,16rem)] lg:w-full lg:max-w-sm">
      <PetPhoto pet={pet} priority alt={petPhotoAlt(pet)} className={photoFrame} />
      <NoteCard href={petPath(pet)} icon={<PawIcon width={18} height={18} />} title={`${pet.name} says hi`} className="absolute -bottom-3 left-0 max-w-[85%] sm:-left-4">{waitingText(pet)}</NoteCard>
    </div>
  );
}

function HeroPhotoPlaceholder() {
  return (
    <div aria-hidden="true" className="ph-blob relative mx-auto w-[min(78%,16rem)] lg:w-full lg:max-w-sm">
      <div className={cx(photoFrame, 'grid place-items-center bg-stone-200 text-stone-600')}><PawIcon width={56} height={56} /></div>
    </div>
  );
}

function Hero() {
  return (
    <section className="overflow-x-clip" aria-labelledby="home-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:pb-12 lg:pt-14">
        <div className="order-2 lg:order-1">
          <p className="mb-4 inline-flex items-center gap-2 rounded-[var(--ph-radius-pill)] bg-[var(--ph-brand-soft)] px-3.5 py-1.5 text-sm font-bold text-[var(--ph-brand-strong)]">
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            <ClientOnly fallback="Animals are waiting for you today"><HeroEyebrow /></ClientOnly>
          </p>
          <h1 id="home-title" className="max-w-2xl text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl lg:leading-[1.05]">Find the pet who will make your <span className="ph-highlight">home</span> theirs.</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-stone-800">Search the dogs, cats, and other animals waiting at our shelter right now.</p>

          <form action="/adopt" method="get" role="search" aria-label="Find an animal" className="mt-7 max-w-xl">
            <SearchPill id="home-q" name="q" label="Search by name, breed, or what you want" placeholder="Try: lab, calm, senior" maxLength={100} action={<Button type="submit" variant="primary">Search</Button>} />
          </form>

          <nav aria-label="Popular searches" className="mt-4">
            <ul className="flex flex-wrap gap-2">
              {quickLinks.map((link) => <li key={link.href}><ChipLink href={link.href}>{link.label}</ChipLink></li>)}
            </ul>
          </nav>
          <p className="mt-5 text-base text-stone-800">Not sure what you want? <TextLink href="/adopt/match">Find your match with a short quiz</TextLink>.</p>
        </div>
        <div className="order-1 lg:order-2">
          <ClientOnly fallback={<HeroPhotoPlaceholder />}><HeroPhoto /></ClientOnly>
        </div>
      </div>
    </section>
  );
}

/** Animals staff flagged as needing help, above the general featured grid. Absent while loading, on error, and when no one is flagged. */
function NeedsHelp() {
  const inline = useMemo(() => inlineData<{ pets: Pet[] }>(), []);
  const { data } = useApi<{ pets: Pet[] }>('/pets', { initialData: inline ?? undefined });
  if (!data) return null;
  return <NeedsHelpRow pets={data.pets} id="needs-help-title" action={<ButtonLink href="/adopt?sort=help">See all</ButtonLink>} />;
}

function FeaturedSkeleton() {
  return (
    <Section tone="tint" labelledBy="featured-loading">
      <h2 id="featured-loading" className="sr-only">Animals looking for a home</h2>
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <AnimalCardSkeleton key={index} />)}</div>
    </Section>
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
        <Section tone="tint" labelledBy="featured-title">
          <SectionHeader
            id="featured-title"
            title={mode === 'waiting' ? 'Waiting the longest' : 'Just arrived'}
            intro={mode === 'waiting' ? 'These animals have been here a while and would love a family.' : 'The newest animals to arrive at the shelter.'}
            action={
              <div role="group" aria-label="Show animals" className="flex gap-2">
                {([['waiting', 'Waiting longest'], ['new', 'Newest']] as [Mode, string][]).map(([value, label]) => <ChipToggle key={value} pressed={mode === value} onClick={() => setMode(value)}>{label}</ChipToggle>)}
              </div>
            }
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{picks.map((pet, index) => <AnimalCard key={pet.id} pet={pet} priority={index < 2} />)}</div>
          <p className="mt-8"><ButtonLink href="/adopt" variant="secondary">See all {pets.length} animals</ButtonLink></p>
        </Section>
      )}
      {urgent.length > 0 && (
        <Section labelledBy="foster-now-title" innerClassName="pb-0 sm:pb-0">
          <div className="flex flex-col gap-4 rounded-[var(--ph-radius)] border border-amber-700 bg-amber-50 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="foster-now-title" className="text-xl font-bold tracking-tight text-stone-950 sm:text-2xl">{urgent.length === 1 ? 'An animal needs a foster home now' : `${urgent.length} animals need a foster home now`}</h2>
              <p className="mt-1.5 text-base leading-7 text-stone-900">
                {urgent.slice(0, 4).map((pet, index, list) => (
                  <span key={pet.id}><a className="font-semibold underline underline-offset-4" href={petPath(pet)}>{pet.name}</a>{index < list.length - 2 ? ', ' : index === list.length - 2 ? ' and ' : ''}</span>
                ))}
                {urgent.length > 4 ? ` and ${urgent.length - 4} more` : ''} could leave the shelter this week with your help.
              </p>
            </div>
            <ButtonLink variant="primary" href="/foster" className="shrink-0">Learn about fostering</ButtonLink>
          </div>
        </Section>
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
    <Section labelledBy="help-title">
      <SectionHeader id="help-title" title="Not ready to adopt? Help in another way" />
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {cards.map(({ title, href, icon: Icon, text, count }) => (
          <li key={title}>
            <Card as="div" className="ph-lift relative flex h-full flex-col gap-2">
              <span aria-hidden="true" className="mb-1 grid size-12 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]"><Icon width={26} height={26} /></span>
              <h3 className="text-xl font-semibold text-stone-950"><a href={href} className="after:absolute after:inset-0 after:rounded-[var(--ph-radius)] hover:underline hover:underline-offset-4">{title}</a></h3>
              <p className="text-base leading-7 text-stone-800">{text}</p>
              {count && <p className="mt-auto pt-1 text-base font-semibold text-[var(--ph-brand-strong)]">{count}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { title: 'Find', text: 'Search and filter the animals, or take the short matching quiz. Save the ones you love.' },
    { title: 'Meet', text: 'Plan a visit and spend time with the animals you picked. Applying does not hold an animal, so visit soon.' },
    { title: 'Take them home', text: 'Apply, talk with an adoption counselor, pay the fee, and take your new family member home.' },
  ];
  return (
    <Section tone="tint" labelledBy="how-title">
      <SectionHeader id="how-title" title="How adoption works" />
      <ol className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-[var(--ph-radius)] border border-stone-300 bg-white p-6 shadow-sm">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[var(--ph-brand)] text-base font-bold text-[var(--ph-on-brand)] shadow-[var(--ph-shadow-brand)]">{index + 1}</span>
            <h3 className="mt-4 text-xl font-semibold text-stone-950"><span className="sr-only">Step {index + 1}: </span>{step.title}</h3>
            <p className="mt-1.5 text-base leading-7 text-stone-800">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8"><ButtonLink href="/adopt/process" className="whitespace-normal text-center">Fees, what to bring, and the full process</ButtonLink></p>
    </Section>
  );
}

function Hours() {
  const { address } = SHELTER;
  return (
    <Section labelledBy="hours-title" innerClassName="grid gap-10 md:grid-cols-2 md:items-start">
      <div>
        <h2 id="hours-title" className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">Come say hello</h2>
        <address className="mt-5 flex items-start gap-3 text-lg not-italic leading-7 text-stone-900">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]"><PinIcon /></span>
          <span className="pt-0.5">{address.line1}<br />{address.city}, {address.state} {address.zip}<br /><a className="font-medium underline underline-offset-4" href={SHELTER.phoneHref}>{SHELTER.phone}</a></span>
        </address>
        <p className="mt-6 flex flex-wrap gap-3"><a className={buttonClass('primary')} href="/visit">Plan a visit</a><a className={buttonClass('secondary')} href="/contact">Contact and directions</a></p>
      </div>
      <Card as="div">
        <h3 className="text-xl font-semibold text-stone-950">Hours</h3>
        <dl className="mt-3 divide-y divide-stone-200">
          {SHELTER.hours.map((row) => (
            <div key={row.days} className="flex justify-between gap-4 py-3 text-base"><dt className="text-stone-800">{row.days}</dt><dd className="font-semibold text-stone-950">{row.open}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-sm leading-6 text-stone-700">{SHELTER.hoursNote} Times are Eastern.</p>
      </Card>
    </Section>
  );
}

export default function Home() {
  return (
    <Providers>
      <Hero />
      <StatusBanner contained className="pb-8" />
      <ClientOnly fallback={null}><NeedsHelp /></ClientOnly>
      <ClientOnly fallback={<FeaturedSkeleton />}><Featured /></ClientOnly>
      <WaysToHelp />
      <HowItWorks />
      <Hours />
    </Providers>
  );
}
