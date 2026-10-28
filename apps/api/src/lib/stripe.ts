/**
 * Stripe webhook helpers. Everything here is pure or uses Web Crypto only, so
 * it runs in a Worker and in Node tests without the Stripe SDK.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const MAX_WEBHOOK_BYTES = 256 * 1024;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

/**
 * Checks a `Stripe-Signature` header (`t=<unix>,v1=<hex hmac>[,v1=...]`) against
 * the raw request body. The signed payload is `<t>.<body>`, signed with the
 * endpoint's `whsec_` secret using HMAC-SHA256. The comparison is constant time
 * (Web Crypto verify), and timestamps outside the tolerance are rejected so a
 * captured request cannot be replayed later.
 */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }
  const signedAt = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(signedAt) || Math.abs(nowSeconds - signedAt) > SIGNATURE_TOLERANCE_SECONDS || !signatures.length) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const payload = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  for (const signature of signatures) {
    const bytes = hexToBytes(signature);
    if (bytes && await crypto.subtle.verify('HMAC', key, bytes, payload)) return true;
  }
  return false;
}

export type DonationStatus = 'pending' | 'succeeded' | 'failed';

export type DonationRecord = {
  sessionId: string;
  paymentIntent: string | null;
  amountCents: number;
  currency: string;
  status: DonationStatus;
  donorName: string | null;
  donorEmail: string | null;
  livemode: boolean;
  createdAt: string;
};

const EVENT_OUTCOME: Record<string, 'from-payment-status' | 'succeeded' | 'failed'> = {
  'checkout.session.completed': 'from-payment-status',
  'checkout.session.async_payment_succeeded': 'succeeded',
  'checkout.session.async_payment_failed': 'failed',
};

const text = (value: unknown, limit: number): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;

/**
 * Turns a verified Stripe event into a donation record, or null when the event
 * is not a one-time payment Checkout Session we record. Null is not an error:
 * the webhook acknowledges it so Stripe does not keep retrying it.
 */
export function donationFromEvent(event: unknown): DonationRecord | null {
  const root = event as { type?: unknown; livemode?: unknown; data?: { object?: Record<string, unknown> } } | null;
  const outcome = typeof root?.type === 'string' ? EVENT_OUTCOME[root.type] : undefined;
  const session = root?.data?.object;
  if (!outcome || !session || session.object !== 'checkout.session' || session.mode !== 'payment') return null;

  const sessionId = text(session.id, 255);
  const amount = session.amount_total;
  const currency = typeof session.currency === 'string' ? session.currency.toLowerCase() : '';
  if (!sessionId || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 100_000_000 || !/^[a-z]{3}$/.test(currency)) return null;

  let status: DonationStatus;
  if (outcome === 'from-payment-status') status = session.payment_status === 'paid' || session.payment_status === 'no_payment_required' ? 'succeeded' : 'pending';
  else status = outcome;

  const customer = (session.customer_details ?? {}) as Record<string, unknown>;
  const created = typeof session.created === 'number' && Number.isFinite(session.created) ? new Date(session.created * 1000) : new Date();
  return {
    sessionId,
    paymentIntent: text(session.payment_intent, 255),
    amountCents: amount,
    currency,
    status,
    donorName: text(customer.name, 200),
    donorEmail: text(customer.email, 254),
    livemode: root?.livemode === true,
    createdAt: created.toISOString(),
  };
}
