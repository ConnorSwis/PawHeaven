import { useCallback, useSyncExternalStore } from 'react';

/**
 * Animals saved on this device: a JSON array of animal ids under `ph-saved`, written by the Adopt pages.
 * Uses the same change event the Adopt pages send, so every open page stays in step.
 */
const KEY = 'ph-saved';
const EVENT = 'ph-saved-change';
const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cached: string[] = EMPTY;

function read(): string[] {
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
  try { window.localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* Storage blocked: the change will not stick. */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, onChange); };
}

export function useSavedIds() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  const remove = useCallback((remaining: string[]) => write(read().filter((id) => !remaining.includes(id))), []);
  return { ids, remove };
}
