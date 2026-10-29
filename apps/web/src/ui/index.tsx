import * as Dialog from '@radix-ui/react-dialog';
import { forwardRef, useId, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { CheckIcon, CloseIcon } from './icons';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * The public site's shared pieces. Everything colors itself from the --ph-* theme variables, sizes
 * its tap targets for phones (44px), and keeps a visible focus ring, so every page stays consistent
 * and every theme keeps working.
 */

// --- Buttons and links -------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-[var(--ph-brand)] text-[var(--ph-on-brand)] hover:bg-[var(--ph-brand-strong)] border border-transparent',
  secondary: 'border border-stone-400 bg-white text-stone-900 hover:bg-stone-100',
  ghost: 'border border-transparent text-stone-800 hover:bg-stone-100',
  danger: 'border border-red-800 bg-white text-red-800 hover:bg-red-800 hover:text-[var(--ph-on-brand)]',
};
const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ph-radius)] px-5 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
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
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-[var(--ph-radius)] border p-4 text-sm leading-6', noticeTones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  );
}

export const Card = ({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) => (
  <Tag className={cx('rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5 sm:p-6', className)}>{children}</Tag>
);

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden="true" className={cx('animate-pulse rounded-[var(--ph-radius)] bg-stone-200', className)} />;

// --- Form controls ------------------------------------------------------------------------------
const control = 'block w-full min-h-11 rounded-[var(--ph-radius)] border border-stone-500 bg-white px-3.5 py-2.5 text-base text-stone-950 placeholder:text-stone-600 disabled:bg-stone-100 disabled:text-stone-600 aria-[invalid=true]:border-red-800';
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
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--ph-radius)] border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-950 has-[:checked]:border-[var(--ph-brand)] has-[:checked]:bg-[var(--ph-brand-soft)]">
      <input type={type} className="mt-1 size-4 shrink-0" {...props} />
      <span>{label}{hint && <span className="mt-0.5 block text-sm text-stone-700">{hint}</span>}</span>
    </label>
  );
}

/** Lists every problem at the top of a form and takes focus, so keyboard and screen reader users hear it. */
export function ErrorSummary({ errors, title = 'Please fix the following' }: { errors: string[]; title?: string }) {
  if (!errors.length) return null;
  return (
    <div role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="rounded-[var(--ph-radius)] border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc pl-5">{errors.map((message) => <li key={message}>{message}</li>)}</ul>
    </div>
  );
}

// --- Steps ---------------------------------------------------------------------------------------
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-full px-3 py-1 font-medium', state === 'current' ? 'bg-[var(--ph-brand)] text-[var(--ph-on-brand)]' : state === 'done' ? 'bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]' : 'bg-stone-100 text-stone-700')}>
            {state === 'done' ? <CheckIcon width={14} height={14} /> : <span aria-hidden="true">{index + 1}</span>}
            <span>{label}</span><span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

// --- Side panel ---------------------------------------------------------------------------------
export function Sheet({ open, onOpenChange, title, description, children, footer }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ph-ink-strong)_50%,transparent)]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col border-t border-stone-300 bg-white shadow-md sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-lg sm:border-l sm:border-t-0">
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

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-stone-950">{title}</p>
      {children && <p className="max-w-md text-base leading-7 text-stone-700">{children}</p>}
      {action}
    </div>
  );
}

/** Section heading used on every page so spacing and sizes match. */
export const PageHeading = ({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) => (
  <header className="max-w-3xl">
    <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
    {intro && <p className="mt-3 text-lg leading-8 text-stone-700">{intro}</p>}
    {children}
  </header>
);
