import type {
  AdminFosterRequest,
  AvailabilityResponse,
  GenerateAvailabilityResponse,
  ShelterEvent,
} from '@pawheaven/contracts';
import { notify } from '../lib/email';
import { fosterInvitationEmail, fosterRequestEmail } from '../lib/email-templates';
import { databaseError, errorResponse, jsonBody, respond, rpcErrorResponse, UUID_PATTERN, validationResponse, type ApiResponse } from '../lib/http';
import {
  attentionForClient,
  candidateForClient,
  copyWeekInput,
  eventForClient,
  eventInput,
  exceptionInput,
  petFlagsInput,
  ruleForClient,
  ruleInput,
  type DatabaseRule,
} from '../lib/schedule';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

const rpcError = (operation: string, error: { message: string; code?: string }) =>
  rpcErrorResponse(operation, error, { expired: 'Your session has expired. Log in again to manage the schedule.' });

/**
 * Staff tools for the schedule and the people pipeline: recurring open hours, copy-week, open-house
 * events, pet quick actions, foster requests and invitations, and the "needs attention" report.
 */
export async function adminScheduleRoutes(context: AdminContext): Promise<ApiResponse | null> {
  const { request, env, path, current } = context;
  const scoped = ['/admin/availability', '/admin/schedule', '/admin/events', '/admin/pets/flags', '/admin/foster-requests', '/admin/volunteer-foster-candidates', '/admin/attention'];
  if (!scoped.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/attention' && request.method === 'GET') {
    const { data, error } = await client.rpc('staff_attention');
    if (error) return rpcError('admin.attention', error);
    return respond({ items: attentionForClient(data) });
  }

  // Recurring open hours ----------------------------------------------------------------------
  if (path === '/admin/availability' && request.method === 'GET') {
    const [rules, exceptions] = await Promise.all([
      client.from('availability_rules').select('*').order('weekday').order('start_time'),
      client.from('availability_exceptions').select('on_date, reason').gte('on_date', new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)).order('on_date'),
    ]);
    if (rules.error) return databaseError('admin.availability.rules', rules.error);
    if (exceptions.error) return databaseError('admin.availability.exceptions', exceptions.error);
    const payload: AvailabilityResponse = {
      rules: (rules.data as DatabaseRule[]).map(ruleForClient),
      exceptions: (exceptions.data as { on_date: string; reason: string }[]).map((row) => ({ date: row.on_date, reason: row.reason })),
    };
    return respond(payload);
  }

  const saveRule = async (id: string | null) => {
    const parsed = ruleInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const v = parsed.value;
    const { data, error } = await client.rpc('save_availability_rule', {
      p_id: id, p_kind: v.kind, p_weekday: v.weekday, p_start_time: v.startTime, p_end_time: v.endTime, p_capacity: v.capacity,
      p_slot_minutes: v.slotMinutes, p_title: v.title, p_description: v.description, p_requirements: v.requirements,
      p_min_age: v.minAge, p_weeks_ahead: v.weeksAhead, p_active: v.active,
    });
    if (error) return rpcError('admin.availability.save', error);
    return respond({ id: data }, id ? 200 : 201);
  };
  if (path === '/admin/availability/rules' && request.method === 'POST') return saveRule(null);
  const ruleMatch = path.match(/^\/admin\/availability\/rules\/([0-9a-f-]{36})$/i);
  if (ruleMatch && request.method === 'PUT') return saveRule(ruleMatch[1]);
  if (ruleMatch && request.method === 'DELETE') {
    const { error } = await client.rpc('delete_availability_rule', { p_id: ruleMatch[1] });
    if (error) return rpcError('admin.availability.delete', error);
    return respond({ ok: true });
  }

  if (path === '/admin/availability/generate' && request.method === 'POST') {
    const { data, error } = await client.rpc('generate_availability');
    if (error) return rpcError('admin.availability.generate', error);
    const row = (data as { visits_created: number; shifts_created: number }[])[0];
    const payload: GenerateAvailabilityResponse = { visitsCreated: row?.visits_created ?? 0, shiftsCreated: row?.shifts_created ?? 0 };
    return respond(payload);
  }

  if (path === '/admin/availability/exceptions' && request.method === 'POST') {
    const parsed = exceptionInput(await jsonBody(request));
    if ('message' in parsed) return errorResponse(parsed.message, 400);
    const { data, error } = await client.rpc('add_availability_exception', { p_on_date: parsed.value.date, p_reason: parsed.value.reason });
    if (error) return rpcError('admin.availability.exception', error);
    const row = (data as { visits_removed: number; shifts_removed: number; kept: number }[])[0];
    return respond({ visitsRemoved: row?.visits_removed ?? 0, shiftsRemoved: row?.shifts_removed ?? 0, kept: row?.kept ?? 0 }, 201);
  }
  const exceptionMatch = path.match(/^\/admin\/availability\/exceptions\/(\d{4}-\d{2}-\d{2})$/);
  if (exceptionMatch && request.method === 'DELETE') {
    const { error } = await client.rpc('remove_availability_exception', { p_on_date: exceptionMatch[1] });
    if (error) return rpcError('admin.availability.exception.remove', error);
    return respond({ ok: true });
  }

  if (path === '/admin/schedule/copy-week' && request.method === 'POST') {
    const parsed = copyWeekInput(await jsonBody(request));
    if ('message' in parsed) return errorResponse(parsed.message, 400);
    const { data, error } = await client.rpc('copy_schedule_week', { p_from_week: parsed.value.from, p_to_week: parsed.value.to });
    if (error) return rpcError('admin.schedule.copy', error);
    const row = (data as { visits_created: number; shifts_created: number }[])[0];
    const payload: GenerateAvailabilityResponse = { visitsCreated: row?.visits_created ?? 0, shiftsCreated: row?.shifts_created ?? 0 };
    return respond(payload);
  }

  // Events ------------------------------------------------------------------------------------
  if (path === '/admin/events' && request.method === 'GET') {
    const [events, pets] = await Promise.all([
      client.from('events').select('*').order('starts_at', { ascending: true }).limit(200),
      client.from('pets').select('id, name').limit(1000),
    ]);
    if (events.error) return databaseError('admin.events.list', events.error);
    if (pets.error) return databaseError('admin.events.pets', pets.error);
    const names = new Map((pets.data as { id: string; name: string }[]).map((pet) => [pet.id, pet.name]));
    const payload: { events: ShelterEvent[] } = { events: (events.data as Parameters<typeof eventForClient>[0][]).map((row) => eventForClient(row, names)) };
    return respond(payload);
  }
  if (path === '/admin/events' && request.method === 'POST') {
    const parsed = eventInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const v = parsed.value;
    const { data, error } = await client.rpc('create_event', {
      p_title: v.title, p_description: v.description, p_starts_at: v.startsAt, p_ends_at: v.endsAt,
      p_visit_capacity: v.visitCapacity, p_slot_minutes: v.slotMinutes, p_roles: v.roles, p_pet_ids: v.petIds,
    });
    if (error) return rpcError('admin.events.create', error);
    return respond({ id: data }, 201);
  }

  // Pet quick actions -------------------------------------------------------------------------
  if (path === '/admin/pets/flags' && request.method === 'POST') {
    const parsed = petFlagsInput(await jsonBody(request));
    if ('message' in parsed) return errorResponse(parsed.message, 400);
    const { data, error } = await client.rpc('set_pet_flags', {
      p_pet_ids: parsed.value.petIds,
      p_foster_available: parsed.value.fosterAvailable ?? null,
      p_visits_open: parsed.value.visitsOpen ?? null,
      p_needs_walkers: parsed.value.needsWalkers ?? null,
    });
    if (error) return rpcError('admin.pets.flags', error);
    return respond({ updated: data });
  }

  // Foster requests (pool alerts) -------------------------------------------------------------
  if (path === '/admin/foster-requests' && request.method === 'GET') {
    const [requests, responses, pets] = await Promise.all([
      client.from('foster_requests').select('*').order('created_at', { ascending: false }).limit(100),
      client.from('foster_request_responses').select('request_id, response').limit(5000),
      client.from('pets').select('id, name').limit(1000),
    ]);
    if (requests.error) return databaseError('admin.foster_requests.list', requests.error);
    if (responses.error) return databaseError('admin.foster_requests.responses', responses.error);
    if (pets.error) return databaseError('admin.foster_requests.pets', pets.error);
    const names = new Map((pets.data as { id: string; name: string }[]).map((pet) => [pet.id, pet.name]));
    const counts = new Map<string, { notified: number; accepted: number; declined: number }>();
    for (const row of responses.data as { request_id: string; response: string }[]) {
      const entry = counts.get(row.request_id) ?? { notified: 0, accepted: 0, declined: 0 };
      entry.notified += 1;
      if (row.response === 'accepted') entry.accepted += 1;
      if (row.response === 'declined') entry.declined += 1;
      counts.set(row.request_id, entry);
    }
    const list: AdminFosterRequest[] = (requests.data as { id: string; pet_id: string; note: string; created_at: string; closed_at: string | null }[]).map((row) => ({
      id: row.id, petId: row.pet_id, petName: names.get(row.pet_id) ?? 'Unknown pet', note: row.note, createdAt: row.created_at, closedAt: row.closed_at,
      ...(counts.get(row.id) ?? { notified: 0, accepted: 0, declined: 0 }),
    }));
    return respond({ requests: list });
  }
  if (path === '/admin/foster-requests' && request.method === 'POST') {
    const body = await jsonBody(request) as { petId?: unknown; note?: unknown } | null;
    const petId = typeof body?.petId === 'string' ? body.petId : '';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (!UUID_PATTERN.test(petId)) return errorResponse('Choose a pet.', 400);
    if (note.length > 500) return errorResponse('Keep the note under 500 characters.', 400);
    const { data, error } = await client.rpc('create_foster_request', { p_pet_id: petId, p_note: note });
    if (error) return rpcError('admin.foster_requests.create', error);
    const recipients = data as { member_name: string; member_email: string; pet_name: string }[];
    for (const person of recipients) notify(context, fosterRequestEmail({ to: person.member_email, name: person.member_name, petName: person.pet_name, note }));
    return respond({ notified: recipients.length }, 201);
  }
  const closeMatch = path.match(/^\/admin\/foster-requests\/([0-9a-f-]{36})\/close$/i);
  if (closeMatch && request.method === 'POST') {
    const { error } = await client.rpc('close_foster_request', { p_request_id: closeMatch[1] });
    if (error) return rpcError('admin.foster_requests.close', error);
    return respond({ ok: true });
  }

  // Volunteers who might foster ---------------------------------------------------------------
  if (path === '/admin/volunteer-foster-candidates' && request.method === 'GET') {
    const { data, error } = await client.rpc('volunteer_foster_candidates');
    if (error) return rpcError('admin.foster_candidates', error);
    return respond({ candidates: (data as Parameters<typeof candidateForClient>[0][]).map(candidateForClient) });
  }
  const inviteMatch = path.match(/^\/admin\/volunteer-foster-candidates\/([0-9a-f-]{36})\/invite$/i);
  if (inviteMatch && request.method === 'POST') {
    const { data, error } = await client.rpc('invite_volunteer_to_foster', { p_member_id: inviteMatch[1] });
    if (error) return rpcError('admin.foster_candidates.invite', error);
    const person = (data as { member_name: string; member_email: string }[])[0];
    if (person) notify(context, fosterInvitationEmail({ to: person.member_email, name: person.member_name }));
    return respond({ ok: true });
  }

  return errorResponse('Not found.', 404);
}
