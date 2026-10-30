import { useState, type ReactNode } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { Badge, cx } from '../../ui';
import { HeartFilledIcon, HeartIcon, PawIcon } from '../../ui/icons';
import { isSenior } from './age';
import { useSaved } from './saved';
import { petPath } from './slug';
import { helpLabel } from '../status/help';

/** Short facts for one line: "Labrador mix · 2 years · Male · Large". */
export function petFacts(pet: Pet): string {
  return [pet.breed || pet.type, pet.age, pet.sex, pet.size].filter(Boolean).join(' · ');
}

export const petPhotoAlt = (pet: Pet) => `${pet.name}, ${pet.breed || pet.type}`;

export function waitingText(pet: Pet): string {
  if (pet.daysInShelter < 7) return 'New this week';
  if (pet.daysInShelter < 60) return `Here ${pet.daysInShelter} days`;
  const months = Math.floor(pet.daysInShelter / 30);
  return `Here ${months} months`;
}

/** Photo with a fixed shape so a grid never jumps; falls back to a paw when there is no picture or it fails to load. */
export function PetPhoto({ pet, src, className, priority = false, alt, fit = 'cover' }: { pet: Pet; src?: string | null; className?: string; priority?: boolean; alt?: string; fit?: 'cover' | 'contain' }) {
  const [failed, setFailed] = useState(false);
  const url = src === undefined ? pet.imageUrl : src;
  if (!url || failed) {
    return (
      <div className={cx('flex items-center justify-center gap-2 bg-stone-200 text-stone-700', className)} role="img" aria-label={`No photo of ${pet.name} yet`}>
        <PawIcon width={28} height={28} />
        <span className="text-sm font-medium">Photo coming soon</span>
      </div>
    );
  }
  return <img src={url} alt={alt ?? petPhotoAlt(pet)} width={640} height={480} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)} className={cx('bg-stone-200', fit === 'contain' ? 'object-contain' : 'object-cover', className)} />;
}

export function SaveButton({ pet, variant = 'icon', className }: { pet: Pet; variant?: 'icon' | 'text'; className?: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(pet.id);
  const Icon = saved ? HeartFilledIcon : HeartIcon;
  if (variant === 'text') {
    return (
      <button type="button" aria-pressed={saved} onClick={() => toggle(pet.id)} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--ph-radius)] border px-5 py-2.5 text-base font-semibold transition-colors', saved ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]' : 'border-stone-400 bg-white text-stone-900 hover:bg-stone-100', className)}>
        <Icon /> {saved ? 'Saved' : 'Save'}<span className="sr-only"> {pet.name}</span>
      </button>
    );
  }
  return (
    <button type="button" aria-pressed={saved} aria-label={`Save ${pet.name}`} title={saved ? `Saved. Remove ${pet.name} from your saved animals` : `Save ${pet.name}`} onClick={() => toggle(pet.id)} className={cx('z-10 grid size-11 place-items-center rounded-full border border-stone-300 bg-white text-stone-900 shadow-sm hover:bg-stone-100', saved && 'text-[var(--ph-danger)]', className)}>
      <Icon />
    </button>
  );
}

/** The badges a visitor cares about, most urgent first. */
export function PetBadges({ pet }: { pet: Pet }) {
  return (
    <>
      {helpLabel(pet) && <Badge tone="warn">{helpLabel(pet)}</Badge>}
      {pet.fosterUrgent && <Badge tone="danger">Foster needed now</Badge>}
      {isSenior(pet.age) && <Badge tone="neutral">Senior</Badge>}
      {pet.goodWithKids === 'Yes' && <Badge tone="good">Good with kids</Badge>}
      {pet.needsWalkers && <Badge tone="warn">Needs a walker</Badge>}
      {pet.fosterAvailable && !pet.fosterUrgent && <Badge tone="neutral">Open to foster</Badge>}
    </>
  );
}

export function AnimalCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white">
      <div className="aspect-[4/3] animate-pulse bg-stone-200" />
      <div className="space-y-2 p-4"><div className="h-5 w-1/2 animate-pulse bg-stone-200" /><div className="h-4 w-4/5 animate-pulse bg-stone-200" /><div className="h-6 w-2/3 animate-pulse bg-stone-200" /></div>
    </div>
  );
}

/** One animal as a photo card. The whole card opens the animal's page; the heart saves it. */
export function AnimalCard({ pet, priority = false, children }: { pet: Pet; priority?: boolean; children?: ReactNode }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="relative">
        <PetPhoto pet={pet} priority={priority} className="aspect-[4/3] w-full" />
        <SaveButton pet={pet} className="absolute right-2 top-2" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-xl font-semibold leading-tight text-stone-950">
          <a href={petPath(pet)} className="after:absolute after:inset-0 hover:underline hover:underline-offset-4">{pet.name}</a>
        </h3>
        <p className="text-sm leading-5 text-stone-800">{petFacts(pet)}</p>
        <div className="flex flex-wrap gap-1.5"><PetBadges pet={pet} /></div>
        <p className="mt-auto pt-1 text-sm text-stone-700">{waitingText(pet)}</p>
        {children}
      </div>
    </article>
  );
}
