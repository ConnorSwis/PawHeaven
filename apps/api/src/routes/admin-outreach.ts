import type { NewsletterListResponse, NewsletterPreviewResponse, OutreachSummary, SubscriberListResponse } from '@pawheaven/contracts';
import { sendEmail } from '../lib/email';
import { databaseError, errorResponse, jsonBody, respond, rpcErrorResponse, validationResponse, type ApiResponse } from '../lib/http';
import { newsletterContent, newsletterEmail, runOutbox } from '../lib/notifications';
import { newsletterForClient, newsletterInput, subscriberForClient } from '../lib/outreach';
import type { AdminContext } from '../lib/session';
import { supabaseAdmin, userSupabase } from '../lib/supabase';

const rpcError = (operation: string, error: { message: string; code?: string }) =>
  rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again to manage outreach.' });

/** Staff tools for the newsletter, subscribers, and a summary of alerts and email delivery. */
export async function adminOutreachRoutes(context: AdminContext): Promise<ApiResponse | null> {
  const { request, env, ctx, path, current } = context;
  if (!(path === '/admin/outreach' || path === '/admin/subscribers' || path.startsWith('/admin/subscribers/') || path === '/admin/newsletters' || path.startsWith('/admin/newsletters/'))) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/outreach' && request.method === 'GET') {
    const { data, error } = await client.rpc('outreach_summary');
    return error ? rpcError('admin.outreach.summary', error) : respond(data as OutreachSummary);
  }

  if (path === '/admin/subscribers' && request.method === 'GET') {
    const { data, error } = await client.from('email_subscribers').select('id, email, status, created_at, confirmed_at').order('created_at', { ascending: false }).limit(1000);
    if (error) return databaseError('admin.subscribers.list', error);
    return respond({ subscribers: (data ?? []).map(subscriberForClient) } satisfies SubscriberListResponse);
  }
  const subscriberMatch = path.match(/^\/admin\/subscribers\/([0-9a-f-]{36})$/i);
  if (subscriberMatch && request.method === 'DELETE') {
    const { error } = await client.rpc('remove_subscriber', { p_id: subscriberMatch[1] });
    return error ? rpcError('admin.subscribers.remove', error) : respond({ ok: true });
  }

  if (path === '/admin/newsletters' && request.method === 'GET') {
    const { data, error } = await client.from('newsletters').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return databaseError('admin.newsletters.list', error);
    return respond({ newsletters: (data ?? []).map(newsletterForClient) } satisfies NewsletterListResponse);
  }
  if (path === '/admin/newsletters' && request.method === 'POST') {
    const parsed = newsletterInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { data, error } = await client.from('newsletters').insert({ subject: parsed.value.subject, body: parsed.value.body, blocks: parsed.value.blocks }).select('*').single();
    return error ? databaseError('admin.newsletters.create', error) : respond(newsletterForClient(data), 201);
  }

  const match = path.match(/^\/admin\/newsletters\/([0-9a-f-]{36})(?:\/(preview|test|send))?$/i);
  if (!match) return errorResponse('Not found.', 404);
  const [, id, action] = match;
  const { data: row, error: lookupError } = await client.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (lookupError) return databaseError('admin.newsletters.get', lookupError);
  if (!row) return errorResponse('Newsletter not found.', 404);

  if (!action && request.method === 'GET') return respond(newsletterForClient(row));
  if (!action && request.method === 'PUT') {
    if (row.status !== 'draft') return errorResponse('Only a draft can be edited.', 409);
    const parsed = newsletterInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { data, error } = await client.from('newsletters').update({ subject: parsed.value.subject, body: parsed.value.body, blocks: parsed.value.blocks, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
    if (error) return databaseError('admin.newsletters.update', error);
    return data ? respond(newsletterForClient(data)) : errorResponse('Only a draft can be edited.', 409);
  }
  if (!action && request.method === 'DELETE') {
    if (row.status !== 'draft') return errorResponse('Only a draft can be deleted.', 409);
    const { error } = await client.from('newsletters').delete().eq('id', id);
    return error ? databaseError('admin.newsletters.delete', error) : respond({ ok: true });
  }

  if ((action === 'preview' && request.method === 'GET') || (action === 'test' && request.method === 'POST')) {
    if (!supabaseAdmin(env)) return errorResponse('Previews need the service-role key, which is not configured on this API.', 503);
    const message = await newsletterEmail(env, newsletterForClient(row), await newsletterContent(env, row.blocks), action === 'test' ? current.user.email ?? '' : 'subscriber@example.com');
    if (action === 'preview') return respond({ subject: message.subject, html: message.html, text: message.text } satisfies NewsletterPreviewResponse);
    if (!current.user.email) return errorResponse('Your account has no email address to send a test to.', 400);
    const sent = await sendEmail(env, { ...message, subject: `[Test] ${message.subject}` });
    return sent ? respond({ sentTo: current.user.email }) : errorResponse('The test email could not be sent. Check the email service settings.', 502);
  }

  if (action === 'send' && request.method === 'POST') {
    const { data, error } = await client.rpc('queue_newsletter', { p_id: id });
    if (error) return rpcError('admin.newsletters.send', error);
    ctx.waitUntil(runOutbox(env, 100).catch((failure) => console.error(JSON.stringify({ operation: 'outbox.after_send', error: String(failure) }))));
    return respond({ queued: data as number }, 202);
  }
  return errorResponse('Not found.', 404);
}
