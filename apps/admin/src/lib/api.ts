function matchingWorkersDevApiBase(location: Location): string | null {
  const match = location.hostname.match(/^(?<preview>[a-z0-9-]+-)?pawheaven-admin(?<suffix>\.[a-z0-9-]+\.workers\.dev)$/i);
  if (!match?.groups) return null;
  return `${location.protocol}//${match.groups.preview ?? ''}pawheaven-api${match.groups.suffix}/api`;
}

export const apiBase = import.meta.env.DEV
  ? (import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8787/api').replace(/\/$/, '')
  : matchingWorkersDevApiBase(window.location)
    ?? import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '')
    ?? 'https://api.pawheaven.online/api';
