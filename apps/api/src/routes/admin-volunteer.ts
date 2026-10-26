import type { AdminVolunteerShiftListResponse } from '@pawheaven/contracts';
import { notify } from '../lib/email';
import { volunteerShiftCanceledEmail } from '../lib/email-templates';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';
import {
  adminVolunteerShiftForClient,
  volunteerMutationError,
  volunteerShiftInput,
  type DatabaseVolunteerRegistration,
  type DatabaseVolunteerShift,
} from '../lib/volunteer';

export async function adminVolunteerRoutes(context: AdminContext): Promise<ApiResponse | null> {
  const { request, env, path, current } = context;
  if (!path.startsWith('/admin/volunteer-shifts')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/volunteer-shifts' && request.method === 'GET') {
    const [shiftsResult, registrationsResult] = await Promise.all([
      client.from('volunteer_shifts').select('*').order('starts_at', { ascending: true }).limit(500),
      client.from('volunteer_registrations').select('*').eq('status', 'registered').order('created_at', { ascending: true }).limit(5000),
    ]);
    if (shiftsResult.error) return databaseError('admin.volunteer_shifts.list', shiftsResult.error);
    if (registrationsResult.error) return databaseError('admin.volunteer_shifts.registrations', registrationsResult.error);
    const byShift = new Map<string, DatabaseVolunteerRegistration[]>();
    for (const registration of registrationsResult.data as DatabaseVolunteerRegistration[]) {
      byShift.set(registration.shift_id, [...(byShift.get(registration.shift_id) ?? []), registration]);
    }
    const payload: AdminVolunteerShiftListResponse = {
      shifts: (shiftsResult.data as DatabaseVolunteerShift[]).map((shift) => adminVolunteerShiftForClient(shift, byShift.get(shift.id) ?? [])),
    };
    return respond(payload);
  }

  if (path === '/admin/volunteer-shifts' && request.method === 'POST') {
    const parsed = volunteerShiftInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { data, error } = await client.rpc('create_volunteer_shift', {
      p_title: parsed.value.title,
      p_description: parsed.value.description,
      p_requirements: parsed.value.requirements,
      p_min_age: parsed.value.minAge,
      p_starts_at: parsed.value.startsAt,
      p_ends_at: parsed.value.endsAt,
      p_capacity: parsed.value.capacity,
    });
    if (error) return volunteerMutationError('admin.volunteer_shifts.create', error);
    return respond({ id: data }, 201);
  }

  const shiftMatch = path.match(/^\/admin\/volunteer-shifts\/([0-9a-f-]{36})$/i);
  if (shiftMatch && request.method === 'PUT') {
    const parsed = volunteerShiftInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { error } = await client.rpc('update_volunteer_shift', {
      p_shift_id: shiftMatch[1],
      p_title: parsed.value.title,
      p_description: parsed.value.description,
      p_requirements: parsed.value.requirements,
      p_min_age: parsed.value.minAge,
      p_starts_at: parsed.value.startsAt,
      p_ends_at: parsed.value.endsAt,
      p_capacity: parsed.value.capacity,
    });
    if (error) return volunteerMutationError('admin.volunteer_shifts.update', error);
    return respond({ ok: true });
  }

  const cancelMatch = path.match(/^\/admin\/volunteer-shifts\/([0-9a-f-]{36})\/cancel$/i);
  if (cancelMatch && request.method === 'POST') {
    const { data: shift, error: shiftError } = await client.from('volunteer_shifts').select('*').eq('id', cancelMatch[1]).maybeSingle();
    if (shiftError) return databaseError('admin.volunteer_shifts.lookup', shiftError);
    if (!shift) return errorResponse('Volunteer shift not found.', 404);
    const { data, error } = await client.rpc('cancel_volunteer_shift', { p_shift_id: cancelMatch[1] });
    if (error) return volunteerMutationError('admin.volunteer_shifts.cancel', error);
    const details = shift as DatabaseVolunteerShift;
    const affected = data as { member_name: string; member_email: string }[];
    for (const volunteer of affected) {
      notify(context, volunteerShiftCanceledEmail({ to: volunteer.member_email, name: volunteer.member_name, title: details.title, startsAt: details.starts_at, endsAt: details.ends_at }));
    }
    return respond({ ok: true, notified: affected.length });
  }

  return null;
}
