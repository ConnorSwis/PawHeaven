import type { Session, User } from '@supabase/supabase-js';
import type { AdminRole, AdminUser, ApiUser, ManagedUser } from '@pawheaven/contracts';
import { supabase, supabaseAdmin } from './supabase';

export type Identity = { user: User; accessToken: string; refreshToken: string; refreshed?: Session };

/** Everything a route handler needs; `ctx` lets a handler finish work such as email after responding. */
export type RouteContext = { request: Request; env: Env; ctx: ExecutionContext; path: string };

export type AdminContext = RouteContext & { current: Identity; role: AdminRole };

const ACCESS_COOKIE = 'ph_access';
const REFRESH_COOKIE = 'ph_refresh';

export function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([name]) => name));
}

function cookie(request: Request, name: string, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/api; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function withSession(response: Response, request: Request, session: Session): Response {
  response.headers.append('Set-Cookie', cookie(request, ACCESS_COOKIE, session.access_token, session.expires_in));
  response.headers.append('Set-Cookie', cookie(request, REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
  return response;
}

export function clearSession(response: Response, request: Request): Response {
  response.headers.append('Set-Cookie', cookie(request, ACCESS_COOKIE, '', 0));
  response.headers.append('Set-Cookie', cookie(request, REFRESH_COOKIE, '', 0));
  return response;
}

export function sessionResponse(response: Response, request: Request, current: Identity): Response {
  return current.refreshed ? withSession(response, request, current.refreshed) : response;
}

export function sessionCookies(request: Request): { access?: string; refresh?: string } {
  const cookies = parseCookies(request);
  return { access: cookies[ACCESS_COOKIE], refresh: cookies[REFRESH_COOKIE] };
}

export function isBlocked(user: User): boolean {
  const until = user.banned_until ? Date.parse(user.banned_until) : Number.NaN;
  return Number.isFinite(until) && until > Date.now();
}

export async function identity(request: Request, env: Env): Promise<Identity | null> {
  const { access, refresh } = sessionCookies(request);
  if (access) {
    const { data, error } = await supabase(env).auth.getUser(access);
    if (!error && data.user && refresh && !isBlocked(data.user)) return { user: data.user, accessToken: access, refreshToken: refresh };
  }
  if (!refresh) return null;
  const { data, error } = await supabase(env).auth.refreshSession({ refresh_token: refresh });
  if (error || !data.user || !data.session || isBlocked(data.user)) return null;
  return {
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    refreshed: data.session,
  };
}

export function apiUser(user: User): ApiUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? 'PawHeaven member',
  };
}

/**
 * Maps a stored role to the two portal roles. Accounts created before the
 * admin tier was merged into staff still carry the legacy `admin` value, which
 * is treated as `staff` until those accounts are migrated.
 */
function normalizeRole(role: unknown): AdminRole | null {
  if (role === 'superuser') return 'superuser';
  return role === 'staff' || role === 'admin' ? 'staff' : null;
}

export function adminRole(user: User): AdminRole | null {
  return normalizeRole(user.app_metadata?.role);
}

export function managedUser(user: User): ManagedUser {
  return {
    ...apiUser(user),
    role: adminRole(user) ?? 'member',
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    bannedUntil: user.banned_until ?? null,
    blocked: isBlocked(user),
  };
}

export function adminUser(user: User, role: AdminRole): AdminUser {
  return { ...apiUser(user), role };
}

/** Reads the role claim a Supabase access token carries, which row-level security uses. */
function claimedRole(accessToken: string): AdminRole | null {
  try {
    const payload = accessToken.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) return null;
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { app_metadata?: { role?: unknown } };
    return normalizeRole(claims.app_metadata?.role);
  } catch {
    return null;
  }
}

async function bootstrapSuperuser(user: User, env: Env): Promise<User> {
  const bootstrapEmail = env.BOOTSTRAP_SUPERUSER_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || user.email?.toLowerCase() !== bootstrapEmail || adminRole(user) === 'superuser') return user;
  const client = supabaseAdmin(env);
  if (!client) return user;
  const { data, error } = await client.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: 'superuser' },
  });
  if (error || !data.user) {
    console.error(JSON.stringify({ operation: 'admin.bootstrap_superuser', error: error?.message ?? 'No user returned' }));
    return user;
  }
  console.info(JSON.stringify({ operation: 'admin.bootstrap_superuser', userId: user.id }));
  return data.user;
}

/**
 * Resolves the caller's staff-level role. `role` is null for a signed-in user
 * with no staff access. The session is refreshed when the role in the user's
 * record no longer matches the role claim in their access token, so the API's
 * check and database RLS never disagree after a promotion, demotion, or
 * superuser bootstrap.
 */
export async function adminIdentity(request: Request, env: Env): Promise<{ current: Identity; role: AdminRole | null } | null> {
  const current = await identity(request, env);
  if (!current) return null;
  const originalUser = current.user;
  current.user = await bootstrapSuperuser(current.user, env);
  if (current.user !== originalUser || (adminRole(current.user) ?? null) !== claimedRole(current.accessToken)) {
    const { data, error } = await supabase(env).auth.refreshSession({ refresh_token: current.refreshToken });
    if (!error && data.user && data.session) {
      current.user = data.user;
      current.accessToken = data.session.access_token;
      current.refreshToken = data.session.refresh_token;
      current.refreshed = data.session;
    }
  }
  return { current, role: adminRole(current.user) };
}

export function mayManageUser(actorRole: AdminRole, actorId: string, target: User): boolean {
  const targetRole = adminRole(target);
  if (target.id === actorId || targetRole === 'superuser') return false;
  // Staff and superusers manage members; only a superuser manages other staff.
  if (targetRole === 'staff') return actorRole === 'superuser';
  return true;
}
