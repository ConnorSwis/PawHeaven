/**
 * Serves the public site's built pages, and for the pages that show animals it adds what a visitor
 * (and a link preview) needs on the first byte: the page title, description, and share image, plus
 * the data itself as inline JSON. Everything else is passed straight through to the static files.
 *
 *   /adopt/<name>-<8 hex>   one animal  → built page /adopt/pet/ + that animal
 *   /adopt and /            the animals → built page + the animal list
 */
interface Env { ASSETS: Fetcher; API_BASE?: string }
type PublicPet = { id: string; name: string; type: string; breed: string; age: string; summary: string; imageUrl: string | null; sex?: string; size?: string };

const RESERVED = new Set(['pet', 'match', 'process']);
const SITE_NAME = 'PawHeaven';

function apiBase(request: Request, env: Env): string {
  if (env.API_BASE) return env.API_BASE.replace(/\/$/, '');
  // Worker Previews pair the site and API under one Preview name.
  const match = new URL(request.url).hostname.match(/^(?<preview>[a-z0-9-]+-)?pawheaven-frontend(?<suffix>\.[a-z0-9-]+\.workers\.dev)$/i);
  return match?.groups ? `https://${match.groups.preview ?? ''}pawheaven-api${match.groups.suffix}/api` : 'https://api.pawheaven.online/api';
}

async function getJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    return { status: response.status, body: response.ok ? ((await response.json()) as T) : null };
  } catch { return { status: 0, body: null }; }
}

/** JSON that is safe to place inside a <script> element. */
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028').replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

function withData(response: Response, data: unknown, status = response.status, extra?: (rewriter: HTMLRewriter) => HTMLRewriter): Response {
  let rewriter = new HTMLRewriter().on('head', { element(head) { head.append(`<script id="ph-data" type="application/json">${safeJson(data)}</script>`, { html: true }); } });
  if (extra) rewriter = extra(rewriter);
  const result = new Response(rewriter.transform(response).body, { status, headers: response.headers });
  result.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60');
  return result;
}

async function animalPage(request: Request, env: Env, slug: string): Promise<Response> {
  const url = new URL(request.url);
  const template = await env.ASSETS.fetch(new Request(new URL('/adopt/pet/', url), request));
  const shortId = slug.match(/([0-9a-f]{8})$/)?.[1];
  if (!shortId) return withData(template, { missing: true }, 404);
  const { status, body: pet } = await getJson<PublicPet>(`${apiBase(request, env)}/pets/s/${shortId}`);
  if (!pet) return status === 404 ? withData(template, { missing: true }, 404) : template; // API trouble: let the page load it itself
  const about = [pet.breed, pet.age, pet.sex, pet.size].filter(Boolean).join(' · ');
  const description = clip(`${pet.name} is a ${pet.type.toLowerCase()} looking for a home. ${about}. ${pet.summary}`.replace(/\s+/g, ' '), 200);
  const title = `${pet.name}, ${pet.breed || pet.type} | ${SITE_NAME}`;
  const canonical = `${url.origin}/adopt/${slug}`;
  return withData(template, { pet }, 200, (rewriter) => rewriter
    .on('title', { element(element) { element.setInnerContent(title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute('content', description); } })
    .on('meta[property="og:title"]', { element(element) { element.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(element) { element.setAttribute('content', description); } })
    .on('meta[name="twitter:card"]', { element(element) { element.setAttribute('content', pet.imageUrl ? 'summary_large_image' : 'summary'); } })
    .on('head', { element(head) {
      head.append(`<link rel="canonical" href="${escapeAttr(canonical)}" /><meta property="og:url" content="${escapeAttr(canonical)}" />${pet.imageUrl ? `<meta property="og:image" content="${escapeAttr(pet.imageUrl)}" />` : ''}`, { html: true });
    } }));
}

async function listPage(request: Request, env: Env, templatePath: string): Promise<Response> {
  const url = new URL(request.url);
  const template = await env.ASSETS.fetch(new Request(new URL(templatePath, url), request));
  const { body } = await getJson<{ pets: PublicPet[] }>(`${apiBase(request, env)}/pets`);
  return body ? withData(template, body) : template;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const { pathname } = new URL(request.url);
      const animal = pathname.match(/^\/adopt\/([a-z0-9-]+)\/?$/);
      if (animal && !RESERVED.has(animal[1])) return animalPage(request, env, animal[1]);
      if (pathname === '/adopt' || pathname === '/adopt/') return listPage(request, env, '/adopt/');
      if (pathname === '/') return listPage(request, env, '/');
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
