import { errorResponse, jsonBody, respond, rpcErrorResponse, UUID_PATTERN, type ApiResponse } from '../lib/http';
import { availabilityForClient, feedForClient, involvementForClient, memberFosterRequestForClient, scheduleEntryForClient, scheduleToIcs } from '../lib/schedule';
import { clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { supabase, userSupabase } from '../lib/supabase';

const rpcError = (operation: string, error: { message: string; code?: string }) =>
  rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again.' });

/** Public "what is open" feed plus the signed-in member's schedule, involvement, and foster requests. */
export async function getInvolvedRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;

  if (path === '/get-involved' && request.method === 'GET') {
    const { data, error } = await supabase(env).rpc('get_involved_feed');
    if (error) return rpcError('get_involved.feed', error);
    return respond(feedForClient(data));
  }

  // Open visit times and volunteer shifts with ids, so a guest can choose before signing in.
  if (path === '/public/availability' && request.method === 'GET') {
    const { data, error } = await supabase(env).rpc('get_public_availability');
    if (error) return rpcError('public.availability', error);
    return respond(availabilityForClient(data));
  }

  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to see your schedule.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/me/schedule' || path === '/me/schedule.ics') {
    if (request.method !== 'GET') return sessionResponse(errorResponse('Not found.', 404), request, current);
    const { data, error } = await client.rpc('list_my_schedule');
    if (error) return sessionResponse(rpcError('me.schedule', error), request, current);
    const entries = (data as Parameters<typeof scheduleEntryForClient>[0][]).map(scheduleEntryForClient);
    if (path === '/me/schedule.ics') {
      const response = new Response(scheduleToIcs(entries), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pawheaven-schedule.ics"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
      return sessionResponse(response, request, current);
    }
    return sessionResponse(respond({ entries }), request, current);
  }

  if (path === '/me/involvement' && request.method === 'GET') {
    const { data, error } = await client.rpc('my_involvement');
    if (error) return sessionResponse(rpcError('me.involvement', error), request, current);
    return sessionResponse(respond(involvementForClient(data)), request, current);
  }

  if (path === '/me/foster-alerts' && request.method === 'PUT') {
    const body = await jsonBody(request) as { optIn?: unknown } | null;
    if (typeof body?.optIn !== 'boolean') return sessionResponse(errorResponse('Choose whether to receive foster alerts.', 400), request, current);
    const { error } = await client.rpc('set_foster_alerts', { p_opt_in: body.optIn });
    if (error) return sessionResponse(rpcError('me.foster_alerts', error), request, current);
    return sessionResponse(respond({ ok: true }), request, current);
  }

  if (path === '/me/foster-invitation/dismiss' && request.method === 'POST') {
    const { error } = await client.rpc('dismiss_foster_invitation');
    if (error) return sessionResponse(rpcError('me.foster_invitation', error), request, current);
    return sessionResponse(respond({ ok: true }), request, current);
  }

  if (path === '/foster-requests' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_my_foster_requests');
    if (error) return sessionResponse(rpcError('foster_requests.list', error), request, current);
    return sessionResponse(respond({ requests: (data as Parameters<typeof memberFosterRequestForClient>[0][]).map(memberFosterRequestForClient) }), request, current);
  }

  const respondMatch = path.match(/^\/foster-requests\/([0-9a-f-]{36})\/respond$/i);
  if (respondMatch && request.method === 'POST') {
    const body = await jsonBody(request) as { accept?: unknown; availableFrom?: unknown; availableUntil?: unknown } | null;
    if (!UUID_PATTERN.test(respondMatch[1]) || typeof body?.accept !== 'boolean') return sessionResponse(errorResponse('Choose accept or decline.', 400), request, current);
    const date = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
    const { error } = await client.rpc('respond_foster_request', {
      p_request_id: respondMatch[1], p_accept: body.accept, p_available_from: date(body.availableFrom), p_available_until: date(body.availableUntil),
    });
    if (error) return sessionResponse(rpcError('foster_requests.respond', error), request, current);
    return sessionResponse(respond({ ok: true }), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
