import type { ShelterStatus } from '@pawheaven/contracts';
import { apiBase } from './api';

declare global {
  interface Window { __phShelterStatus?: Promise<ShelterStatus | null> }
}

/**
 * Fetches the public shelter status once per page load. The banner (a React island) and the footer line
 * (a plain script) both call this and get the same promise. It never rejects: a failure is `null`, and
 * both places then simply show nothing.
 */
export function loadShelterStatus(): Promise<ShelterStatus | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  window.__phShelterStatus ??= fetch(`${apiBase}/public/shelter-status`, { headers: { Accept: 'application/json' } })
    .then((response) => (response.ok ? (response.json() as Promise<ShelterStatus>) : null))
    .then((body) => (body && Array.isArray(body.groups) ? body : null))
    .catch(() => null);
  return window.__phShelterStatus;
}
