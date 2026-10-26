import type { FosterApplicationListResponse } from '@pawheaven/contracts';
import { notify } from '../lib/email';
import { fosterReceivedEmail } from '../lib/email-templates';
import { fosterApplicationForClient, fosterApplicationInput, type DatabaseFosterApplication } from '../lib/foster';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { apiUser, clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

export async function fosterApplicationRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in before submitting a foster application.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/foster-applications' && request.method === 'GET') {
    const { data, error } = await client.from('foster_applications').select('*').eq('applicant_id', current.user.id).order('submitted_at', { ascending: false }).limit(100);
    if (error) return sessionResponse(databaseError('foster_applications.list', error), request, current);
    const payload: FosterApplicationListResponse = { applications: (data as DatabaseFosterApplication[]).map(fosterApplicationForClient) };
    return sessionResponse(respond(payload), request, current);
  }

  const petMatch = path.match(/^\/foster-applications\/pets\/([0-9a-f-]{36})$/i);
  if (petMatch && request.method === 'POST') {
    const parsed = fosterApplicationInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return sessionResponse(validationResponse(parsed.fieldErrors), request, current);
    const { data: pet, error: petError } = await client.from('pets').select('id, name').eq('id', petMatch[1]).eq('status', 'Available').eq('foster_available', true).maybeSingle();
    if (petError) return sessionResponse(databaseError('foster_applications.pet_lookup', petError), request, current);
    if (!pet) return sessionResponse(errorResponse('This pet is not currently open to foster applications.', 409), request, current);
    const applicant = apiUser(current.user);
    const { data, error } = await client.from('foster_applications').insert({
      applicant_id: applicant.id,
      applicant_name: applicant.name,
      applicant_email: applicant.email,
      applicant_phone: parsed.value.applicantPhone,
      applicant_address: parsed.value.applicantAddress,
      applicant_date_of_birth: parsed.value.applicantDateOfBirth,
      pet_id: pet.id,
      pet_name: pet.name,
      household_summary: parsed.value.householdSummary,
      foster_experience: parsed.value.fosterExperience,
      available_from: parsed.value.availableFrom,
      available_until: parsed.value.availableUntil,
      note: parsed.value.note,
    }).select('*').single();
    if (error?.code === '23505') return sessionResponse(errorResponse('You already submitted a foster application for this pet.', 409), request, current);
    if (error?.code === '42501') return sessionResponse(errorResponse('This pet is not currently open to foster applications.', 409), request, current);
    if (error) return sessionResponse(databaseError('foster_applications.create', error), request, current);
    notify(context, fosterReceivedEmail({ to: applicant.email, name: applicant.name, petName: pet.name, availableFrom: parsed.value.availableFrom, availableUntil: parsed.value.availableUntil }));
    return sessionResponse(respond(fosterApplicationForClient(data as DatabaseFosterApplication), 201), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
