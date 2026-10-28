import type { AdminAdoptionApplicationListResponse, PetStatusUpdate } from '@pawheaven/contracts';
import { applicationForClient, applicationReviewStatus, reviewPetStatus, type DatabaseAdoptionApplication } from '../lib/applications';
import { applicationOutcomeEmail } from '../lib/email-templates';
import { notify } from '../lib/email';
import { databaseError, errorResponse, jsonBody, respond, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

export async function adminApplicationRoutes(context: AdminContext): Promise<ApiResponse | null> {
  const { request, env, path, current } = context;
  if (!path.startsWith('/admin/applications')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/applications' && request.method === 'GET') {
    const { data, error } = await client.from('adoption_applications').select('*').order('submitted_at', { ascending: true }).limit(500);
    if (error) return databaseError('admin.applications.list', error);
    const payload: AdminAdoptionApplicationListResponse = { applications: (data as DatabaseAdoptionApplication[]).map(applicationForClient) };
    return respond(payload);
  }

  const match = path.match(/^\/admin\/applications\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'PUT') {
    const body = await jsonBody(request);
    const status = applicationReviewStatus(body);
    if (!status) return errorResponse('Choose In review, Approved, or Declined.', 400);
    const markPetStatus = reviewPetStatus(body, status);
    const { data: before, error: beforeError } = await client.from('adoption_applications').select('status').eq('id', match[1]).maybeSingle();
    if (beforeError) return databaseError('admin.applications.lookup', beforeError);
    if (!before) return errorResponse('Application not found.', 404);
    const { data, error } = await client.from('adoption_applications').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: current.user.id,
    }).eq('id', match[1]).select('*').maybeSingle();
    if (error) return databaseError('admin.applications.review', error);
    if (!data) return errorResponse('Application not found.', 404);
    const application = data as DatabaseAdoptionApplication;
    if (before.status !== status) {
      notify(context, applicationOutcomeEmail({ to: application.applicant_email, name: application.applicant_name, petName: application.pet_name, status }));
    }
    // The shortcut is opt-in per review: an outcome alone never changes a pet.
    let petStatusUpdate: PetStatusUpdate = 'not_requested';
    if (markPetStatus) {
      const { error: petError } = await client.from('pets').update({ status: markPetStatus }).eq('id', application.pet_id);
      if (petError) console.error(JSON.stringify({ operation: 'admin.applications.pet_status', error: petError.message }));
      petStatusUpdate = petError ? 'failed' : 'applied';
    }
    return respond({ ...applicationForClient(application), petStatusUpdate });
  }

  return null;
}
