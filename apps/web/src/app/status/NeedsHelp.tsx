import type { ReactNode } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { SectionHeader } from '../../ui';
import { AnimalCard } from '../adopt/AnimalCard';
import { needsHelpMost } from './help';

/**
 * A short row of the animals staff flagged as needing help most. Renders nothing when no one is flagged,
 * so it never leaves an empty heading behind. `action` is the "see all" control.
 */
export function NeedsHelpRow({ pets, id, action, className = 'mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16' }: { pets: Pet[]; id: string; action?: ReactNode; className?: string }) {
  const picks = needsHelpMost(pets);
  if (!picks.length) return null;
  return (
    <section className={className} aria-labelledby={id}>
      <SectionHeader id={id} title="Needs help most" intro="Staff picked these animals because a home, a foster, or a little extra care would help them most right now." action={action} />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{picks.map((pet) => <AnimalCard key={pet.id} pet={pet} />)}</div>
    </section>
  );
}
