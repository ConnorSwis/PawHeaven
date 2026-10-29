import type { VisitAppointmentListResponse, VisitSlotListResponse, AppointmentEventType } from '@pawheaven/contracts';
import { notify } from '../lib/email';
import { appointmentEmail } from '../lib/email-templates';
import { errorResponse, jsonBody, respond, type ApiResponse } from '../lib/http';
import { apiUser, clearSession, identity, sessionResponse, type Identity, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';
import {
  appointmentEventForClient,
  bookVisitInput,
  rescheduleVisitInput,
  visitAppointmentForClient,
  visitMutationError,
  visitSlotForClient,
  type DatabaseAppointmentEvent,
  type DatabaseAvailabilitySlot,
  type DatabaseMemberAppointment,
} from '../lib/visits';

/** Emails the member the confirmation for an appointment change. Never blocks or fails the change. */
async function sendAppointmentConfirmation(
  context: RouteContext,
  current: Identity,
  client: ReturnType<typeof userSupabase>,
  appointmentId: string,
  event: AppointmentEventType,
): Promise<void> {
  const { data, error } = await client.rpc('list_my_appointments');
  const appointment = error ? undefined : (data as DatabaseMemberAppointment[]).find((item) => item.id === appointmentId);
  const user = apiUser(current.user);
  if (!appointment || !user.email) return;
  notify(context, appointmentEmail({
    to: user.email,
    name: user.name,
    event,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    purpose: event === 'canceled' ? undefined : appointment.purpose,
  }));
}

export async function visitSchedulingRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to schedule a shelter visit.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/visit-slots' && request.method === 'GET') {
    const { data, error } = await client.rpc('list_visit_slots');
    if (error) return sessionResponse(visitMutationError('visit_slots.list', error), request, current);
    const payload: VisitSlotListResponse = { slots: (data as DatabaseAvailabilitySlot[]).map(visitSlotForClient) };
    return sessionResponse(respond(payload), request, current);
  }

  if (path === '/appointments' && request.method === 'GET') {
    const [appointmentsResult, eventsResult] = await Promise.all([
      client.rpc('list_my_appointments'),
      client.rpc('list_my_appointment_events'),
    ]);
    if (appointmentsResult.error) return sessionResponse(visitMutationError('appointments.list', appointmentsResult.error), request, current);
    if (eventsResult.error) return sessionResponse(visitMutationError('appointments.events.list', eventsResult.error), request, current);
    const payload: VisitAppointmentListResponse = {
      appointments: (appointmentsResult.data as DatabaseMemberAppointment[]).map(visitAppointmentForClient),
      events: (eventsResult.data as DatabaseAppointmentEvent[]).map(appointmentEventForClient),
    };
    return sessionResponse(respond(payload), request, current);
  }

  if (path === '/appointments' && request.method === 'POST') {
    const parsed = bookVisitInput(await jsonBody(request));
    if ('message' in parsed) return sessionResponse(errorResponse(parsed.message, 400), request, current);
    const { data, error } = await client.rpc('book_visit_slot', {
      p_slot_id: parsed.value.slotId,
      p_purpose: parsed.value.purpose,
      p_party_size: parsed.value.partySize ?? 1,
      p_pet_ids: parsed.value.petIds ?? [],
    });
    if (error) return sessionResponse(visitMutationError('appointments.book', error), request, current);
    await sendAppointmentConfirmation(context, current, client, data as string, 'booked');
    return sessionResponse(respond({ appointmentId: data }, 201), request, current);
  }

  const appointmentMatch = path.match(/^\/appointments\/([0-9a-f-]{36})$/i);
  if (appointmentMatch && request.method === 'PUT') {
    const parsed = rescheduleVisitInput(await jsonBody(request));
    if ('message' in parsed) return sessionResponse(errorResponse(parsed.message, 400), request, current);
    const { error } = await client.rpc('reschedule_visit_appointment', {
      p_appointment_id: appointmentMatch[1],
      p_slot_id: parsed.value.slotId,
    });
    if (error) return sessionResponse(visitMutationError('appointments.reschedule', error), request, current);
    await sendAppointmentConfirmation(context, current, client, appointmentMatch[1], 'rescheduled');
    return sessionResponse(respond({ ok: true }), request, current);
  }

  const cancelMatch = path.match(/^\/appointments\/([0-9a-f-]{36})\/cancel$/i);
  if (cancelMatch && request.method === 'POST') {
    const { error } = await client.rpc('cancel_visit_appointment', { p_appointment_id: cancelMatch[1] });
    if (error) return sessionResponse(visitMutationError('appointments.cancel', error), request, current);
    await sendAppointmentConfirmation(context, current, client, cancelMatch[1], 'canceled');
    return sessionResponse(respond({ ok: true }), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
