import type { AdminFosterApplicationListResponse, PetStatusUpdate } from '@pawheaven/contracts';
import { applicationReviewStatus, reviewPetStatus } from '../lib/applications';
import { notify } from '../lib/email';
import { fosterOutcomeEmail } from '../lib/email-templates';
import { fosterApplicationForClient, type DatabaseFosterApplication } from '../lib/foster';
import { databaseError, errorResponse, jsonBody, respond, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

export async function adminFosterApplicationRoutes(context: AdminContext): Promise<ApiResponse | null> {
  const { request, env, path, current } = context;
  if (!path.startsWith('/admin/foster-applications')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/foster-applications' && request.method === 'GET') {
    const { data, error } = await client.from('foster_applications').select('*').order('submitted_at', { ascending: true }).limit(500);
    if (error) return databaseError('admin.foster_applications.list', error);
    const payload: AdminFosterApplicationListResponse = { applications: (data as DatabaseFosterApplication[]).map(fosterApplicationForClient) };
    return respond(payload);
  }

  const match = path.match(/^\/admin\/foster-applications\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'PUT') {
    const body = await jsonBody(request);
    const status = applicationReviewStatus(body);
    if (!status) return errorResponse('Choose In review, Approved, or Declined.', 400);
    const markPetStatus = reviewPetStatus(body, status);
    const { data: before, error: beforeError } = await client.from('foster_applications').select('status').eq('id', match[1]).maybeSingle();
    if (beforeError) return databaseError('admin.foster_applications.lookup', beforeError);
    if (!before) return errorResponse('Foster application not found.', 404);
    const { data, error } = await client.from('foster_applications').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: current.user.id,
    }).eq('id', match[1]).select('*').maybeSingle();
    if (error) return databaseError('admin.foster_applications.review', error);
    if (!data) return errorResponse('Foster application not found.', 404);
    const application = data as DatabaseFosterApplication;
    if (before.status !== status) {
      notify(context, fosterOutcomeEmail({ to: application.applicant_email, name: application.applicant_name, petName: application.pet_name, status }));
    }
    let petStatusUpdate: PetStatusUpdate = 'not_requested';
    if (markPetStatus) {
      const { error: petError } = await client.from('pets').update({ status: markPetStatus }).eq('id', application.pet_id);
      if (petError) console.error(JSON.stringify({ operation: 'admin.foster_applications.pet_status', error: petError.message }));
      petStatusUpdate = petError ? 'failed' : 'applied';
    }
    return respond({ ...fosterApplicationForClient(application), petStatusUpdate });
  }

  return null;
}
