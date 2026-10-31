import type { AdminDonation, AdminDonationsResponse, DonationPublicationInput, DonationPublicationStatus, DonationTotal } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, UUID_PATTERN, type ApiResponse } from '../lib/http';
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
  public_opt_in: boolean;
  public_display_name: string | null;
  public_message: string | null;
  public_status: DonationPublicationStatus;
  stripe_created_at: string;
};

/** Read-only for staff. Donations are written only by the verified Stripe webhook. */
export async function adminDonationRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/donations')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/donations' && request.method === 'GET') {
    const [donationsResult, summaryResult] = await Promise.all([
      client.from('donations').select('id, amount_cents, currency, status, donor_name, donor_email, livemode, public_opt_in, public_display_name, public_message, public_status, stripe_created_at').order('stripe_created_at', { ascending: false }).limit(200),
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
        donorName: row.donor_name, donorEmail: row.donor_email, livemode: row.livemode,
        publicOptIn: row.public_opt_in, publicDisplayName: row.public_display_name, publicMessage: row.public_message,
        publicStatus: row.public_status, createdAt: row.stripe_created_at,
      })),
    };
    return respond(payload);
  }

  const match = path.match(/^\/admin\/donations\/([0-9a-f-]{36})\/publication$/i);
  if (match && request.method === 'PUT') {
    const input = await jsonBody(request) as DonationPublicationInput | null;
    if (!UUID_PATTERN.test(match[1]) || (input?.publicStatus !== 'published' && input?.publicStatus !== 'hidden')) return errorResponse('Choose Published or Hidden.', 400);
    const { data, error } = await client.rpc('set_donation_publication', { p_donation_id: match[1], p_public_status: input.publicStatus });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Donation not found.', 404);
      if (error.code === '22023' || error.code === '42501' || error.code === 'P0001') return errorResponse(error.message, error.code === '42501' ? 403 : 400);
      return databaseError('admin.donations.publication', error);
    }
    return respond({ publicStatus: data as DonationPublicationStatus });
  }

  return null;
}
