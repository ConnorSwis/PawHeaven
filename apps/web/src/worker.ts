type Env = {
  /** Custom-domain API origin, used only when the frontend itself is not on workers.dev. */
  API_ORIGIN?: string;
};

type WorkerHandler = {
  fetch(request: Request, env: Env): Promise<Response>;
};

function matchingWorkersDevApiOrigin(frontendUrl: URL): string | null {
  // A branch Preview uses the same preview name for both Workers, for example:
  // feature-login-pawheaven-frontend.<account>.workers.dev
  // feature-login-pawheaven-api.<account>.workers.dev
  const match = frontendUrl.hostname.match(/^(?<preview>[a-z0-9-]+-)?pawheaven-frontend(?<suffix>\.[a-z0-9-]+\.workers\.dev)$/i);
  if (!match?.groups) return null;
  return `${frontendUrl.protocol}//${match.groups.preview ?? ''}pawheaven-api${match.groups.suffix}`;
}

function apiOrigin(frontendUrl: URL, env: Env): string | null {
  return matchingWorkersDevApiOrigin(frontendUrl) ?? env.API_ORIGIN?.trim().replace(/\/$/, '') ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    const origin = apiOrigin(requestUrl, env);
    if (!origin) return new Response('API proxy is not configured for this hostname.', { status: 502 });

    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, origin);
    } catch {
      return new Response('API proxy is misconfigured.', { status: 502 });
    }

    return fetch(new Request(upstreamUrl, request));
  },
} satisfies WorkerHandler;
