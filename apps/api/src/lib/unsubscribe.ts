import type { UnsubscribeScope } from '@pawheaven/contracts';

export type TokenPayload = { e: string; s: UnsubscribeScope };

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0));

async function hmacKey(env: Env, usage: 'sign' | 'verify'): Promise<CryptoKey | null> {
  const secret = env.UNSUBSCRIBE_SECRET || env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode(`pawheaven-unsubscribe:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** A tamper-proof token for an unsubscribe link: the address and what it unsubscribes from, signed with a server secret. */
export async function signUnsubscribeToken(env: Env, email: string, scope: UnsubscribeScope): Promise<string | null> {
  const key = await hmacKey(env, 'sign');
  if (!key) return null;
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ e: email.toLowerCase(), s: scope } satisfies TokenPayload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifyUnsubscribeToken(env: Env, token: string): Promise<TokenPayload | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const key = await hmacKey(env, 'verify');
    if (!key || !(await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), new TextEncoder().encode(payload)))) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Partial<TokenPayload>;
    if (typeof parsed.e !== 'string' || !parsed.e.includes('@') || !['newsletter', 'alerts', 'all'].includes(String(parsed.s))) return null;
    return { e: parsed.e, s: parsed.s as UnsubscribeScope };
  } catch { return null; }
}

