import { errorResponse, respond, type ApiResponse } from '../lib/http';
import type { RouteContext } from '../lib/session';
import { donationFromEvent, MAX_WEBHOOK_BYTES, verifyStripeSignature } from '../lib/stripe';
import { supabaseAdmin } from '../lib/supabase';

/**
 * POST /webhooks/stripe. The only way a donation is recorded. The request is
 * trusted only after its Stripe signature verifies against the raw body; the
 * database is then written with the server-side service role through the
 * record_donation() function, which is the sole privileged use here.
 */
export async function webhookRoutes({ request, env, path }: RouteContext): Promise<ApiResponse> {
  if (path !== '/webhooks/stripe' || request.method !== 'POST') return errorResponse('Not found.', 404);
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error(JSON.stringify({ operation: 'stripe.webhook', error: 'STRIPE_WEBHOOK_SECRET is not configured' }));
    return errorResponse('Donation recording is not configured.', 503);
  }
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_WEBHOOK_BYTES) return errorResponse('Payload too large.', 413);
  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BYTES) return errorResponse('Payload too large.', 413);

  if (!await verifyStripeSignature(rawBody, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET)) {
    return errorResponse('Invalid signature.', 400);
  }
  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return errorResponse('Invalid payload.', 400); }

  const donation = donationFromEvent(event);
  if (!donation) return respond({ received: true, recorded: false });

  const admin = supabaseAdmin(env);
  if (!admin) {
    console.error(JSON.stringify({ operation: 'stripe.webhook', error: 'service role is not configured' }));
    return errorResponse('Donation recording is not configured.', 503);
  }
  const { data, error } = await admin.rpc('record_donation', {
    p_session_id: donation.sessionId,
    p_payment_intent: donation.paymentIntent,
    p_amount_cents: donation.amountCents,
    p_currency: donation.currency,
    p_status: donation.status,
    p_donor_name: donation.donorName,
    p_donor_email: donation.donorEmail,
    p_livemode: donation.livemode,
    p_stripe_created_at: donation.createdAt,
  });
  if (error) {
    // A non-2xx response makes Stripe retry later, so a database outage never loses a donation.
    console.error(JSON.stringify({ operation: 'stripe.webhook.record', error: error.message, code: error.code }));
    return errorResponse('The donation could not be recorded.', 500);
  }
  return respond({ received: true, recorded: true, status: data });
}
