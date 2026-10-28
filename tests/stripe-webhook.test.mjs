import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { donationFromEvent, verifyStripeSignature } from '../apps/api/src/lib/stripe.ts';

const secret = 'whsec_test_secret';
const now = 1_800_000_000;
const sign = (body, timestamp = now, key = secret) => `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`;

const session = (overrides = {}) => ({
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { object: 'checkout.session', id: 'cs_test_123', mode: 'payment', payment_status: 'paid', amount_total: 2500, currency: 'USD', payment_intent: 'pi_123', created: now, customer_details: { name: ' Pat Donor ', email: 'pat@example.com' }, ...overrides } },
});

test('signature: a correctly signed body verifies', async () => {
  const body = JSON.stringify(session());
  assert.equal(await verifyStripeSignature(body, sign(body), secret, now), true);
});

test('signature: a tampered body, wrong secret, or missing header is rejected', async () => {
  const body = JSON.stringify(session());
  assert.equal(await verifyStripeSignature(`${body} `, sign(body), secret, now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, now, 'whsec_other'), secret, now), false);
  assert.equal(await verifyStripeSignature(body, null, secret, now), false);
  assert.equal(await verifyStripeSignature(body, '', secret, now), false);
  assert.equal(await verifyStripeSignature(body, sign(body), '', now), false);
});

test('signature: an old or future timestamp is rejected so captured requests cannot be replayed', async () => {
  const body = JSON.stringify(session());
  assert.equal(await verifyStripeSignature(body, sign(body, now - 301), secret, now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, now + 301), secret, now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, now - 299), secret, now), true);
});

test('signature: any one valid v1 signature is enough, and garbage values are ignored', async () => {
  const body = '{}';
  const good = sign(body).split('v1=')[1];
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=deadbeef,v1=${good},v0=zz`, secret, now), true);
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=not-hex,v1=abc`, secret, now), false);
  assert.equal(await verifyStripeSignature(body, `v1=${good}`, secret, now), false);
  assert.equal(await verifyStripeSignature(body, `t=abc,v1=${good}`, secret, now), false);
});

test('event: a paid checkout session becomes a succeeded donation with trimmed donor details', () => {
  assert.deepEqual(donationFromEvent(session()), {
    sessionId: 'cs_test_123', paymentIntent: 'pi_123', amountCents: 2500, currency: 'usd', status: 'succeeded',
    donorName: 'Pat Donor', donorEmail: 'pat@example.com', livemode: false, createdAt: new Date(now * 1000).toISOString(),
  });
});

test('event: an unpaid session is pending, and async outcomes decide the final status', () => {
  assert.equal(donationFromEvent(session({ payment_status: 'unpaid' })).status, 'pending');
  assert.equal(donationFromEvent({ ...session(), type: 'checkout.session.async_payment_succeeded' }).status, 'succeeded');
  assert.equal(donationFromEvent({ ...session({ payment_status: 'unpaid' }), type: 'checkout.session.async_payment_failed' }).status, 'failed');
});

test('event: live mode is preserved only when Stripe says so', () => {
  assert.equal(donationFromEvent({ ...session(), livemode: true }).livemode, true);
  assert.equal(donationFromEvent({ ...session(), livemode: 'true' }).livemode, false);
});

test('event: other event types, subscriptions, and malformed sessions are ignored, not errors', () => {
  assert.equal(donationFromEvent({ ...session(), type: 'charge.refunded' }), null);
  assert.equal(donationFromEvent(session({ mode: 'subscription' })), null);
  assert.equal(donationFromEvent(session({ object: 'payment_intent' })), null);
  assert.equal(donationFromEvent(session({ amount_total: -1 })), null);
  assert.equal(donationFromEvent(session({ amount_total: 12.5 })), null);
  assert.equal(donationFromEvent(session({ amount_total: 1_000_000_000 })), null);
  assert.equal(donationFromEvent(session({ currency: 'dollars' })), null);
  assert.equal(donationFromEvent(session({ id: '' })), null);
  assert.equal(donationFromEvent(null), null);
  assert.equal(donationFromEvent('nonsense'), null);
});

test('event: missing donor details are allowed (Payment Links can skip them)', () => {
  const record = donationFromEvent(session({ customer_details: null, payment_intent: null }));
  assert.equal(record.donorName, null);
  assert.equal(record.donorEmail, null);
  assert.equal(record.paymentIntent, null);
});
