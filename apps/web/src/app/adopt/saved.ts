import { useCallback, useSyncExternalStore } from 'react';

/** Animals a visitor has hearted live in this browser only (key `ph-saved`, a JSON array of animal ids). */
const KEY = 'ph-saved';
const EVENT = 'ph-saved-change';
const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cached: string[] = EMPTY;

export function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cached;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : EMPTY;
    cachedRaw = raw;
    return cached;
  } catch { return EMPTY; }
}

function write(ids: string[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* Storage blocked: the heart just will not stick. */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, onChange); };
}

export function useSaved() {
  const ids = useSyncExternalStore(subscribe, readSaved, () => EMPTY);
  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    const current = readSaved();
    write(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }, []);
  const remove = useCallback((id: string) => write(readSaved().filter((value) => value !== id)), []);
  return { ids, count: ids.length, isSaved, toggle, remove };
}
