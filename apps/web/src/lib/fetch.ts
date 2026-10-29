import { useQuery } from '@tanstack/react-query';
import type { ApiUser } from '@pawheaven/contracts';
import { ApiRequestError, apiRequest } from '@pawheaven/contracts/ui';
import { apiBase } from './api';

export { ApiRequestError };

/** Calls the API with the session cookie. Throws ApiRequestError with the server's own message. */
export const api = <T,>(path: string, init: RequestInit & { json?: unknown } = {}) => apiRequest<T>(apiBase, path, init);
export const errorMessage = (error: unknown, fallback = 'That did not work. Please try again.') => (error instanceof Error && error.message ? error.message : fallback);

/** The data a page was served with. The Worker inlines it so the first paint has content; null in `astro dev`. */
export function inlineData<T>(): T | null {
  try {
    const node = document.getElementById('ph-data');
    return node?.textContent ? (JSON.parse(node.textContent) as T) : null;
  } catch { return null; }
}

export function useApi<T>(path: string | null, options: { initialData?: T; staleSeconds?: number } = {}) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api<T>(path as string), enabled: Boolean(path), initialData: options.initialData, staleTime: (options.staleSeconds ?? 30) * 1000 });
}

/** The signed-in member, or null when signed out. Never throws, so pages can render for guests. */
export function useMe() {
  return useQuery<ApiUser | null>({
    queryKey: ['/auth/me'],
    staleTime: 60_000,
    queryFn: async () => {
      try { return (await api<{ user: ApiUser }>('/auth/me')).user; } catch (error) { if (error instanceof ApiRequestError && error.status === 401) return null; throw error; }
    },
  });
}

/** Sends a guest to sign in and brings them back to this exact page afterwards. */
export const loginUrl = (next = `${window.location.pathname}${window.location.search}`) => `/login?next=${encodeURIComponent(next)}`;
