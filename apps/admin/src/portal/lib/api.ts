import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiRequestError, apiRequest } from '@pawheaven/contracts/ui';
import { apiBase } from '../../lib/api';

export { ApiRequestError };

/** Calls the staff API with the session cookie. A signed-out session sends the browser to the login page. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  try {
    return await apiRequest<T>(apiBase, path, init);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) window.location.assign('/login');
    throw error;
  }
}

export const errorMessage = (error: unknown, fallback = 'That did not work. Please try again.') => (error instanceof Error && error.message ? error.message : fallback);

/** Fetches a staff endpoint and caches it under the path. */
export function useApi<T>(path: string, options: { enabled?: boolean; refetchSeconds?: number } = {}) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchSeconds ? options.refetchSeconds * 1000 : false,
  });
}

/** Refreshes cached lists after a change. Pass path prefixes such as "/admin/pets". */
export function useRefresh() {
  const client = useQueryClient();
  return (...prefixes: string[]) => Promise.all(prefixes.map((prefix) => client.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith(prefix) })));
}

export type { QueryKey };
