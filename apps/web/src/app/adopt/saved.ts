import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { SavedPetsResponse } from '@pawheaven/contracts';
import { api, errorMessage, useMe } from '../../lib/fetch';
import { useToast } from '../../ui/toast';

/**
 * Hearted animals.
 *
 * Guests: a JSON array of animal ids in this browser under `ph-saved`. Nothing else changed for them.
 *
 * Signed in: the account list is the source of truth (`/me/saved`). A copy is kept in this browser under
 * `ph-saved-account` (`{ user, ids }`) so hearts paint instantly and every open page and tab stays in step through
 * the same events the guest list uses. Hearts a visitor made before signing in are merged into the account once,
 * then removed from the guest list, so an animal they later unheart is not merged back in.
 */
const GUEST_KEY = 'ph-saved';
const ACCOUNT_KEY = 'ph-saved-account';
const EVENT = 'ph-saved-change';
const EMPTY: string[] = [];
type AccountCache = { user: string; ids: string[] };

function cachedReader<T>(key: string, parse: (raw: unknown) => T, empty: T): () => T {
  let cachedRaw: string | null = null;
  let cached = empty;
  return () => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === cachedRaw) return cached;
      cached = raw ? parse(JSON.parse(raw)) : empty;
      cachedRaw = raw;
      return cached;
    } catch { return empty; }
  };
}
const idList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : EMPTY);

export const readSaved = cachedReader<string[]>(GUEST_KEY, idList, EMPTY);
const readAccount = cachedReader<AccountCache | null>(ACCOUNT_KEY, (value) => {
  const entry = value as Partial<AccountCache> | null;
  return entry && typeof entry.user === 'string' ? { user: entry.user, ids: idList(entry.ids) } : null;
}, null);

function store(key: string, value: unknown) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage blocked: the heart just will not stick on this device. */ }
  window.dispatchEvent(new Event(EVENT));
}
const writeGuest = (ids: string[]) => store(GUEST_KEY, ids);
const writeAccount = (user: string, ids: string[]) => store(ACCOUNT_KEY, { user, ids } satisfies AccountCache);

/** Call when someone signs out, so the next person on this device does not see their account's hearts. */
export const forgetAccountSaved = () => { if (readAccount()) store(ACCOUNT_KEY, null); };

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === GUEST_KEY || event.key === ACCOUNT_KEY || event.key === null) onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, onChange); };
}

// One sync per page load per account: load the account list, and merge any hearts made while signed out.
const syncing = new Map<string, Promise<void>>();
async function syncAccount(user: string, announce: (text: string) => void) {
  const account = await api<SavedPetsResponse>('/me/saved');
  const local = readSaved();
  const fresh = local.filter((id) => !account.petIds.includes(id));
  if (!fresh.length) {
    writeAccount(user, account.petIds);
    if (local.length) writeGuest(readSaved().filter((id) => !local.includes(id)));
    return;
  }
  const merged = await api<SavedPetsResponse>('/me/saved', { method: 'POST', json: { petIds: fresh.slice(0, 100) } });
  writeAccount(user, merged.petIds);
  writeGuest(readSaved().filter((id) => !local.includes(id)));
  const added = fresh.filter((id) => merged.petIds.includes(id)).length;
  if (added) announce(`We saved your ${added} ${added === 1 ? 'heart' : 'hearts'} to your account.`);
}

let inFlight = 0;

export function useSaved() {
  const toast = useToast();
  const me = useMe();
  const guestIds = useSyncExternalStore(subscribe, readSaved, () => EMPTY);
  const account = useSyncExternalStore(subscribe, readAccount, () => null);
  const user = me.data?.id ?? null;
  // While we are still finding out who this is, trust a copy of the account list if one is here.
  const useAccount = user ? true : me.isPending && account !== null;
  const ids = useAccount ? (account && (!user || account.user === user) ? account.ids : EMPTY) : guestIds;

  useEffect(() => {
    if (me.isPending) return;
    if (!user) { forgetAccountSaved(); return; }
    if (syncing.has(user)) return;
    syncing.set(user, syncAccount(user, toast.success).catch(() => { syncing.delete(user); }));
  }, [me.isPending, user, toast.success]);

  const change = useCallback((target: string[], saved: boolean) => {
    if (!target.length) return;
    if (!user) {
      const current = readSaved();
      writeGuest(saved ? [...current, ...target.filter((id) => !current.includes(id))] : current.filter((id) => !target.includes(id)));
      return;
    }
    const apply = (list: string[], on: boolean, only: string[]) => (on ? [...only.filter((id) => !list.includes(id)), ...list] : list.filter((id) => !only.includes(id)));
    const base = () => (readAccount()?.user === user ? readAccount()?.ids ?? EMPTY : EMPTY);
    writeAccount(user, apply(base(), saved, target));
    inFlight += target.length;
    void Promise.all(target.map(async (id) => {
      try {
        const response = await api<SavedPetsResponse>(`/me/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' });
        inFlight -= 1;
        if (inFlight === 0) writeAccount(user, response.petIds);
      } catch (error) {
        inFlight -= 1;
        writeAccount(user, apply(base(), !saved, [id]));
        toast.error(errorMessage(error, saved ? 'We could not save that animal to your account. Please try again.' : 'We could not remove that animal from your account. Please try again.'));
      }
    }));
  }, [user, toast.error]);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => change([id], !ids.includes(id)), [change, ids]);
  const remove = useCallback((target: string | string[]) => change(Array.isArray(target) ? target : [target], false), [change]);
  return { ids, count: ids.length, isSaved, toggle, remove, signedIn: Boolean(user) };
}
