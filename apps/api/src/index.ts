import { createClient, type Session, type User } from '@supabase/supabase-js';
import { matchesPetSearch, type AdminPetListResponse, type AdminRole, type AdminUser, type ApiUser, type Pet, type PetInput, type PetStatus } from '@pawheaven/contracts';

type DatabasePet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_label: string;
  intake_date: string;
  tags: string[];
  status: PetStatus;
  summary: string;
  image_path: string | null;
};

type Identity = { user: User; accessToken: string; refreshToken: string; refreshed?: Session };
type ApiResponse = Response;
const ACCESS_COOKIE = 'ph_access';
const REFRESH_COOKIE = 'ph_refresh';
const PET_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_PET_IMAGE_BYTES = 5 * 1024 * 1024;

function configurationError(env: Env): string | null {
  // Wrangler does not include values from the `previews` block in generated
  // types, so these must remain runtime values rather than literal unions.
  const deploymentTarget = String(env.DEPLOYMENT_TARGET);
  const supabaseUrl = String(env.SUPABASE_URL);
  const supabaseKey = String(env.SUPABASE_KEY);

  if (deploymentTarget === 'local') {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) return 'Local API development must use the local Supabase URL.';
    } catch {
      return 'Local API development has an invalid Supabase URL.';
    }
    return supabaseKey === 'local-publishable-key-not-configured'
      ? 'Run npm run db:start, then npm run db:configure-api before starting the local API.'
      : null;
  }

  if (deploymentTarget === 'preview'
    && (supabaseUrl === 'https://preview-supabase-not-configured.invalid'
      || supabaseKey === 'preview-publishable-key-not-configured')) {
    return 'This Preview has no separate Supabase project configured. It will not use production data.';
  }

  return null;
}

function supabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/** Uses the caller's JWT, so every query remains subject to database and Storage RLS. */
function userSupabase(env: Env, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** This client is only used for server-only invitation administration and its audit record. */
function supabaseAdmin(env: Env) {
  if (!env.ADMIN_SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.ADMIN_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function respond(body: unknown, status = 200): ApiResponse {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(message: string, status: number): ApiResponse {
  return respond({ message }, status);
}

function isAllowedWorkersDevApp(origin: string, env: Env): boolean {
  try {
    const url = new URL(origin);
    // This admits this account's production frontend and its Cloudflare-issued
    // Preview hosts, but not arbitrary workers.dev origins.
    const workersDevSubdomain = env.WORKERS_DEV_SUBDOMAIN.toLowerCase();
    const appHost = 'pawheaven-(?:frontend|admin)';
    return url.protocol === 'https:'
      && !url.port
      && new RegExp(`^(?:[a-z0-9-]+-)?${appHost}\\.${workersDevSubdomain.replace('.', '\\.')}$`, 'i').test(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | null, env: Env): origin is string {
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.split(',').map((entry) => entry.trim()).includes(origin)
    || isAllowedWorkersDevApp(origin, env);
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function authFailure(action: 'login' | 'register', error: { message: string; status?: number }): ApiResponse {
  console.error(JSON.stringify({ operation: `auth.${action}`, error: error.message }));
  if (error.status === 429) return errorResponse('Too many attempts. Please wait a few minutes before trying again.', 429);
  if (error.status && error.status >= 500) return errorResponse('The account service is temporarily unavailable. Please try again in a few minutes.', 503);
  if (action === 'login') return errorResponse('We could not log you in. Check your email and password, and confirm your email if you recently registered.', 401);
  if (/signups? (are )?(disabled|not allowed)/i.test(error.message)) return errorResponse('Online account creation is not available right now. Please contact the shelter for help.', 403);
  return errorResponse('We could not create an account with those details. If you already have an account, try logging in.', 400);
}

function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([name]) => name));
}

function cookie(request: Request, name: string, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/api; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function withSession(response: Response, request: Request, session: Session): Response {
  response.headers.append('Set-Cookie', cookie(request, ACCESS_COOKIE, session.access_token, session.expires_in));
  response.headers.append('Set-Cookie', cookie(request, REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
  return response;
}

function clearSession(response: Response, request: Request): Response {
  response.headers.append('Set-Cookie', cookie(request, ACCESS_COOKIE, '', 0));
  response.headers.append('Set-Cookie', cookie(request, REFRESH_COOKIE, '', 0));
  return response;
}

async function identity(request: Request, env: Env): Promise<Identity | null> {
  const cookies = parseCookies(request);
  const access = cookies[ACCESS_COOKIE];
  const refresh = cookies[REFRESH_COOKIE];
  if (access) {
    const { data, error } = await supabase(env).auth.getUser(access);
    if (!error && data.user && refresh) return { user: data.user, accessToken: access, refreshToken: refresh };
  }
  if (!refresh) return null;
  const { data, error } = await supabase(env).auth.refreshSession({ refresh_token: refresh });
  if (error || !data.user || !data.session) return null;
  return {
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    refreshed: data.session,
  };
}

function apiUser(user: User): ApiUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? 'PawHeaven member',
  };
}

function adminRole(user: User): AdminRole | null {
  const role = user.app_metadata?.role;
  return role === 'admin' || role === 'superuser' ? role : null;
}

function adminUser(user: User, role: AdminRole): AdminUser {
  return { ...apiUser(user), role };
}

function daysInShelter(date: string): number {
  const start = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - start) / 86_400_000));
}

function petForClient(row: DatabasePet, env: Env): Pet {
  return {
    id: row.id,
    name: row.name,
    type: row.species,
    breed: row.breed,
    age: row.age_label,
    intakeDate: row.intake_date,
    daysInShelter: daysInShelter(row.intake_date),
    tags: row.tags,
    status: row.status,
    summary: row.summary,
    imageUrl: row.image_path ? supabase(env).storage.from('pet-images').getPublicUrl(row.image_path).data.publicUrl : null,
  };
}

function petInput(body: unknown): { value: PetInput } | { message: string } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? input[key].trim() : '';
  const name = text('name');
  const type = text('type');
  const breed = text('breed');
  const age = text('age');
  const intakeDate = text('intakeDate');
  const summary = text('summary');
  const status = input?.status;
  const tags = Array.isArray(input?.tags)
    ? [...new Set(input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))]
    : [];
  const intakeTime = /^\d{4}-\d{2}-\d{2}$/.test(intakeDate) ? Date.parse(`${intakeDate}T00:00:00Z`) : Number.NaN;

  if (!name || !type || !breed || !age || !summary) return { message: 'Complete every pet detail before saving.' };
  if (name.length > 100 || type.length > 60 || breed.length > 100 || age.length > 60 || summary.length > 2000) return { message: 'One or more pet details are too long.' };
  if (!Number.isFinite(intakeTime) || new Date(intakeTime).toISOString().slice(0, 10) !== intakeDate || intakeDate > new Date().toISOString().slice(0, 10)) return { message: 'Enter an intake date that is today or earlier.' };
  if (tags.length > 20 || tags.some((tag) => tag.length > 40)) return { message: 'Use no more than 20 tags, with 40 characters each.' };
  if (status !== 'Available' && status !== 'Pending' && status !== 'Adopted') return { message: 'Choose a valid availability status.' };
  return { value: { name, type, breed, age, intakeDate, tags, status, summary } };
}

function petRow(input: PetInput) {
  return {
    name: input.name,
    species: input.type,
    breed: input.breed,
    age_label: input.age,
    intake_date: input.intakeDate,
    tags: input.tags,
    status: input.status,
    summary: input.summary,
  };
}

async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function jsonBody(request: Request): Promise<unknown | null> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) return null;
  const bytes = await readLimited(request, 16_384);
  if (!bytes) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

function databaseError(operation: string, error: { message: string }): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message }));
  return errorResponse('The shelter database is unavailable. Please try again.', 503);
}

function sessionResponse(response: Response, request: Request, current: Identity): Response {
  return current.refreshed ? withSession(response, request, current.refreshed) : response;
}

async function bootstrapSuperuser(user: User, env: Env): Promise<User> {
  const bootstrapEmail = env.BOOTSTRAP_SUPERUSER_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || user.email?.toLowerCase() !== bootstrapEmail || adminRole(user)) return user;
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

async function adminIdentity(request: Request, env: Env): Promise<{ current: Identity; role: AdminRole } | null> {
  const current = await identity(request, env);
  if (!current) return null;
  current.user = await bootstrapSuperuser(current.user, env);
  const role = adminRole(current.user);
  return role ? { current, role } : null;
}

async function authRoutes(request: Request, env: Env, path: string): Promise<ApiResponse> {
  if (path === '/auth/register' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!name || name.length > 100 || !validEmail(email) || typeof password !== 'string' || password.length < 8 || password.length > 1024) return errorResponse('Enter a name, valid email, and password between 8 and 1,024 characters.', 400);
    const { data, error } = await supabase(env).auth.signUp({ email, password, options: { data: { name } } });
    if (error) return authFailure('register', error);
    if (!data.user) return errorResponse('The account service returned an unexpected response. Please try again in a few minutes.', 503);
    if (!data.session) return respond({ message: 'If the address can be used for an account, check its inbox for the next steps before logging in.', requiresEmailConfirmation: true }, 202);
    return withSession(respond({ user: apiUser(data.user) }, 201), request, data.session);
  }
  if (path === '/auth/login' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!validEmail(email) || typeof password !== 'string' || password.length === 0 || password.length > 1024) return errorResponse('Enter a valid email address and password.', 400);
    const { data, error } = await supabase(env).auth.signInWithPassword({ email, password });
    if (error) return authFailure('login', error);
    if (!data.session || !data.user) return errorResponse('The account service returned an unexpected response. Please try again in a few minutes.', 503);
    return withSession(respond({ user: apiUser(data.user) }), request, data.session);
  }
  if (path === '/auth/exchange' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!accessToken || accessToken.length > 16_384 || !refreshToken || refreshToken.length > 16_384) return errorResponse('The invitation link is incomplete or expired. Request a new invitation.', 400);
    const { data, error } = await supabase(env).auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error || !data.user || !data.session) return errorResponse('The invitation link is invalid or expired. Request a new invitation.', 401);
    return withSession(respond({ user: apiUser(data.user) }), request, data.session);
  }
  if (path === '/auth/password' && request.method === 'POST') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Your session has expired. Use your invitation link again.', 401), request);
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const password = body?.password;
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) return errorResponse('Choose a password between 8 and 1,024 characters.', 400);
    const client = supabase(env);
    const { error: sessionError } = await client.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    if (sessionError) return clearSession(errorResponse('Your session has expired. Use your invitation link again.', 401), request);
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      console.error(JSON.stringify({ operation: 'auth.password', error: error.message }));
      return errorResponse('We could not save that password. Please try again.', 503);
    }
    return sessionResponse(respond({ ok: true }), request, current);
  }
  if (path === '/auth/me' && request.method === 'GET') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Not signed in.', 401), request);
    const response = respond({ user: apiUser(current.user) });
    return current.refreshed ? withSession(response, request, current.refreshed) : response;
  }
  if (path === '/auth/logout' && request.method === 'POST') {
    const cookies = parseCookies(request);
    if (cookies[ACCESS_COOKIE] && cookies[REFRESH_COOKIE]) {
      const client = supabase(env);
      const { error } = await client.auth.setSession({ access_token: cookies[ACCESS_COOKIE], refresh_token: cookies[REFRESH_COOKIE] });
      if (!error) await client.auth.signOut({ scope: 'local' });
    }
    return clearSession(respond({ ok: true }), request);
  }
  return errorResponse('Not found.', 404);
}

async function adminRoutes(request: Request, env: Env, path: string): Promise<ApiResponse> {
  const authorized = await adminIdentity(request, env);
  if (!authorized) {
    const signedIn = await identity(request, env);
    return signedIn
      ? sessionResponse(errorResponse('This account does not have administrator access.', 403), request, signedIn)
      : clearSession(errorResponse('Not signed in.', 401), request);
  }
  const { current, role } = authorized;
  if (path === '/admin/me' && request.method === 'GET') return sessionResponse(respond({ user: adminUser(current.user, role) }), request, current);
  const client = userSupabase(env, current.accessToken);
  if (path === '/admin/pets' && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').order('name', { ascending: true }).limit(500);
    if (error) return sessionResponse(databaseError('admin.pets.list', error), request, current);
    const payload: AdminPetListResponse = { pets: (data as DatabasePet[]).map((pet) => petForClient(pet, env)) };
    return sessionResponse(respond(payload), request, current);
  }
  if (path === '/admin/pets' && request.method === 'POST') {
    const body = await jsonBody(request);
    const parsed = petInput(body);
    if ('message' in parsed) return sessionResponse(errorResponse(parsed.message, 400), request, current);
    const { data, error } = await client.from('pets').insert(petRow(parsed.value)).select('*').single();
    if (error) return sessionResponse(databaseError('admin.pets.create', error), request, current);
    return sessionResponse(respond(petForClient(data as DatabasePet, env), 201), request, current);
  }
  const petMatch = path.match(/^\/admin\/pets\/([0-9a-f-]{36})$/i);
  if (petMatch && request.method === 'PUT') {
    const body = await jsonBody(request);
    const parsed = petInput(body);
    if ('message' in parsed) return sessionResponse(errorResponse(parsed.message, 400), request, current);
    const { data, error } = await client.from('pets').update(petRow(parsed.value)).eq('id', petMatch[1]).select('*').maybeSingle();
    if (error) return sessionResponse(databaseError('admin.pets.update', error), request, current);
    if (!data) return sessionResponse(errorResponse('Pet not found.', 404), request, current);
    return sessionResponse(respond(petForClient(data as DatabasePet, env)), request, current);
  }
  const imageMatch = path.match(/^\/admin\/pets\/([0-9a-f-]{36})\/image$/i);
  if (imageMatch && request.method === 'POST') {
    if (!request.headers.get('Content-Type')?.includes('multipart/form-data') || Number(request.headers.get('Content-Length') ?? 0) > MAX_PET_IMAGE_BYTES + 16_384) return sessionResponse(errorResponse('Choose a JPEG, PNG, or WebP image smaller than 5 MB.', 400), request, current);
    let form: FormData;
    try { form = await request.formData(); } catch { return sessionResponse(errorResponse('Choose a valid image file.', 400), request, current); }
    const image = form.get('image');
    if (!(image instanceof File) || !PET_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > MAX_PET_IMAGE_BYTES) return sessionResponse(errorResponse('Choose a JPEG, PNG, or WebP image smaller than 5 MB.', 400), request, current);
    const { data: existing, error: existingError } = await client.from('pets').select('id, image_path').eq('id', imageMatch[1]).maybeSingle();
    if (existingError) return sessionResponse(databaseError('admin.pets.image_lookup', existingError), request, current);
    if (!existing) return sessionResponse(errorResponse('Pet not found.', 404), request, current);
    const imagePath = `pets/${existing.id}/${crypto.randomUUID()}.${PET_IMAGE_TYPES.get(image.type)}`;
    const { error: uploadError } = await client.storage.from('pet-images').upload(imagePath, image, { cacheControl: '3600', contentType: image.type, upsert: false });
    if (uploadError) return sessionResponse(databaseError('admin.pets.image_upload', uploadError), request, current);
    const { data, error } = await client.from('pets').update({ image_path: imagePath }).eq('id', existing.id).select('*').maybeSingle();
    if (error || !data) {
      const { error: cleanupError } = await client.storage.from('pet-images').remove([imagePath]);
      if (cleanupError) console.error(JSON.stringify({ operation: 'admin.pets.image_cleanup', error: cleanupError.message, imagePath }));
      return sessionResponse(error ? databaseError('admin.pets.image_update', error) : errorResponse('Pet not found.', 404), request, current);
    }
    if (existing.image_path) {
      const { error: cleanupError } = await client.storage.from('pet-images').remove([existing.image_path]);
      if (cleanupError) console.error(JSON.stringify({ operation: 'admin.pets.old_image_cleanup', error: cleanupError.message, imagePath: existing.image_path }));
    }
    return sessionResponse(respond(petForClient(data as DatabasePet, env)), request, current);
  }
  if (path === '/admin/invitations' && request.method === 'POST') {
    if (role !== 'superuser') return sessionResponse(errorResponse('Only superusers can invite administrators.', 403), request, current);
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!validEmail(email)) return sessionResponse(errorResponse('Enter a valid email address.', 400), request, current);
    const adminClient = supabaseAdmin(env);
    if (!adminClient) return sessionResponse(errorResponse('Administrator invitations are not configured. Contact the deployment owner.', 503), request, current);
    const redirectTo = env.ADMIN_INVITE_REDIRECT_URL ?? 'https://admin.pawheaven.online/accept-invite';
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError || !invited.user) {
      console.error(JSON.stringify({ operation: 'admin.invite', error: inviteError?.message ?? 'No invited user returned' }));
      return sessionResponse(errorResponse('We could not send that invitation. Check the address or try again later.', inviteError?.status === 429 ? 429 : 400), request, current);
    }
    const { error: roleError } = await adminClient.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { ...invited.user.app_metadata, role: 'admin' },
    });
    if (roleError) {
      console.error(JSON.stringify({ operation: 'admin.invite_role', error: roleError.message, invitedUserId: invited.user.id }));
      return sessionResponse(errorResponse('The invitation was not completed. Contact the deployment owner before asking the person to sign in.', 503), request, current);
    }
    const { error: auditError } = await adminClient.from('admin_invitation_audit').insert({
      invited_email: email,
      invited_user_id: invited.user.id,
      invited_by: current.user.id,
    });
    if (auditError) console.error(JSON.stringify({ operation: 'admin.invite_audit', error: auditError.message, invitedUserId: invited.user.id }));
    console.info(JSON.stringify({ operation: 'admin.invite', invitedUserId: invited.user.id, invitedBy: current.user.id }));
    return sessionResponse(respond({ message: 'Invitation sent.' }, 201), request, current);
  }
  return sessionResponse(errorResponse('Not found.', 404), request, current);
}

async function publicPetRoutes(request: Request, env: Env, path: string): Promise<ApiResponse> {
  const client = supabase(env);
  if (path === '/pets' && request.method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim().toLowerCase().slice(0, 100) ?? '';
    const tag = url.searchParams.get('tag')?.trim().slice(0, 40) ?? '';
    let query = client.from('pets').select('*').eq('status', 'Available').order('name', { ascending: true }).limit(200);
    if (tag) query = query.contains('tags', [tag]);
    const { data, error } = await query;
    if (error) return databaseError('pets.list', error);
    const pets = (data as DatabasePet[]).map((row) => petForClient(row, env));
    return respond({ pets: pets.filter((pet) => matchesPetSearch(pet, search)) });
  }
  const match = path.match(/^\/pets\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').eq('id', match[1]).eq('status', 'Available').maybeSingle();
    if (error) return databaseError('pets.get', error);
    return data ? respond(petForClient(data as DatabasePet, env)) : errorResponse('Pet not found.', 404);
  }
  return errorResponse('Not found.', 404);
}

async function route(request: Request, env: Env): Promise<ApiResponse> {
  const path = new URL(request.url).pathname.replace(/^\/api/, '') || '/';
  if (path === '/health' && request.method === 'GET') return respond({ ok: true });
  if (path.startsWith('/auth/')) return authRoutes(request, env, path);
  if (path.startsWith('/admin/')) return adminRoutes(request, env, path);
  if (path === '/pets' || path.startsWith('/pets/')) return publicPetRoutes(request, env, path);
  return errorResponse('Not found.', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const invalidConfiguration = configurationError(env);
    if (invalidConfiguration) return errorResponse(invalidConfiguration, 503);
    const origin = request.headers.get('Origin');
    const allowed = isAllowedOrigin(origin, env);
    if (origin && !allowed) return errorResponse('Origin not allowed.', 403);
    if (request.method === 'OPTIONS') {
      if (!allowed) return errorResponse('Origin not allowed.', 403);
      const response = new Response(null, { status: 204 });
      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      response.headers.set('Access-Control-Max-Age', '600');
      response.headers.set('Access-Control-Allow-Origin', origin!);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
      return response;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origin) return errorResponse('Origin required.', 403);
    try {
      const response = await route(request, env);
      if (allowed) {
        response.headers.set('Access-Control-Allow-Origin', origin!);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary', 'Origin');
      }
      return response;
    } catch (error) {
      console.error(JSON.stringify({ operation: 'api.request', error: error instanceof Error ? error.message : 'Unknown error' }));
      const response = errorResponse('The request could not be completed.', 500);
      if (allowed) {
        response.headers.set('Access-Control-Allow-Origin', origin!);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary', 'Origin');
      }
      return response;
    }
  },
} satisfies ExportedHandler<Env>;
