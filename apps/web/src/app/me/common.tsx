import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Pet } from '@pawheaven/contracts';
import { Badge, Button, Notice, Skeleton, cx } from '../../ui';

/** `blizzard-4f2a91c3`: the animal's name plus the first eight characters of its id (the public animal address). */
export function petPath(pet: Pick<Pet, 'id' | 'name'>): string {
  const name = pet.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'animal';
  return `/adopt/${name}-${pet.id.slice(0, 8)}`;
}

export const dayOnly = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown date' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Dates like "2026-11-02" are calendar days, not instants, so they are shown without time-zone shifting. */
export const calendarDay = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function StatusBadge({ status }: { status: string }) {
  const tone = ['Approved', 'Resolved', 'registered', 'booked'].includes(status) ? 'good' : ['In review', 'In progress', 'New'].includes(status) ? 'warn' : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

/** Every list says what it is and what to do when it is empty. */
export function Section({ id, title, aside, children, className }: { id?: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  const heading = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={heading} className={cx('rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={heading} className="text-xl font-semibold text-stone-950">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <li className={cx('flex flex-wrap items-start justify-between gap-3 border-t border-stone-200 py-4 first:border-t-0 first:pt-0 last:pb-0', className)}>{children}</li>
);

export const Muted = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cx('text-base leading-7 text-stone-700', className)}>{children}</p>;

export const Link = ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a className={cx('inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4 hover:text-stone-950', className)} {...props} />
);

/** A query that failed shows a plain message and a way to try again. */
export function LoadState({ query, label, skeleton = 'h-24', children }: { query: UseQueryResult<unknown>; label: string; skeleton?: string; children: ReactNode }) {
  if (query.isPending) return <Skeleton className={skeleton} />;
  if (query.isError) {
    return (
      <Notice tone="error" title={`We could not load ${label}.`}>
        <Button variant="secondary" onClick={() => void query.refetch()} className="mt-2">Try again</Button>
      </Notice>
    );
  }
  return <>{children}</>;
}

/** Runs a change, then refreshes everything the account page shows. */
export function useChange() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

/** An inline "are you sure?" that takes focus when it opens, so keyboard and screen reader users land on it. */
export function ConfirmAction({ label, srLabel, question, confirmLabel, keepLabel, busy, onConfirm, error }: { label: string; srLabel: string; question: string; confirmLabel: string; keepLabel: string; busy: boolean; onConfirm: () => void; error?: string }) {
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (asking) keepRef.current?.focus(); }, [asking]);
  if (!asking) {
    return (
      <div>
        <Button ref={openRef} variant="secondary" onClick={() => setAsking(true)}>{label}<span className="sr-only"> {srLabel}</span></Button>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
      </div>
    );
  }
  return (
    <div role="group" aria-label={question} className="w-full rounded-[var(--ph-radius)] border border-amber-700 bg-amber-50 p-3 text-amber-900">
      <p className="text-sm font-semibold">{question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button ref={keepRef} variant="secondary" onClick={() => setAsking(false)}>{keepLabel}</Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
    </div>
  );
}
