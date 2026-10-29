import { useCallback, useSyncExternalStore } from 'react';

/** The portal keeps its place in the address: #/animals?status=Available&id=<pet>. Back, refresh and shared links all work. */
function read() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  return { path: path || '/', query };
}

let snapshot = read();
const listeners = new Set<() => void>();
const sync = () => {
  const next = read();
  if (next.path === snapshot.path && next.query === snapshot.query) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};
if (typeof window !== 'undefined') window.addEventListener('hashchange', sync);

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useRoute() {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const params = new URLSearchParams(current.query);

  const navigate = useCallback((to: string) => { window.location.hash = to; }, []);
  /** Sets or clears query parameters on the current page without adding history entries for each keystroke. */
  const setParams = useCallback((changes: Record<string, string | null | undefined>, options: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(snapshot.query);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    const query = next.toString();
    const target = `#${snapshot.path}${query ? `?${query}` : ''}`;
    if (options.replace) window.history.replaceState(null, '', target); else window.location.hash = target.slice(1);
    sync();
  }, []);

  return { path: current.path, params, navigate, setParams };
}
