import { useEffect, useId, useState } from 'react';
import { ButtonLink, cx } from '../../ui';
import { PawIcon } from '../../ui/icons';
import { groupWords, pressedGroup } from './status';
import { useShelterStatus } from './useShelterStatus';

/**
 * Tells visitors, calmly, when a kennel group is nearly full or full and what helps. Renders nothing while
 * loading, on error, and when every group is fine, so the page never jumps for a banner that is not coming.
 * `contained` adds its own page-width wrapper, for places that are not already inside one.
 */
export function StatusBanner({ contained = false, className }: { contained?: boolean; className?: string }) {
  const { status } = useShelterStatus();
  const group = pressedGroup(status);
  const headingId = useId();
  const fill = group ? Math.max(0, Math.min(100, group.percent ?? 0)) : 0;

  // Grow the meter in once; the transition class only applies when the visitor has not asked for less motion.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(fill));
    return () => window.cancelAnimationFrame(frame);
  }, [fill]);

  if (!group) return null;
  const words = groupWords(group.group);
  const nearly = group.level === 'busy';
  const usable = Math.max(0, group.kennels - group.heldBack);
  const heading = nearly ? `Our ${words.kennels} are nearly full` : `Our ${words.kennels} are full`;
  const noun = words.species === 'other' ? 'an animal' : `a ${words.species}`;

  const banner = (
    <section aria-labelledby={headingId} data-status-banner className={cx('rounded-[var(--ph-radius)] border border-amber-700 bg-amber-50 p-5 text-amber-900 shadow-sm sm:p-7', !contained && className)}>
      <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-6">
        <span aria-hidden="true" className="hidden size-14 place-items-center rounded-full bg-white text-amber-900 md:grid"><PawIcon width={28} height={28} /></span>
        <div>
          <h2 id={headingId} className="text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">{heading}</h2>
          <div
            role="meter"
            aria-label={`${words.kennels.charAt(0).toUpperCase()}${words.kennels.slice(1)} in use`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={fill}
            aria-valuetext={`${fill} percent full`}
            className="mt-3 h-4 w-full max-w-lg overflow-hidden rounded-full border border-amber-700 bg-white p-0.5"
          >
            <div className="h-full rounded-full bg-amber-700 motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out" style={{ width: `${shown}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold">
            {fill}% full{usable > 0 ? `, ${group.used} of ${usable} kennels in use` : ''}
          </p>
          <p className="mt-2 max-w-xl text-base leading-7 text-stone-900">Adopting or fostering {noun} this week makes room for the next one.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <ButtonLink variant="primary" href="/foster" className="whitespace-normal text-center">{words.foster}</ButtonLink>
          <ButtonLink href={`/adopt?species=${words.species}`} className="whitespace-normal text-center">{words.browse}</ButtonLink>
        </div>
      </div>
    </section>
  );
  return contained ? <div className={cx('mx-auto max-w-6xl px-4 pt-8 sm:px-6', className)}>{banner}</div> : banner;
}
