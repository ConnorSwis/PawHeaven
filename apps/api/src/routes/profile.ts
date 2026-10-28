import type { MemberProfileResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { profileForClient, profileInput, type DatabaseMemberProfile } from '../lib/profile';
import { clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

/** GET and PUT /profile: the signed-in member's saved contact details, used only to prefill forms. */
export async function profileRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to manage your saved details.', 401), request);
  const client = userSupabase(env, current.accessToken);
  if (path !== '/profile') return sessionResponse(errorResponse('Not found.', 404), request, current);

  if (request.method === 'GET') {
    const { data, error } = await client.from('member_profiles').select('user_id, phone, address, date_of_birth').eq('user_id', current.user.id).maybeSingle();
    if (error) return sessionResponse(databaseError('profile.get', error), request, current);
    const payload: MemberProfileResponse = { profile: profileForClient(data as DatabaseMemberProfile | null) };
    return sessionResponse(respond(payload), request, current);
  }

  if (request.method === 'PUT') {
    const parsed = profileInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return sessionResponse(validationResponse(parsed.fieldErrors), request, current);
    const { data, error } = await client.from('member_profiles').upsert({
      user_id: current.user.id,
      phone: parsed.value.phone || null,
      address: parsed.value.address || null,
      date_of_birth: parsed.value.dateOfBirth || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select('user_id, phone, address, date_of_birth').single();
    if (error) return sessionResponse(databaseError('profile.save', error), request, current);
    const payload: MemberProfileResponse = { profile: profileForClient(data as DatabaseMemberProfile) };
    return sessionResponse(respond(payload), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
