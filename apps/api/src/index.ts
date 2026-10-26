import { errorResponse, respond, type ApiResponse } from './lib/http';
import { configurationError } from './lib/supabase';
import type { RouteContext } from './lib/session';
import { adminRoutes } from './routes/admin';
import { adoptionApplicationRoutes } from './routes/applications';
import { authRoutes } from './routes/auth';
import { fosterApplicationRoutes } from './routes/foster-applications';
import { publicPetRoutes } from './routes/pets';
import { visitSchedulingRoutes } from './routes/visits';
import { volunteerRoutes } from './routes/volunteer';

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

async function route(context: RouteContext): Promise<ApiResponse> {
  const { request, path } = context;
  if (path === '/health' && request.method === 'GET') return respond({ ok: true });
  if (path.startsWith('/auth/')) return authRoutes(context);
  if (path.startsWith('/admin/')) return adminRoutes(context);
  if (path === '/applications' || path.startsWith('/applications/')) return adoptionApplicationRoutes(context);
  if (path === '/foster-applications' || path.startsWith('/foster-applications/')) return fosterApplicationRoutes(context);
  if (path.startsWith('/volunteer/')) return volunteerRoutes(context);
  if (path === '/visit-slots' || path === '/appointments' || path.startsWith('/appointments/')) return visitSchedulingRoutes(context);
  if (path === '/pets' || path.startsWith('/pets/')) return publicPetRoutes(context);
  return errorResponse('Not found.', 404);
}

function withCors(response: Response, origin: string | null, allowed: boolean): Response {
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', origin!);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      return withCors(response, origin, true);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origin) return errorResponse('Origin required.', 403);
    try {
      const path = new URL(request.url).pathname.replace(/^\/api/, '') || '/';
      return withCors(await route({ request, env, ctx, path }), origin, allowed);
    } catch (error) {
      console.error(JSON.stringify({ operation: 'api.request', error: error instanceof Error ? error.message : 'Unknown error' }));
      return withCors(errorResponse('The request could not be completed.', 500), origin, allowed);
    }
  },
} satisfies ExportedHandler<Env>;
