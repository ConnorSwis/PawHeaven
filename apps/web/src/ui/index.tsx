import * as Dialog from '@radix-ui/react-dialog';
import { forwardRef, useId, useRef, type AnchorHTMLAttributes, type Ref, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { CheckIcon, CloseIcon, SearchIcon } from './icons';
import { Mascot, type MascotPose, type MascotSpecies } from './Mascot';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * The public site's shared pieces. Everything colors itself from the --ph-* theme variables, sizes
 * its tap targets for phones (44px), and keeps a visible focus ring, so every page stays consistent
 * and every theme keeps working.
 */

// --- Buttons and links -------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-[var(--ph-brand)] text-[var(--ph-on-brand)] hover:bg-[var(--ph-brand-strong)] border border-transparent shadow-[var(--ph-shadow-brand)]',
  secondary: 'border border-stone-400 bg-white text-stone-900 hover:bg-stone-100',
  ghost: 'border border-transparent text-stone-800 hover:bg-stone-100',
  danger: 'border border-red-800 bg-white text-red-800 hover:bg-red-800 hover:text-[var(--ph-on-brand)]',
};
const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ph-radius-pill)] px-5 py-2.5 text-base font-semibold transition-[color,background-color,transform,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-60';
export const buttonClass = (variant: Variant = 'secondary', className?: string) => cx(buttonBase, variants[variant], className);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(function Button({ variant = 'secondary', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClass(variant, className)} {...props} />;
});
export function ButtonLink({ variant = 'secondary', className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a className={buttonClass(variant, className)} {...props} />;
}
export const TextLink = ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a className={cx('font-medium text-[var(--ph-brand-strong)] underline underline-offset-4 hover:text-stone-950', className)} {...props} />;

// --- Badges and notices --------------------------------------------------------------------------
type Tone = 'neutral' | 'good' | 'warn' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-800',
  good: 'bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]',
  warn: 'bg-[var(--ph-warning-soft)] text-[var(--ph-warning-strong)]',
  danger: 'bg-[var(--ph-danger-soft)] text-[var(--ph-danger-strong)]',
};
export const Badge = ({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>
);

const noticeTones: Record<'info' | 'success' | 'error' | 'warning', string> = {
  info: 'border-stone-300 bg-stone-50 text-stone-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-amber-700 bg-amber-50 text-amber-900',
};
/** Errors announce themselves immediately; everything else politely. */
export function Notice({ tone = 'info', title, children, className }: { tone?: keyof typeof noticeTones; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-[var(--ph-radius-sm)] border p-4 text-sm leading-6', noticeTones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  );
}

export const Card = ({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) => (
  <Tag className={cx('rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5 shadow-sm sm:p-6', className)}>{children}</Tag>
);

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden="true" className={cx('animate-pulse rounded-[var(--ph-radius)] bg-stone-200', className)} />;

// --- Chips, notes, and sections (Soft Clay patterns) ---------------------------------------------------
const chipBase = 'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-[var(--ph-radius-pill)] border px-4 py-2 text-base font-semibold transition-colors duration-150';
/** A pill for a quick choice. A pressed chip also shows a check, so it never relies on color alone. */
export const chipClass = (active = false, className?: string) => cx(chipBase, active ? 'border-[var(--ph-brand)] bg-[var(--ph-brand)] text-[var(--ph-on-brand)] hover:bg-[var(--ph-brand-strong)]' : 'border-stone-400 bg-white text-stone-900 hover:bg-stone-100', className);

/** A filter or option that switches on and off. Always say what it is in words; the state is announced with aria-pressed. */
export const ChipToggle = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { pressed: boolean }>(function ChipToggle({ pressed, className, children, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} aria-pressed={pressed} className={chipClass(pressed, className)} {...props}>{pressed && <CheckIcon width={16} height={16} />}{children}</button>;
});
/** A chip that goes somewhere (a ready-made search). */
export const ChipLink = ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a className={chipClass(false, className)} {...props} />;

/** A pill-shaped search field with a leading icon. Put a submit button in `action` to make it a search bar. The label is read aloud and stays out of the way. */
export const SearchPill = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; action?: ReactNode; wrapperClassName?: string }>(function SearchPill({ label, action, wrapperClassName, id, className, ...props }, ref) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  return (
    <div className={cx('flex items-center gap-2 rounded-[var(--ph-radius-pill)] border border-stone-400 bg-white p-1.5 pl-4 shadow-sm has-[input:focus-visible]:outline-[length:var(--ph-focus-width)] has-[input:focus-visible]:outline-solid has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--ph-accent)]', wrapperClassName)}>
      <label htmlFor={fieldId} className="sr-only">{label}</label>
      <SearchIcon className="shrink-0 text-stone-700" />
      <input ref={ref} id={fieldId} type="search" autoComplete="off" className={cx('min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-stone-950 outline-none placeholder:text-stone-600', className)} {...props} />
      {action}
    </div>
  );
});

/** A small sticker-style card with a message, for a note in an animal's voice. Pass `href` to make the whole note a link. */
export function NoteCard({ icon, title, children, href, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      {icon && <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ph-warning-soft)] text-[var(--ph-warning-strong)]">{icon}</span>}
      <span className="min-w-0"><span className="block text-base font-bold leading-tight text-stone-950">{title}</span>{children && <span className="mt-0.5 block text-sm leading-5 text-stone-700">{children}</span>}</span>
    </>
  );
  const classes = cx('flex items-center gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-white px-3.5 py-2.5 shadow-md', className);
  return href ? <a href={href} className={cx(classes, 'ph-lift')}>{body}</a> : <div className={classes}>{body}</div>;
}

/**
 * A page section. `tone="tint"` is the rounded, tinted band; `page` sits on the page color. Alternate them down a page
 * and give each a heading (`labelledBy` is that heading's id).
 */
export function Section({ tone = 'page', labelledBy, id, className, innerClassName, children }: { tone?: 'page' | 'tint'; labelledBy?: string; id?: string; className?: string; innerClassName?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx(tone === 'tint' && 'ph-band', className)}>
      <div className={cx('mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16', innerClassName)}>{children}</div>
    </section>
  );
}

/** Heading row for a section: title, one sentence, and an optional action (usually a "See all" link) on the right. */
export function SectionHeader({ id, title, intro, action }: { id: string; title: ReactNode; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">{title}</h2>
        {intro && <p className="mt-1.5 text-base leading-7 text-stone-800">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

// --- Form controls ------------------------------------------------------------------------------
const control = 'block w-full min-h-11 rounded-[var(--ph-radius-sm)] border border-stone-500 bg-white px-3.5 py-2.5 text-base text-stone-950 placeholder:text-stone-600 disabled:bg-stone-100 disabled:text-stone-600 aria-[invalid=true]:border-red-800';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) { return <input ref={ref} className={cx(control, className)} {...props} />; });
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) { return <textarea ref={ref} rows={rows} className={cx(control, 'resize-y', className)} {...props} />; });
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) { return <select ref={ref} className={cx(control, className)} {...props} />; });

/**
 * A labelled control. Pass a function child to wire the control to its label, hint, and error:
 *   <Field label="Email" error={errors.email}>{(a) => <Input type="email" {...a} />}</Field>
 */
export function Field({ label, error, help, required, children, className }: { label: string; error?: string; help?: string; required?: boolean; children: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean }) => ReactNode; className?: string }) {
  const id = useId();
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-950">{label}{required ? <span className="font-normal text-stone-700"> (required)</span> : null}</label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {help && <p id={`${id}-help`} className="mt-1.5 text-sm text-stone-700">{help}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-red-800">{error}</p>}
    </div>
  );
}

/** A group of related choices (radios or checkboxes) with a visible legend. */
export function Fieldset({ legend, help, children, className }: { legend: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cx('border-0 p-0', className)}>
      <legend className="mb-1.5 text-sm font-semibold text-stone-950">{legend}</legend>
      {help && <p className="mb-2 text-sm text-stone-700">{help}</p>}
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

export function Choice({ type = 'checkbox', label, hint, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'checkbox' | 'radio'; label: ReactNode; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--ph-radius-sm)] border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-950 has-[:checked]:border-[var(--ph-brand)] has-[:checked]:bg-[var(--ph-brand-soft)]">
      <input type={type} className="mt-1 size-4 shrink-0" {...props} />
      <span>{label}{hint && <span className="mt-0.5 block text-sm text-stone-700">{hint}</span>}</span>
    </label>
  );
}

/** Lists every problem at the top of a form and takes focus, so keyboard and screen reader users hear it. */
export function ErrorSummary({ errors, title = 'Please fix the following' }: { errors: string[]; title?: string }) {
  if (!errors.length) return null;
  return (
    <div role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="rounded-[var(--ph-radius-sm)] border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc pl-5">{errors.map((message) => <li key={message}>{message}</li>)}</ul>
    </div>
  );
}

// --- Steps, choices, summaries, and confirmations ----------------------------------------------------------
/**
 * Progress through a flow: numbered dots joined by a line. The current dot is filled, finished steps show a check.
 * Labels sit beside the dots from `sm` up; on phones they stay for screen readers and the current step is spelled
 * out in a line underneath ("Step 2 of 4: Animals").
 */
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  const position = Math.min(Math.max(current, 0), steps.length - 1);
  return (
    <div className={className}>
      <ol className="flex items-center" aria-label="Progress">
        {steps.map((label, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          const last = index === steps.length - 1;
          return (
            <li key={label} aria-current={state === 'current' ? 'step' : undefined} className={cx('flex items-center', !last && 'flex-1')}>
              <span aria-hidden="true" className={cx('grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-150', state === 'current' ? 'border-[var(--ph-brand)] bg-[var(--ph-brand)] text-[var(--ph-on-brand)] shadow-[var(--ph-shadow-brand)]' : state === 'done' ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]' : 'border-stone-500 bg-white text-stone-800')}>
                {state === 'done' ? <CheckIcon width={16} height={16} /> : index + 1}
              </span>
              <span className={cx('sr-only sm:not-sr-only sm:ml-2 sm:whitespace-nowrap sm:text-sm', state === 'current' ? 'font-bold text-stone-950' : 'font-semibold text-stone-800')}>{label}</span>
              <span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
              {!last && <span aria-hidden="true" className={cx('mx-2 h-0.5 min-w-3 flex-1 rounded-full sm:mx-3', index < current ? 'bg-[var(--ph-brand)]' : 'bg-stone-300')} />}
            </li>
          );
        })}
      </ol>
      <p aria-hidden="true" className="mt-2 text-sm font-semibold text-stone-800 sm:hidden">Step {position + 1} of {steps.length}: {steps[position]}</p>
    </div>
  );
}

/**
 * A big tappable option (a radio, or a checkbox) for choices of five or fewer. The real input is visually hidden but
 * focusable; the card shows a check circle when chosen, so color is never the only signal. `compact` is a small
 * centered tile for short values such as a number of people.
 */
export const ChoiceCard = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'checkbox' | 'radio'; label: ReactNode; hint?: ReactNode; icon?: ReactNode; compact?: boolean; cardClassName?: string }>(function ChoiceCard({ type = 'radio', label, hint, icon, compact = false, cardClassName, ...props }, ref) {
  return (
    <label className={cx('relative flex min-h-11 cursor-pointer gap-3 rounded-[var(--ph-radius)] border border-stone-400 bg-white text-stone-950 shadow-sm transition-[color,background-color,border-color,box-shadow] duration-150 hover:bg-stone-50 has-[:checked]:border-[var(--ph-brand)] has-[:checked]:shadow-md has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-[length:var(--ph-focus-width)] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ph-accent)]', compact ? 'items-center justify-center px-3 py-2.5 text-center has-[:checked]:bg-[var(--ph-brand)] has-[:checked]:text-[var(--ph-on-brand)]' : 'items-start p-4 has-[:checked]:bg-[var(--ph-brand-soft)]', cardClassName)}>
      <input ref={ref} type={type} className="peer sr-only" {...props} />
      {icon && !compact && <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ph-warning-soft)] text-[var(--ph-warning-strong)]">{icon}</span>}
      <span className={cx('min-w-0', !compact && 'flex-1')}>
        <span className="block text-base font-bold leading-6">{label}</span>
        {hint && <span className={cx('mt-0.5 block text-sm leading-5', compact ? 'font-normal' : 'text-stone-700')}>{hint}</span>}
      </span>
      {compact
        ? <span aria-hidden="true" className="hidden peer-checked:inline-flex"><CheckIcon width={16} height={16} /></span>
        : <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-stone-500 bg-white text-transparent peer-checked:border-[var(--ph-brand)] peer-checked:bg-[var(--ph-brand)] peer-checked:text-[var(--ph-on-brand)]"><CheckIcon width={14} height={14} /></span>}
    </label>
  );
});

/**
 * An on/off setting. A real checkbox (announced as a switch) drawn as a track and thumb, with "On" or "Off" in words
 * beside it. Controlled: pass `checked` and `onChange`.
 */
export const Switch = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'checked'> & { checked: boolean; label: ReactNode; hint?: ReactNode }>(function Switch({ checked, label, hint, className, ...props }, ref) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-[var(--ph-radius-sm)] border border-stone-300 bg-white px-4 py-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-[length:var(--ph-focus-width)] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ph-accent)]', className)}>
      <span className="min-w-0"><span className="block text-base font-semibold leading-6 text-stone-950">{label}</span>{hint && <span className="mt-0.5 block text-sm leading-5 text-stone-700">{hint}</span>}</span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span aria-hidden="true" className="w-7 text-right text-sm font-bold text-stone-800">{checked ? 'On' : 'Off'}</span>
        <input ref={ref} type="checkbox" role="switch" checked={checked} className="peer sr-only" {...props} />
        <span aria-hidden="true" className="relative block h-7 w-12 rounded-full border-2 border-stone-500 bg-stone-100 transition-colors duration-150 peer-checked:border-[var(--ph-brand)] peer-checked:bg-[var(--ph-brand)] after:absolute after:left-0.5 after:top-1/2 after:size-5 after:-translate-y-1/2 after:rounded-full after:bg-stone-600 after:transition-transform after:duration-150 after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-[var(--ph-on-brand)]" />
      </span>
    </label>
  );
});

/** A ticket: main details on top, a dashed tear line, then a stub for the small print or actions. Use it for the next visit or shift. */
export function TicketCard({ children, stub, className }: { children: ReactNode; stub?: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white shadow-sm', className)}>
      <div className="p-5 sm:p-6">{children}</div>
      {stub && <div className="border-t-2 border-dashed border-stone-300 bg-stone-50 px-5 py-4 sm:px-6">{stub}</div>}
    </div>
  );
}

/**
 * The rounded "Your visit / shift / application" card: a short list of what has been chosen so far. Sticky beside the
 * steps on desktop; on phones render a second copy above the submit button. `onChange` on a row adds a Change button.
 */
export function SummaryCard({ title, rows, as: Heading = 'h2', children, className }: { title: string; rows: { label: string; value: ReactNode; onChange?: () => void }[]; as?: 'h2' | 'h3'; children?: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5 shadow-sm', className)}>
      <Heading className="text-lg font-bold text-stone-950">{title}</Heading>
      <dl className="mt-3 grid gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 border-t border-stone-200 pt-3 first:border-t-0 first:pt-0">
            <div className="min-w-0">
              <dt className="text-sm font-semibold text-stone-700">{row.label}</dt>
              <dd className="break-words text-base font-semibold text-stone-950">{row.value}</dd>
            </div>
            {row.onChange && <button type="button" onClick={row.onChange} className="-my-1.5 inline-flex min-h-11 shrink-0 items-center rounded-[var(--ph-radius-pill)] px-3 text-sm font-semibold text-[var(--ph-brand-strong)] underline underline-offset-4 hover:bg-stone-100">Change<span className="sr-only"> {row.label.toLowerCase()}</span></button>}
          </div>
        ))}
      </dl>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/**
 * The warm "it worked" screen: the celebrating mascot, one sentence, the details as children (usually a `TicketCard`),
 * what happens next, and the links. The heading takes focus through `headingRef`. Only for successes, never errors.
 */
export function Confirmation({ title, headingRef, message, species = 'dog', next, nextTitle = 'What happens next', actions, children, className }: { title: string; headingRef?: Ref<HTMLHeadingElement>; message: ReactNode; species?: MascotSpecies; next?: ReactNode[]; nextTitle?: string; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('grid gap-6', className)}>
      <div className="flex flex-col items-center rounded-[var(--ph-radius)] border border-stone-300 bg-[var(--ph-brand-soft)] px-5 py-8 text-center shadow-sm sm:px-8">
        <Mascot pose="celebrating" species={species} size={144} className="ph-enter" />
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-bold tracking-tight text-stone-950 focus:outline-none sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-xl text-lg leading-8 text-stone-800">{message}</p>
      </div>
      {children}
      {next && next.length > 0 && (
        <section className="rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-stone-950">{nextTitle}</h3>
          <ol className="mt-3 grid gap-3">
            {next.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-sm font-bold text-[var(--ph-brand-strong)]">{index + 1}</span>
                <span className="min-w-0 pt-0.5 text-base leading-7 text-stone-800">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

// --- Side panel ---------------------------------------------------------------------------------
export function Sheet({ open, onOpenChange, title, description, children, footer }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  // Remember what had focus when the sheet opened, so closing hands focus back to it (there is no Dialog.Trigger to do that).
  const opener = useRef<Element | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement;
  wasOpen.current = open;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ph-ink-strong)_50%,transparent)]" />
        <Dialog.Content onCloseAutoFocus={(event) => { if (opener.current instanceof HTMLElement && opener.current.isConnected) { event.preventDefault(); opener.current.focus(); } }} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[var(--ph-radius)] border-t border-stone-300 bg-white shadow-lg sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-l-[var(--ph-radius)] sm:rounded-tr-none sm:border-l sm:border-t-0">
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-stone-950">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'mt-0.5 text-sm text-stone-700' : 'sr-only'}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-[var(--ph-radius)] text-stone-800 hover:bg-stone-100" aria-label="Close"><CloseIcon /></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** An empty list: one sentence and one action. Pass `pose` (`sleeping` or `searching`) to add the mascot. */
export function EmptyState({ title, children, action, pose, species = 'dog' }: { title: string; children?: ReactNode; action?: ReactNode; pose?: MascotPose; species?: MascotSpecies }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {pose && <Mascot pose={pose} species={species} size={128} className="mb-1" />}
      <p className="text-lg font-bold text-stone-950">{title}</p>
      {children && <p className="max-w-md text-base leading-7 text-stone-700">{children}</p>}
      {action}
    </div>
  );
}

/** Section heading used on every page so spacing and sizes match. */
export const PageHeading = ({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) => (
  <header className="max-w-3xl">
    <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
    {intro && <p className="mt-3 text-lg leading-8 text-stone-700">{intro}</p>}
    {children}
  </header>
);

// --- Page headers, icon tiles, and accordions (Soft Clay landing pages) ---------------------------------------
/**
 * The friendly header block at the top of a landing page: an eyebrow pill, the h1 (at most one `.ph-highlight`
 * word, and none on lost-pet, donation, medical, or application pages), one sentence, then the primary action.
 * Astro pages cannot pass JSX in props, so give `title` as a string with `highlight` as the word to mark, and put the buttons
 * in `children`. `aside` is an optional picture or card shown beside the text on wide screens (and above it on phones when
 * `asideFirst` is set). `children` render under the actions.
 */
export function PageHero({ eyebrow, title, highlight, intro, actions, aside, asideFirst = false, id = 'page-title', children, className }: { eyebrow?: ReactNode; title: ReactNode; highlight?: string; intro?: ReactNode; actions?: ReactNode; aside?: ReactNode; asideFirst?: boolean; id?: string; children?: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cx('overflow-x-clip', className)}>
      <div className={cx('mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-8 sm:px-6 lg:gap-12 lg:pb-12 lg:pt-14', aside ? 'lg:grid-cols-[1.15fr_0.85fr]' : undefined)}>
        <div className={cx(aside && asideFirst ? 'order-2 lg:order-1' : undefined)}>
          {eyebrow && <p className="mb-4 inline-flex items-center gap-2 rounded-[var(--ph-radius-pill)] bg-[var(--ph-brand-soft)] px-3.5 py-1.5 text-sm font-bold text-[var(--ph-brand-strong)]"><span aria-hidden="true" className="size-2 rounded-full bg-current" />{eyebrow}</p>}
          <h1 id={id} className="max-w-2xl text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl lg:leading-[1.08]">{typeof title === 'string' && highlight && title.includes(highlight) ? <>{title.slice(0, title.indexOf(highlight))}<span className="ph-highlight">{highlight}</span>{title.slice(title.indexOf(highlight) + highlight.length)}</> : title}</h1>
          {intro && <p className="mt-4 max-w-xl text-lg leading-8 text-stone-800">{intro}</p>}
          {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
          {children}
        </div>
        {aside && <div className={cx(asideFirst ? 'order-1 lg:order-2' : undefined)}>{aside}</div>}
      </div>
    </section>
  );
}

/** A round, warm tile that holds an icon. Decorative: the words next to it carry the meaning. */
export const IconTile = ({ children, size = 'md', className }: { children: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) => (
  <span aria-hidden="true" className={cx('grid shrink-0 place-items-center rounded-full bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]', size === 'sm' ? 'size-9' : size === 'lg' ? 'size-14' : 'size-12', className)}>{children}</span>
);

/** A stack of rounded accordions. Each item is a real `<details>`, so it works with the keyboard and without scripts. */
export const Accordion = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx('grid gap-3', className)}>{children}</div>;

export function AccordionItem({ question, children, defaultOpen = false, className }: { question: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen || undefined} className={cx('group rounded-[var(--ph-radius)] border border-stone-300 bg-white shadow-sm open:shadow-md', className)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--ph-radius)] px-5 py-3 text-base font-bold text-stone-950 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-700 motion-safe:transition-transform motion-safe:duration-150 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="px-5 pb-5 text-base leading-7 text-stone-800">{children}</div>
    </details>
  );
}
