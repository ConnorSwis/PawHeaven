import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { ApiUser, Pet, PetInput, PetStatus, Role } from '@pawheaven/contracts';

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

type Identity = { user: User; token: string; refreshed?: Session };
type ApiResponse = Response;
const ACCESS_COOKIE = 'ph_access';
const REFRESH_COOKIE = 'ph_refresh';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

function supabase(env: Env, token?: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
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
  if (access) {
    const { data, error } = await supabase(env).auth.getUser(access);
    if (!error && data.user) return { user: data.user, token: access };
  }
  const refresh = cookies[REFRESH_COOKIE];
  if (!refresh) return null;
  const { data, error } = await supabase(env).auth.refreshSession({ refresh_token: refresh });
  if (error || !data.user || !data.session) return null;
  return { user: data.user, token: data.session.access_token, refreshed: data.session };
}

function roleOf(user: User): Role {
  const role = user.app_metadata?.role;
  return role === 'staff' || role === 'admin' ? role : 'user';
}

function apiUser(user: User): ApiUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email ?? 'PawHeaven member',
    role: roleOf(user),
  };
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

function parsePetInput(value: unknown): PetInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof body[key] === 'string' && (body[key] as string).trim().length > 0 && (body[key] as string).trim().length <= max;
  if (!text('name', 100) || !text('type', 60) || !text('breed', 100) || !text('age', 60) || !text('summary', 2000)) return null;
  if (typeof body.intakeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.intakeDate) || Number.isNaN(Date.parse(body.intakeDate)) || body.intakeDate > new Date().toISOString().slice(0, 10)) return null;
  if (!Array.isArray(body.tags) || body.tags.length > 12 || !body.tags.every((tag) => typeof tag === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag) && tag.length <= 40)) return null;
  if (body.status !== 'Available' && body.status !== 'Pending' && body.status !== 'Adopted') return null;
  return {
    name: (body.name as string).trim(), type: (body.type as string).trim(), breed: (body.breed as string).trim(),
    age: (body.age as string).trim(), summary: (body.summary as string).trim(), intakeDate: body.intakeDate,
    tags: [...new Set(body.tags as string[])], status: body.status,
  };
}

function databaseInput(input: PetInput) {
  return { name: input.name, species: input.type, breed: input.breed, age_label: input.age,
    intake_date: input.intakeDate, tags: input.tags, status: input.status, summary: input.summary };
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

async function imageIsValid(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (file.type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return false;
}

function databaseError(operation: string, error: { message: string }): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message }));
  return errorResponse('The shelter database is unavailable. Please try again.', 503);
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
    const matching = (data as DatabasePet[]).filter((row) => !search || `${row.name} ${row.tags.join(' ')}`.toLowerCase().includes(search));
    return respond({ pets: matching.map((row) => petForClient(row, env)) });
  }
  const match = path.match(/^\/pets\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').eq('id', match[1]).eq('status', 'Available').maybeSingle();
    if (error) return databaseError('pets.get', error);
    return data ? respond(petForClient(data as DatabasePet, env)) : errorResponse('Pet not found.', 404);
  }
  return errorResponse('Not found.', 404);
}

async function staffPetRoutes(request: Request, env: Env, path: string): Promise<ApiResponse> {
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Sign in to continue.', 401), request);
  if (roleOf(current.user) === 'user') return errorResponse('Staff access required.', 403);
  const client = supabase(env, current.token);
  let response: ApiResponse;
  if (path === '/staff/pets' && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').order('name', { ascending: true }).limit(200);
    response = error ? databaseError('staff.pets.list', error) : respond({ pets: (data as DatabasePet[]).map((row) => petForClient(row, env)) });
  } else if (path === '/staff/pets' && request.method === 'POST') {
    const input = parsePetInput(await jsonBody(request));
    if (!input) response = errorResponse('Check the pet fields and try again.', 400);
    else {
      const { data, error } = await client.from('pets').insert(databaseInput(input)).select('*').single();
      response = error ? databaseError('staff.pets.create', error) : respond(petForClient(data as DatabasePet, env), 201);
    }
  } else {
    const match = path.match(/^\/staff\/pets\/([0-9a-f-]{36})(\/image)?$/i);
    if (!match) response = errorResponse('Not found.', 404);
    else if (match[2] && request.method === 'POST') response = await uploadImage(request, env, client, match[1]);
    else if (!match[2] && request.method === 'PUT') {
      const input = parsePetInput(await jsonBody(request));
      if (!input) response = errorResponse('Check the pet fields and try again.', 400);
      else {
        const { data, error } = await client.from('pets').update(databaseInput(input)).eq('id', match[1]).select('*').maybeSingle();
        response = error ? databaseError('staff.pets.update', error) : data ? respond(petForClient(data as DatabasePet, env)) : errorResponse('Pet not found.', 404);
      }
    } else if (!match[2] && request.method === 'DELETE') {
      const { data, error } = await client.from('pets').delete().eq('id', match[1]).select('image_path').maybeSingle();
      if (error) response = databaseError('staff.pets.delete', error);
      else if (!data) response = errorResponse('Pet not found.', 404);
      else {
        if (data.image_path) {
          const removed = await client.storage.from('pet-images').remove([data.image_path]);
          if (removed.error) console.error(JSON.stringify({ operation: 'staff.pets.image.remove', error: removed.error.message }));
        }
        response = respond({ ok: true });
      }
    } else response = errorResponse('Not found.', 404);
  }
  return current.refreshed ? withSession(response, request, current.refreshed) : response;
}

async function uploadImage(request: Request, env: Env, client: ReturnType<typeof supabase>, petId: string): Promise<ApiResponse> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_IMAGE_SIZE + 16_384) return errorResponse('Images must be 5 MB or smaller.', 413);
  const { data: existing, error: lookupError } = await client.from('pets').select('image_path').eq('id', petId).maybeSingle();
  if (lookupError) return databaseError('staff.pets.image.lookup', lookupError);
  if (!existing) return errorResponse('Pet not found.', 404);
  const bytes = await readLimited(request, MAX_IMAGE_SIZE + 16_384);
  if (!bytes) return errorResponse('Images must be 5 MB or smaller.', 413);
  let form: FormData;
  try {
    const body = new ArrayBuffer(bytes.length);
    new Uint8Array(body).set(bytes);
    const uploadRequest = new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' }, body });
    form = await uploadRequest.formData();
  } catch { return errorResponse('Upload one JPEG, PNG, or WebP image.', 400); }
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE || !IMAGE_TYPES.has(file.type) || !await imageIsValid(file)) return errorResponse('Upload one JPEG, PNG, or WebP image up to 5 MB.', 400);
  const path = `${petId}/${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
  const uploaded = await client.storage.from('pet-images').upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) return databaseError('staff.pets.image.upload', uploaded.error);
  const updated = await client.from('pets').update({ image_path: path }).eq('id', petId).select('*').single();
  if (updated.error) {
    await client.storage.from('pet-images').remove([path]);
    return databaseError('staff.pets.image.update', updated.error);
  }
  if (existing.image_path) {
    const removed = await client.storage.from('pet-images').remove([existing.image_path]);
    if (removed.error) console.error(JSON.stringify({ operation: 'staff.pets.image.remove', error: removed.error.message }));
  }
  return respond(petForClient(updated.data as DatabasePet, env));
}

async function route(request: Request, env: Env): Promise<ApiResponse> {
  const path = new URL(request.url).pathname.replace(/^\/api/, '') || '/';
  if (path === '/health' && request.method === 'GET') return respond({ ok: true });
  if (path.startsWith('/auth/')) return authRoutes(request, env, path);
  if (path === '/pets' || path.startsWith('/pets/')) return publicPetRoutes(request, env, path);
  if (path.startsWith('/staff/')) return staffPetRoutes(request, env, path);
  return errorResponse('Not found.', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = origin && env.ALLOWED_ORIGINS.split(',').map((entry) => entry.trim()).includes(origin);
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
