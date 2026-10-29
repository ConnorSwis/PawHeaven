import { useEffect, useMemo, useState } from 'react';
import { matchStrength, type LatestQuizResponse, type Pet } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { ApiRequestError, errorMessage, inlineData, useApi, useMe } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, Skeleton, TextLink, cx } from '../../ui';
import { ChevronLeftIcon } from '../../ui/icons';
import { AnimalCard, AnimalCardSkeleton, PetBadges, PetPhoto, SaveButton, petFacts, petPhotoAlt, waitingText } from './AnimalCard';
import { isSenior } from './age';
import { ClientOnly } from './client';
import { petPath, shortIdFromPath } from './slug';

const money = (dollars: number) => (dollars === 0 ? 'Free' : `$${dollars}`);
const SIZE_ORDER = ['Small', 'Medium', 'Large', 'Extra large'];

type Source = { pet?: Pet; missing?: boolean; path?: string; legacy?: boolean };

function readSource(): Source {
  const inline = inlineData<{ pet?: Pet; missing?: boolean }>();
  if (inline?.pet) return { pet: inline.pet };
  if (inline?.missing) return { missing: true };
  const legacy = new URLSearchParams(window.location.search).get('id');
  if (legacy && /^[0-9a-f-]{36}$/i.test(legacy)) return { path: `/pets/${legacy}`, legacy: true };
  const short = shortIdFromPath(window.location.pathname);
  return short ? { path: `/pets/s/${short}` } : { missing: true };
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8" aria-busy="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-6 h-10 w-64" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="hidden h-64 w-full lg:block" />
      </div>
    </div>
  );
}

function NotFound({ failed, retry }: { failed?: string; retry?: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <a href="/adopt" className="inline-flex min-h-11 items-center gap-1 font-medium text-[var(--ph-brand-strong)] underline underline-offset-4"><ChevronLeftIcon />All animals</a>
      {failed ? (
        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">We could not load this animal</h1>
          <Notice tone="error" className="mt-4">{failed}</Notice>
          {retry && <Button className="mt-4" variant="primary" onClick={retry}>Try again</Button>}
        </div>
      ) : (
        <div className="mt-6 rounded-[var(--ph-radius)] border border-stone-300 bg-white">
          <EmptyState title="We could not find that animal" action={<div className="mt-3 flex flex-wrap justify-center gap-3"><ButtonLink variant="primary" href="/adopt">See animals looking for a home</ButtonLink><ButtonLink href="/adopt/match">Find your match</ButtonLink></div>}>
            This animal may have found a home, or the address may have a typo. Good news if so. Plenty of others are waiting to meet you.
          </EmptyState>
        </div>
      )}
      <p className="mt-6 text-base text-stone-800">Not ready to adopt? You can also <TextLink href="/foster">foster</TextLink> or <TextLink href="/volunteer">volunteer</TextLink>.</p>
    </div>
  );
}

function Gallery({ pet }: { pet: Pet }) {
  const photos = useMemo(() => [...new Set([pet.imageUrl, ...pet.galleryUrls].filter((url): url is string => Boolean(url)))], [pet]);
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)] ?? null;
  return (
    <div>
      <PetPhoto key={current ?? 'none'} pet={pet} src={current} priority fit="contain" className="aspect-[4/3] w-full rounded-[var(--ph-radius)]" alt={photos.length > 1 ? `${petPhotoAlt(pet)}, photo ${index + 1} of ${photos.length}` : undefined} />
      {photos.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Photos of ${pet.name}`}>
          {photos.map((url, position) => (
            <li key={url}>
              <button type="button" onClick={() => setIndex(position)} aria-label={`Show photo ${position + 1} of ${photos.length}`} aria-current={position === index ? 'true' : undefined} className={cx('block size-16 overflow-hidden rounded-[var(--ph-radius)] border-2 sm:size-20', position === index ? 'border-[var(--ph-brand)]' : 'border-stone-300 hover:border-stone-500')}>
                <img src={url} alt="" width={80} height={80} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Actions({ pet, compact = false }: { pet: Pet; compact?: boolean }) {
  const id = encodeURIComponent(pet.id);
  const size = compact ? 'min-h-11 flex-1 whitespace-normal px-3 text-center text-sm leading-tight' : 'w-full';
  return (
    <>
      <ButtonLink variant="primary" className={size} href={`/visit?pet=${id}`}>Meet {pet.name}</ButtonLink>
      <ButtonLink className={size} href={`/apply?type=adopt&pet=${id}`}>Apply to adopt</ButtonLink>
      {!compact && pet.fosterAvailable && <ButtonLink className={size} href={`/apply?type=foster&pet=${id}`}>Foster {pet.name}</ButtonLink>}
    </>
  );
}

function Facts({ pet }: { pet: Pet }) {
  const unknown = (value: string) => !value || value === 'Unknown';
  const rows: [string, string][] = [
    ['Sex', pet.sex],
    ['Size', pet.size],
    ['Color', pet.color],
    ['Weight', pet.weightLbs ? `${pet.weightLbs} lbs` : ''],
    ['Energy level', pet.energyLevel],
    ['Spayed or neutered', pet.spayedNeutered],
    ['Good with kids', pet.goodWithKids],
    ['Good with dogs', pet.goodWithDogs],
    ['Good with cats', pet.goodWithCats],
  ];
  const shown = rows.filter(([, value]) => !unknown(value));
  if (!shown.length) return null;
  return (
    <section aria-labelledby="good-to-know" className="mt-10">
      <h2 id="good-to-know" className="text-2xl font-semibold tracking-tight text-stone-950">Good to know</h2>
      <dl className="mt-4 grid gap-px overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-stone-300 sm:grid-cols-2 sm:[&>:last-child:nth-child(odd)]:col-span-2">
        {shown.map(([term, value]) => (
          <div key={term} className="flex items-baseline justify-between gap-4 bg-white px-4 py-3">
            <dt className="text-sm text-stone-700">{term}</dt>
            <dd className="text-right font-semibold text-stone-950">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Cost({ pet }: { pet: Pet }) {
  const fees = SHELTER.fees;
  const kind = pet.type.toLowerCase();
  const baseFee = kind === 'dog' ? fees.dog : kind === 'cat' ? fees.cat : null;
  const senior = isSenior(pet.age);
  return (
    <section aria-labelledby="costs" className="mt-10">
      <h2 id="costs" className="text-2xl font-semibold tracking-tight text-stone-950">What adoption costs and includes</h2>
      <p className="mt-3 text-base leading-7 text-stone-800">
        {senior ? <>The adoption fee for {pet.name} is <strong>{money(fees.seniorFee)}</strong> this year, for animals {fees.seniorAge} and older.</> : baseFee !== null ? <>The adoption fee for {pet.name} is <strong>{money(baseFee)}</strong>. Adopters 55 and older pay {money(fees.over55Fee)} for animals under {fees.seniorAge}.</> : <>Ask an adoption counselor about the fee for {pet.name}.</>}
      </p>
      <p className="mt-3 text-base text-stone-800">Every adoption includes:</p>
      <ul className="mt-2 grid list-disc gap-1 pl-6 text-base text-stone-800 sm:grid-cols-2">{fees.included.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="mt-3 text-base text-stone-800"><TextLink href="/adopt/process">How adoption works</TextLink></p>
    </section>
  );
}

function QuizNote({ pet }: { pet: Pet }) {
  const me = useMe();
  const signedIn = Boolean(me.data);
  const latest = useApi<LatestQuizResponse>(signedIn ? '/quiz/latest' : null, { staleSeconds: 60 });
  const match = latest.data?.result?.recommendations.find((item) => item.pet.id === pet.id);
  if (match) {
    return (
      <section aria-labelledby="quiz-fit" className="mt-8 rounded-[var(--ph-radius)] border border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="quiz-fit" className="text-lg font-semibold text-stone-950">Why {pet.name} might suit you</h2>
          <Badge tone="good">{matchStrength(match.score)} match</Badge>
        </div>
        <p className="mt-2 text-base leading-7 text-stone-900">{match.reason}</p>
        <p className="mt-2 text-sm text-stone-700">From your matching quiz. It is a suggestion, not a decision. <TextLink href="/adopt/match">Retake the quiz</TextLink></p>
      </section>
    );
  }
  return <p className="mt-6 text-base text-stone-800">Not sure {pet.name} is the right fit? <TextLink href="/adopt/match">Take the matching quiz</TextLink>.</p>;
}

function Similar({ pet }: { pet: Pet }) {
  const { data, isError } = useApi<{ pets: Pet[] }>('/pets');
  if (isError) return null;
  const rank = (size: string) => { const at = SIZE_ORDER.indexOf(size); return at < 0 ? 1.5 : at; };
  const similar = data?.pets
    .filter((other) => other.id !== pet.id && other.type.toLowerCase() === pet.type.toLowerCase())
    .sort((a, b) => Math.abs(rank(a.size) - rank(pet.size)) - Math.abs(rank(b.size) - rank(pet.size)) || b.daysInShelter - a.daysInShelter)
    .slice(0, 4);
  if (data && !similar?.length) return null;
  return (
    <section aria-labelledby="similar" className="mt-14 border-t border-stone-300 pt-10">
      <h2 id="similar" className="text-2xl font-semibold tracking-tight text-stone-950">Similar animals</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {similar ? similar.map((other) => <AnimalCard key={other.id} pet={other} />) : Array.from({ length: 4 }, (_, i) => <AnimalCardSkeleton key={i} />)}
      </div>
    </section>
  );
}

function Profile({ pet }: { pet: Pet }) {
  const fosterHome = pet.housing === 'Foster home';
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
      <a href="/adopt" className="inline-flex min-h-11 items-center gap-1 font-medium text-[var(--ph-brand-strong)] underline underline-offset-4"><ChevronLeftIcon />All animals</a>

      <header className="mt-2">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">{pet.name}</h1>
        <p className="mt-2 text-lg text-stone-800">{petFacts(pet)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><PetBadges pet={pet} /><span className="text-sm text-stone-700">{[fosterHome ? 'Lives in a foster home' : pet.housing === 'Shelter' ? 'At the shelter' : '', waitingText(pet)].filter(Boolean).join('. ')}</span></div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <Gallery pet={pet} />

          {(pet.fosterUrgent || pet.needsWalkers) && (
            <div className="mt-6 grid gap-3">
              {pet.fosterUrgent && <Notice tone="warning" title={`${pet.name} needs a foster home now`}>A foster home gives {pet.name} room to relax while the right family is found. <TextLink href={`/apply?type=foster&pet=${encodeURIComponent(pet.id)}`}>Foster {pet.name}</TextLink> or <TextLink href="/foster">learn how fostering works</TextLink>.</Notice>}
              {pet.needsWalkers && <Notice tone="info" title={`${pet.name} could use a walker`}>Can you not adopt right now? Volunteers help with walks and exercise. <TextLink href="/volunteer">See volunteer shifts</TextLink>.</Notice>}
            </div>
          )}

          <QuizNote pet={pet} />

          <section aria-labelledby="about" className="mt-10">
            <h2 id="about" className="text-2xl font-semibold tracking-tight text-stone-950">About {pet.name}</h2>
            <p className="mt-3 whitespace-pre-line text-lg leading-8 text-stone-800">{pet.summary || `${pet.name} is waiting to meet you. Plan a visit to say hello.`}</p>
            {fosterHome && <p className="mt-3 text-base leading-7 text-stone-800">{pet.name} lives with a foster family. Apply and the family will contact you within three days to arrange a meeting.</p>}
            {pet.fosterAvailable && !pet.fosterUrgent && <p className="mt-3 text-base leading-7 text-stone-800">Not ready to adopt? {pet.name} is open to foster. <TextLink href={`/apply?type=foster&pet=${encodeURIComponent(pet.id)}`}>Foster {pet.name}</TextLink></p>}
            {pet.sourceName && (
              <p className="mt-3 text-sm text-stone-700">
                Photos and details courtesy of {pet.sourceUrl ? <a href={pet.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--ph-brand-strong)] underline underline-offset-4">{pet.sourceName}<span className="sr-only"> (opens in a new tab)</span></a> : pet.sourceName}.
              </p>
            )}
          </section>

          <Facts pet={pet} />

          {pet.medicalHistory && (
            <section aria-labelledby="health" className="mt-10">
              <h2 id="health" className="text-2xl font-semibold tracking-tight text-stone-950">Health notes</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-stone-800">{pet.medicalHistory}</p>
            </section>
          )}

          <Cost pet={pet} />
        </div>

        <aside className="hidden lg:block" aria-label={`Next steps for ${pet.name}`}>
          <Card className="sticky top-6 grid gap-3">
            <p className="text-lg font-semibold text-stone-950">Ready to meet {pet.name}?</p>
            <p className="text-sm leading-6 text-stone-700">Visit first to see if you click. You can apply any time; applying does not hold an animal.</p>
            <Actions pet={pet} />
            <SaveButton pet={pet} variant="text" className="w-full" />
            <p className="text-sm text-stone-700">Open {SHELTER.hours[1].days}: {SHELTER.hours[1].open}. <TextLink href="/visit">Plan a visit</TextLink></p>
          </Card>
        </aside>
      </div>

      <Similar pet={pet} />

      <div className="sticky bottom-0 -mx-4 mt-10 flex items-stretch gap-2 border-t border-stone-300 bg-white px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden" role="group" aria-label={`Next steps for ${pet.name}`}>
        <Actions pet={pet} compact />
        <SaveButton pet={pet} className="shrink-0" />
      </div>
    </div>
  );
}

function PetPage() {
  const source = useMemo(readSource, []);
  const query = useApi<Pet>(source.path ?? null);
  const pet = source.pet ?? query.data;

  useEffect(() => {
    if (!pet) return;
    document.title = `${pet.name}, ${pet.breed || pet.type} | PawHeaven`;
    if (source.legacy) window.history.replaceState(null, '', petPath(pet));
  }, [pet, source.legacy]);

  if (pet) return <Profile pet={pet} />;
  if (source.missing) return <NotFound />;
  if (query.isError) {
    return query.error instanceof ApiRequestError && query.error.status === 404
      ? <NotFound />
      : <NotFound failed={errorMessage(query.error, 'Please check your connection and try again.')} retry={() => void query.refetch()} />;
  }
  return <ProfileSkeleton />;
}

export default function PetProfile() {
  return <Providers><ClientOnly fallback={<ProfileSkeleton />}><PetPage /></ClientOnly></Providers>;
}
