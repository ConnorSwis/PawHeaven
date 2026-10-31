import type { EmailPrefs, SavedPetsResponse, SavedSearchListResponse, SubscribeResponse, UnsubscribeResponse } from '@pawheaven/contracts';
import { errorResponse, jsonBody, respond, rpcErrorResponse, UUID_PATTERN, type ApiResponse } from '../lib/http';
import { notify } from '../lib/email';
import { newsletterConfirmEmail } from '../lib/notifications';
import { verifyUnsubscribeToken } from '../lib/unsubscribe';
import { emailPrefsInput, petIdsInput, savedSearchInput } from '../lib/outreach';
import { clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { supabaseAdmin, userSupabase } from '../lib/supabase';

const rpcError = (operation: string, error: { message: string; code?: string }) =>
  rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again.' });

export const isAlertsPath = (path: string) =>
  path === '/me/saved' || path.startsWith('/me/saved/') || path === '/me/searches' || path.startsWith('/me/searches/') || path === '/me/email-prefs'
  || path === '/public/subscribe' || path === '/public/newsletter/confirm' || path === '/public/unsubscribe';

/** Saved animals and searches, email choices, and the guest newsletter: sign-up, confirmation, and unsubscribe. */
export async function alertsRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;

  // Guests (these use the service role; the signed links and confirmation tokens are the proof of ownership) ---
  if (path === '/public/subscribe' || path === '/public/newsletter/confirm' || path === '/public/unsubscribe') {
    if (request.method !== 'POST') return errorResponse('Not found.', 404);
    const admin = supabaseAdmin(env);
    if (!admin) return errorResponse('Email sign-up is not available right now. Please try again later.', 503);
    const body = await jsonBody(request) as Record<string, unknown> | null;

    if (path === '/public/subscribe') {
      const email = typeof body?.email === 'string' ? body.email.trim() : '';
      if (!email) return errorResponse('Enter your email address.', 400, { email: 'Enter your email address.' });
      const { data, error } = await admin.rpc('subscribe_newsletter', { p_email: email });
      if (error) return error.code === '22023' ? errorResponse('Enter a valid email address.', 400, { email: 'Enter a valid email address, such as name@example.com.' }) : rpcError('public.subscribe', error);
      const result = data as { status: 'pending' | 'confirmed'; token?: string };
      if (result.status === 'pending' && result.token) notify(context, await newsletterConfirmEmail(env, email.toLowerCase(), result.token));
      return respond({ status: result.status } satisfies SubscribeResponse);
    }
    if (path === '/public/newsletter/confirm') {
      const token = typeof body?.token === 'string' ? body.token : '';
      const { data, error } = token.length >= 16 && token.length <= 64 ? await admin.rpc('confirm_newsletter', { p_token: token }) : { data: false, error: null };
      if (error) return rpcError('public.newsletter_confirm', error);
      return data ? respond({ ok: true }) : errorResponse('This confirmation link is not valid. Subscribe again to get a new one.', 404);
    }
    const verified = typeof body?.token === 'string' ? await verifyUnsubscribeToken(env, body.token) : null;
    if (!verified) return errorResponse('This unsubscribe link is not valid. Use the link in the most recent email, or manage your choices in your account.', 400);
    const { error } = await admin.rpc('unsubscribe_email', { p_email: verified.e, p_scope: verified.s });
    if (error) return rpcError('public.unsubscribe', error);
    return respond({ scope: verified.s } satisfies UnsubscribeResponse);
  }

  // Members ---------------------------------------------------------------------------------------------------
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to use saved animals and email choices.', 401), request);
  const client = userSupabase(env, current.accessToken);
  const reply = (response: ApiResponse) => sessionResponse(response, request, current);
  const petIds = (data: unknown) => respond({ petIds: (Array.isArray(data) ? data : []) as string[] } satisfies SavedPetsResponse);

  if (path === '/me/saved' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_saved_pets');
    return reply(error ? rpcError('me.saved.list', error) : petIds(data));
  }
  if (path === '/me/saved' && request.method === 'POST') {
    const parsed = petIdsInput(await jsonBody(request));
    if ('message' in parsed) return reply(errorResponse(parsed.message, 400));
    const { data, error } = await client.rpc('merge_saved_pets', { p_pet_ids: parsed.value });
    return reply(error ? rpcError('me.saved.merge', error) : petIds(data));
  }
  const savedMatch = path.match(/^\/me\/saved\/([0-9a-f-]{36})$/i);
  if (savedMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
    const { data, error } = request.method === 'PUT'
      ? await client.rpc('merge_saved_pets', { p_pet_ids: [savedMatch[1]] })
      : await client.rpc('unsave_pet', { p_pet_id: savedMatch[1] });
    return reply(error ? rpcError('me.saved.change', error) : petIds(data));
  }

  const searches = (data: unknown) => respond({ searches: Array.isArray(data) ? data : [] } as SavedSearchListResponse);
  if (path === '/me/searches' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_my_searches');
    return reply(error ? rpcError('me.searches.list', error) : searches(data));
  }
  if (path === '/me/searches' && request.method === 'POST') {
    const parsed = savedSearchInput(await jsonBody(request));
    if ('message' in parsed) return reply(errorResponse(parsed.message, 400));
    const { data, error } = await client.rpc('create_saved_search', { p_label: parsed.value.label, p_filters: parsed.value.filters });
    return reply(error ? rpcError('me.searches.create', error) : searches(data));
  }
  const searchMatch = path.match(/^\/me\/searches\/([0-9a-f-]{36})$/i);
  if (searchMatch && request.method === 'DELETE' && UUID_PATTERN.test(searchMatch[1])) {
    const { data, error } = await client.rpc('delete_saved_search', { p_id: searchMatch[1] });
    return reply(error ? rpcError('me.searches.delete', error) : searches(data));
  }

  if (path === '/me/email-prefs' && request.method === 'GET') {
    const { data, error } = await client.rpc('get_my_email_prefs');
    return reply(error ? rpcError('me.email_prefs.get', error) : respond(data as EmailPrefs));
  }
  if (path === '/me/email-prefs' && request.method === 'PUT') {
    const parsed = emailPrefsInput(await jsonBody(request));
    if ('message' in parsed) return reply(errorResponse(parsed.message, 400));
    const { data, error } = await client.rpc('set_my_email_prefs', {
      p_match_digest: parsed.value.matchDigest ?? null, p_saved_changes: parsed.value.savedChanges ?? null, p_newsletter: parsed.value.newsletter ?? null,
    });
    return reply(error ? rpcError('me.email_prefs.set', error) : respond(data as EmailPrefs));
  }
  return reply(errorResponse('Not found.', 404));
}
