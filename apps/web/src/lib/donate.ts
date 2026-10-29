/**
 * Public Stripe Payment Link for donations. It is safe to commit: it only opens
 * Stripe's hosted checkout. A test-mode link (`/test_`) moves no real money.
 * Swap in the live link when the shelter is ready to accept real gifts.
 * In Stripe, set the link's "After payment" redirect to /donate/thanks.
 */
export const DONATE_URL = 'https://donate.stripe.com/test_6oU9AU5UYbxyg2X0CWeAg00';

export const isTestDonateLink = DONATE_URL.includes('/test_');
