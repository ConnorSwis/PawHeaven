/**
 * Browsers use the frontend Worker's same-origin API proxy when deployed.
 * Astro's development server does not run that Worker, so local development
 * continues to call the API Worker directly.
 */
export const apiBase = import.meta.env.DEV
  ? (import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8787/api').replace(/\/$/, '')
  : '/api';
