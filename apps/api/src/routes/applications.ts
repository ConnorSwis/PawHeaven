import type { AdoptionApplicationListResponse } from '@pawheaven/contracts';
import { adoptionApplicationInput, applicationForClient, type DatabaseAdoptionApplication } from '../lib/applications';
import { notify } from '../lib/email';
import { applicationReceivedEmail } from '../lib/email-templates';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { apiUser, clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

export async function adoptionApplicationRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in before submitting an adoption application.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/applications' && request.method === 'GET') {
    const { data, error } = await client.from('adoption_applications').select('*').eq('applicant_id', current.user.id).order('submitted_at', { ascending: false }).limit(100);
    if (error) return sessionResponse(databaseError('applications.list', error), request, current);
    const payload: AdoptionApplicationListResponse = { applications: (data as DatabaseAdoptionApplication[]).map(applicationForClient) };
    return sessionResponse(respond(payload), request, current);
  }

  const petMatch = path.match(/^\/applications\/pets\/([0-9a-f-]{36})$/i);
  if (petMatch && request.method === 'POST') {
    const parsed = adoptionApplicationInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return sessionResponse(validationResponse(parsed.fieldErrors), request, current);
    const { data: pet, error: petError } = await client.from('pets').select('id, name').eq('id', petMatch[1]).eq('status', 'Available').maybeSingle();
    if (petError) return sessionResponse(databaseError('applications.pet_lookup', petError), request, current);
    if (!pet) return sessionResponse(errorResponse('This pet is no longer available for new applications.', 409), request, current);
    const applicant = apiUser(current.user);
    const { data, error } = await client.from('adoption_applications').insert({
      applicant_id: applicant.id,
      applicant_name: applicant.name,
      applicant_email: applicant.email,
      applicant_phone: parsed.value.applicantPhone,
      applicant_address: parsed.value.applicantAddress,
      applicant_date_of_birth: parsed.value.applicantDateOfBirth,
      pet_id: pet.id,
      pet_name: pet.name,
      household_summary: parsed.value.householdSummary,
      adoption_experience: parsed.value.adoptionExperience,
      note: parsed.value.note,
    }).select('*').single();
    if (error?.code === '23505') return sessionResponse(errorResponse('You already submitted an application for this pet.', 409), request, current);
    if (error?.code === '42501') return sessionResponse(errorResponse('This pet is no longer available for new applications.', 409), request, current);
    if (error) return sessionResponse(databaseError('applications.create', error), request, current);
    notify(context, applicationReceivedEmail({ to: applicant.email, name: applicant.name, petName: pet.name }));
    return sessionResponse(respond(applicationForClient(data as DatabaseAdoptionApplication), 201), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
