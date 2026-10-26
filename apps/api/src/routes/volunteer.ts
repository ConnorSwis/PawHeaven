import type { VolunteerRegistrationListResponse, VolunteerShiftListResponse } from '@pawheaven/contracts';
import { notify } from '../lib/email';
import { volunteerRegistrationEmail } from '../lib/email-templates';
import { errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { apiUser, clearSession, identity, sessionResponse, type Identity, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';
import {
  registerVolunteerInput,
  volunteerMutationError,
  volunteerRegistrationForClient,
  volunteerShiftForClient,
  type DatabaseMemberVolunteerRegistration,
  type DatabaseVolunteerShiftListing,
} from '../lib/volunteer';

/** Emails the member the outcome of a registration change. Never blocks or fails the change. */
async function sendRegistrationConfirmation(
  context: RouteContext,
  current: Identity,
  client: ReturnType<typeof userSupabase>,
  registrationId: string,
  event: 'registered' | 'canceled',
): Promise<void> {
  const { data, error } = await client.rpc('list_my_volunteer_registrations');
  const registration = error ? undefined : (data as DatabaseMemberVolunteerRegistration[]).find((item) => item.id === registrationId);
  const user = apiUser(current.user);
  if (!registration || !user.email) return;
  notify(context, volunteerRegistrationEmail({
    to: user.email,
    name: user.name,
    event,
    title: registration.title,
    startsAt: registration.starts_at,
    endsAt: registration.ends_at,
    requirements: event === 'registered' ? registration.requirements : undefined,
  }));
}

export async function volunteerRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to volunteer with the shelter.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/volunteer/shifts' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_volunteer_shifts');
    if (error) return sessionResponse(volunteerMutationError('volunteer.shifts.list', error), request, current);
    const payload: VolunteerShiftListResponse = { shifts: (data as DatabaseVolunteerShiftListing[]).map(volunteerShiftForClient) };
    return sessionResponse(respond(payload), request, current);
  }

  if (path === '/volunteer/registrations' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_my_volunteer_registrations');
    if (error) return sessionResponse(volunteerMutationError('volunteer.registrations.list', error), request, current);
    const payload: VolunteerRegistrationListResponse = { registrations: (data as DatabaseMemberVolunteerRegistration[]).map(volunteerRegistrationForClient) };
    return sessionResponse(respond(payload), request, current);
  }

  const registerMatch = path.match(/^\/volunteer\/shifts\/([0-9a-f-]{36})\/register$/i);
  if (registerMatch && request.method === 'POST') {
    const parsed = registerVolunteerInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return sessionResponse(validationResponse(parsed.fieldErrors), request, current);
    const { data, error } = await client.rpc('register_for_volunteer_shift', {
      p_shift_id: registerMatch[1],
      p_phone: parsed.value.phone,
      p_date_of_birth: parsed.value.dateOfBirth,
    });
    if (error) return sessionResponse(volunteerMutationError('volunteer.register', error), request, current);
    await sendRegistrationConfirmation(context, current, client, data as string, 'registered');
    return sessionResponse(respond({ registrationId: data }, 201), request, current);
  }

  const cancelMatch = path.match(/^\/volunteer\/registrations\/([0-9a-f-]{36})\/cancel$/i);
  if (cancelMatch && request.method === 'POST') {
    const { error } = await client.rpc('cancel_volunteer_registration', { p_registration_id: cancelMatch[1] });
    if (error) return sessionResponse(volunteerMutationError('volunteer.cancel', error), request, current);
    await sendRegistrationConfirmation(context, current, client, cancelMatch[1], 'canceled');
    return sessionResponse(respond({ ok: true }), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
