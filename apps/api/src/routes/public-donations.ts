import type { PublicDonation, PublicDonationsResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, respond, type ApiResponse } from '../lib/http';
import type { RouteContext } from '../lib/session';
import { supabase } from '../lib/supabase';

type DatabasePublicDonation = {
  display_name: string;
  message: string | null;
  amount_cents: number;
  currency: string;
  created_at: string;
};

/** Only the database's fixed, public-safe function may provide supporter-wall entries. */
export async function publicDonationRoutes({ request, env, path }: RouteContext): Promise<ApiResponse | null> {
  if (path !== '/public/donations') return null;
  if (request.method !== 'GET') return errorResponse('Not found.', 404);
  const { data, error } = await supabase(env).rpc('latest_public_donations');
  if (error) return databaseError('public.donations.list', error);
  const donations = (data as DatabasePublicDonation[]).map((row): PublicDonation => ({
    displayName: row.display_name,
    message: row.message,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    createdAt: row.created_at,
  }));
  const response = respond({ donations } satisfies PublicDonationsResponse);
  response.headers.set('Cache-Control', 'public, max-age=60');
  return response;
}
