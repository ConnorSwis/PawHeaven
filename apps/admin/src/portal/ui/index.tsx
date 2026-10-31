import * as Dialog from '@radix-ui/react-dialog';
import { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon, SortIcon } from './icons';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// --- Density -----------------------------------------------------------------------------------
type Density = 'comfortable' | 'compact';
export const DensityContext = createContext<Density>('comfortable');
export const useDensity = () => useContext(DensityContext);

// --- Buttons and badges ----------------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' };
const variants = {
  primary: 'bg-[var(--ph-brand)] text-[var(--ph-on-brand)] hover:bg-[var(--ph-brand-strong)] border border-transparent',
  secondary: 'border border-stone-400 bg-white text-stone-900 hover:bg-stone-100',
  ghost: 'border border-transparent text-stone-800 hover:bg-stone-100',
  danger: 'border border-red-800 bg-white text-red-800 hover:bg-red-800 hover:text-[var(--ph-on-brand)]',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cx('inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60', 'rounded-[var(--ph-radius)]', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm', variants[variant], className)} {...props} />;
});

type Tone = 'neutral' | 'good' | 'warn' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  good: 'bg-[var(--ph-brand-soft)] text-[var(--ph-brand-strong)]',
  warn: 'bg-[var(--ph-warning-soft)] text-[var(--ph-warning-strong)]',
  danger: 'bg-[var(--ph-danger-soft)] text-[var(--ph-danger-strong)]',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}
/** One status vocabulary for every record in the portal. */
export function statusTone(status: string): Tone {
  if (['Approved', 'Resolved', 'Available', 'registered', 'booked', 'succeeded', 'accepted', 'active', 'Open', 'Fostered', 'published'].includes(status)) return 'good';
  if (['In review', 'In progress', 'New', 'Pending', 'pending', 'awaiting_setup', 'Foster needed'].includes(status)) return 'warn';
  if (['Declined', 'failed', 'blocked', 'Blocked', 'declined'].includes(status)) return 'danger';
  return 'neutral';
}
export const StatusBadge = ({ status, label }: { status: string; label?: string }) => <Badge tone={statusTone(status)}>{label ?? status}</Badge>;

// --- Form controls ----------------------------------------------------------------------------
const control = 'block w-full rounded-[var(--ph-radius)] border border-stone-400 bg-white px-3 py-2 text-sm text-stone-950 placeholder:text-stone-500 disabled:bg-stone-100 disabled:text-stone-600';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) { return <input ref={ref} className={cx(control, className)} {...props} />; });
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) { return <textarea ref={ref} rows={rows} className={cx(control, 'resize-y', className)} {...props} />; });
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) { return <select ref={ref} className={cx(control, 'pr-8', className)} {...props} />; });

export function Field({ label, error, help, children, className }: { label: string; error?: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block text-sm font-medium text-stone-900', className)}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {help && !error && <span className="mt-1.5 block text-xs font-normal text-stone-600">{help}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-800" role="alert">{error}</span>}
    </label>
  );
}

/** Lists every problem in a form with links that move focus to the field. Pass a new `focusSignal` after each failed submit so it takes focus again. */
export function ErrorSummary({ errors, focusSignal = 0 }: { errors: { id: string; message: string }[]; focusSignal?: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (focusSignal > 0 && errors.length > 0) box.current?.focus(); }, [focusSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  if (errors.length === 0) return null;
  return (
    <div ref={box} tabIndex={-1} role="alert" className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">{errors.length === 1 ? 'There is 1 problem' : `There are ${errors.length} problems`}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {errors.map((error) => <li key={error.id}><a href={`#${error.id}`} className="underline" onClick={(event) => { event.preventDefault(); const target = document.getElementById(error.id); target?.scrollIntoView({ block: 'center' }); target?.focus(); }}>{error.message}</a></li>)}
      </ul>
    </div>
  );
}

/** A short in-page message. Use `warn` for things staff should act on. */
export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'warn' | 'danger'; title?: string; children: ReactNode }) {
  const classes = { neutral: 'border-stone-300 bg-stone-50 text-stone-800', warn: 'border-[var(--ph-warning)] bg-amber-50 text-amber-900', danger: 'border-red-300 bg-red-50 text-red-900' };
  return <div className={cx('border p-4 text-sm leading-6', classes[tone])}>{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>;
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative min-w-[12rem] flex-1 sm:max-w-xs', className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
      <Input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={cx('w-auto! py-1.5', className)}>
      <option value="">{label}: all</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
  );
}

// --- Layout pieces ------------------------------------------------------------------------------
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-950">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-700">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const Toolbar = ({ children }: { children: ReactNode }) => <div className="mt-5 flex flex-wrap items-center gap-2">{children}</div>;
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <section className={cx('rounded-[var(--ph-radius)] border border-stone-300 bg-white p-5', className)}>{children}</section>;

export function StatCard({ label, value, hint, onClick }: { label: string; value: ReactNode; hint?: string; onClick?: () => void }) {
  const body = (<><p className="text-xs font-medium uppercase tracking-wide text-stone-600">{label}</p><p className="mt-1 text-2xl font-semibold text-stone-950">{value}</p>{hint && <p className="mt-0.5 text-xs text-stone-600">{hint}</p>}</>);
  const classes = 'rounded-[var(--ph-radius)] border border-stone-300 bg-white p-4 text-left';
  return onClick ? <button type="button" onClick={onClick} className={cx(classes, 'hover:bg-stone-50')}>{body}</button> : <div className={classes}>{body}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-semibold text-stone-950">{title}</p>
      {children && <p className="max-w-md text-sm leading-6 text-stone-700">{children}</p>}
      {action}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('animate-pulse rounded-[var(--ph-radius)] bg-stone-200', className)} aria-hidden="true" />;

export function Tabs({ value, onChange, items }: { value: string; onChange: (id: string) => void; items: { id: string; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-stone-300">
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={value === item.id} onClick={() => onChange(item.id)}
          className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', value === item.id ? 'border-[var(--ph-brand)] text-stone-950' : 'border-transparent text-stone-700 hover:text-stone-950')}>
          {item.label}{item.count !== undefined && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Side panel and dialogs --------------------------------------------------------------------
export function Sheet({ open, onOpenChange, title, description, children, footer, width = 'max-w-xl' }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ph-ink-strong)_45%,transparent)]" />
        <Dialog.Content className={cx('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-stone-300 bg-white shadow-md', width)}>
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-stone-950">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'mt-0.5 text-sm text-stone-700' : 'sr-only'}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="sm" aria-label="Close panel"><CloseIcon /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, description, confirmLabel = 'Confirm', danger }: { open: boolean; onCancel: () => void; onConfirm: () => void | Promise<void>; title: string; description: ReactNode; confirmLabel?: string; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-[color-mix(in_oklab,var(--ph-ink-strong)_55%,transparent)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[56] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-stone-300 bg-white p-5 shadow-md">
          <Dialog.Title className="text-lg font-semibold text-stone-950">{title}</Dialog.Title>
          <Dialog.Description asChild><div className="mt-2 text-sm leading-6 text-stone-700">{description}</div></Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy ? 'Working…' : confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- Data table -------------------------------------------------------------------------------
export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; sort?: (row: T) => string | number; className?: string; hideBelow?: 'sm' | 'md' | 'lg' };
const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

export function DataTable<T>({ rows, columns, rowId, loading, error, onRowClick, selectedId, selection, pageSize = 25, empty, initialSort, tableClassName }: {
  rows: T[]; columns: Column<T>[]; rowId: (row: T) => string; loading?: boolean; error?: string | null; onRowClick?: (row: T) => void; selectedId?: string | null;
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void }; pageSize?: number; empty?: ReactNode; initialSort?: { key: string; dir: 'asc' | 'desc' }; /** Replaces the default minimum width when a table has few columns and should fit a phone. */ tableClassName?: string;
}) {
  const density = useDensity();
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const column = columns.find((item) => item.key === sort?.key);
    if (!column?.sort || !sort) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => { const x = column.sort!(a); const y = column.sort!(b); return (x < y ? -1 : x > y ? 1 : 0) * factor; });
  }, [rows, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const pad = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-3';

  if (error) return <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</div>;
  const allVisibleSelected = selection && visible.length > 0 && visible.every((row) => selection.selected.has(rowId(row)));

  return (
    <div className="overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white">
      <div className="overflow-x-auto">
        <table className={cx('w-full border-collapse text-sm', tableClassName ?? 'min-w-[34rem]')}>
          <thead>
            <tr className="border-b border-stone-300 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-600">
              {selection && <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select all on this page" checked={Boolean(allVisibleSelected)} onChange={(event) => { const next = new Set(selection.selected); for (const row of visible) { if (event.target.checked) next.add(rowId(row)); else next.delete(rowId(row)); } selection.onChange(next); }} /></th>}
              {columns.map((column) => (
                <th key={column.key} className={cx('px-3 py-2 font-semibold', column.hideBelow && hide[column.hideBelow], column.className)} aria-sort={sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {column.sort ? (
                    <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-stone-950" onClick={() => setSort((current) => (current?.key === column.key ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key: column.key, dir: 'asc' }))}>
                      {column.header}<SortIcon width={12} height={12} />
                    </button>
                  ) : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }, (_, index) => (
              <tr key={index} className="border-b border-stone-200"><td className={pad} colSpan={columns.length + (selection ? 1 : 0)}><Skeleton className="h-5 w-full" /></td></tr>
            ))}
            {!loading && visible.map((row) => {
              const id = rowId(row);
              return (
                <tr key={id} aria-selected={selectedId === id || undefined} tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row); } } : undefined}
                  className={cx('border-b border-stone-200 last:border-b-0', onRowClick && 'cursor-pointer hover:bg-stone-50', selectedId === id && 'bg-[var(--ph-brand-soft)]')}>
                  {selection && <td className="w-10 px-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={selection.selected.has(id)} onChange={(event) => { const next = new Set(selection.selected); if (event.target.checked) next.add(id); else next.delete(id); selection.onChange(next); }} /></td>}
                  {columns.map((column) => <td key={column.key} className={cx(pad, 'align-middle text-stone-800', column.hideBelow && hide[column.hideBelow], column.className)}>{column.cell(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && (empty ?? <EmptyState title="Nothing here yet" />)}
      {!loading && rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
          <span>{page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeftIcon width={14} height={14} /></Button>
            <span>Page {page + 1} of {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRightIcon width={14} height={14} /></Button>
          </span>
        </div>
      )}
    </div>
  );
}

/** A labelled value in a detail panel. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</dt><dd className="mt-0.5 break-words text-sm text-stone-900">{children || <span className="text-stone-500">Not provided</span>}</dd></div>;
}
