/** Only same-site paths are allowed as a sign-in destination: `/me`, never `//evil.example` or `https://...`. */
export function safeNext(raw: string | null | undefined, fallback = '/me'): string {
  if (!raw || raw.length > 500) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  return raw;
}

/** The `?next=` value from the address bar, made safe. Browser only. */
export function readNext(): string {
  return safeNext(new URLSearchParams(window.location.search).get('next'));
}

/** Link between login and sign-up that keeps the destination. */
export function withNext(path: string, next: string): string {
  return next && next !== '/me' ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Tells the header the member is now signed in, then goes where they were headed. */
export function finishSignIn(next: string) {
  window.dispatchEvent(new CustomEvent('pawheaven:authchange', { detail: { signedIn: true } }));
  window.location.assign(next);
}
