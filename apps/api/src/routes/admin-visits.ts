import type { AdminVisitScheduleResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';
import { publishVisitSlotInput, visitMutationError, type DatabaseAppointment, type DatabaseVisitSlot } from '../lib/visits';

export async function adminVisitRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/visit-slots')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/visit-slots' && request.method === 'GET') {
    const [slotsResult, appointmentsResult] = await Promise.all([
      client.from('visit_slots').select('*').order('starts_at', { ascending: true }).limit(500),
      client.from('appointments').select('*').eq('status', 'booked').limit(500),
    ]);
    if (slotsResult.error) return databaseError('admin.visit_slots.list', slotsResult.error);
    if (appointmentsResult.error) return databaseError('admin.visit_slots.appointments', appointmentsResult.error);
    const appointmentBySlot = new Map((appointmentsResult.data as DatabaseAppointment[]).map((appointment) => [appointment.slot_id, appointment]));
    const payload: AdminVisitScheduleResponse = {
      slots: (slotsResult.data as DatabaseVisitSlot[]).map((slot) => {
        const appointment = appointmentBySlot.get(slot.id);
        return {
          id: slot.id,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          status: slot.status,
          createdAt: slot.created_at,
          appointment: appointment ? {
            id: appointment.id,
            memberId: appointment.member_id,
            memberName: appointment.member_name,
            memberEmail: appointment.member_email,
            purpose: appointment.purpose,
            status: appointment.status,
            createdAt: appointment.created_at,
            updatedAt: appointment.updated_at,
          } : null,
        };
      }),
    };
    return respond(payload);
  }

  if (path === '/admin/visit-slots' && request.method === 'POST') {
    const parsed = publishVisitSlotInput(await jsonBody(request));
    if ('message' in parsed) return errorResponse(parsed.message, 400);
    const { data, error } = await client.rpc('publish_visit_slot', {
      p_starts_at: parsed.value.startsAt,
      p_ends_at: parsed.value.endsAt,
    });
    if (error) return visitMutationError('admin.visit_slots.publish', error);
    return respond({ id: data }, 201);
  }

  const withdrawMatch = path.match(/^\/admin\/visit-slots\/([0-9a-f-]{36})\/withdraw$/i);
  if (withdrawMatch && request.method === 'POST') {
    const { error } = await client.rpc('withdraw_visit_slot', { p_slot_id: withdrawMatch[1] });
    if (error) return visitMutationError('admin.visit_slots.withdraw', error);
    return respond({ ok: true });
  }

  return null;
}
