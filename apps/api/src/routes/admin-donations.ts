import type { AdminDonation, AdminDonationsResponse, DonationTotal } from '@pawheaven/contracts';
import { databaseError, respond, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

type DatabaseDonation = {
  id: string;
  amount_cents: number;
  currency: string;
  status: AdminDonation['status'];
  donor_name: string | null;
  donor_email: string | null;
  livemode: boolean;
  stripe_created_at: string;
};

/** Read-only for staff. Donations are written only by the verified Stripe webhook. */
export async function adminDonationRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (path !== '/admin/donations' || request.method !== 'GET') return null;
  const client = userSupabase(env, current.accessToken);
  const [donationsResult, summaryResult] = await Promise.all([
    client.from('donations').select('id, amount_cents, currency, status, donor_name, donor_email, livemode, stripe_created_at').order('stripe_created_at', { ascending: false }).limit(200),
    client.rpc('donation_summary'),
  ]);
  if (donationsResult.error) return databaseError('admin.donations.list', donationsResult.error);
  if (summaryResult.error) return databaseError('admin.donations.summary', summaryResult.error);
  const payload: AdminDonationsResponse = {
    totals: (summaryResult.data as { livemode: boolean; currency: string; donation_count: number; total_cents: number }[]).map((row): DonationTotal => ({
      livemode: row.livemode, currency: row.currency, count: Number(row.donation_count), totalCents: Number(row.total_cents),
    })),
    donations: (donationsResult.data as DatabaseDonation[]).map((row): AdminDonation => ({
      id: row.id, amountCents: row.amount_cents, currency: row.currency, status: row.status,
      donorName: row.donor_name, donorEmail: row.donor_email, livemode: row.livemode, createdAt: row.stripe_created_at,
    })),
  };
  return respond(payload);
}
