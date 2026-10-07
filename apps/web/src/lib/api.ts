function matchingWorkersDevApiBase(location: Location): string | null {
  // Worker Previews use the same Preview name for the public site and API.
  // For example, `feature-login-pawheaven-frontend…` calls
  // `feature-login-pawheaven-api…` directly.
  const match = location.hostname.match(/^(?<preview>[a-z0-9-]+-)?pawheaven-frontend(?<suffix>\.[a-z0-9-]+\.workers\.dev)$/i);
  if (!match?.groups) return null;
  return `${location.protocol}//${match.groups.preview ?? ''}pawheaven-api${match.groups.suffix}/api`;
}

/** Astro's development server continues to call the local API Worker directly. */
export const apiBase = import.meta.env.DEV
  ? (import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8787/api').replace(/\/$/, '')
  : matchingWorkersDevApiBase(window.location)
    ?? import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '')
    ?? 'https://api.pawheaven.online/api';
