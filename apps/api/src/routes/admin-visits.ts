import type { AdminVisitAppointment, AdminVisitScheduleResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, UUID_PATTERN, type ApiResponse } from '../lib/http';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';
import { publishVisitSlotInput, visitMutationError, type DatabaseAppointment, type DatabaseVisitSlot } from '../lib/visits';

export async function adminVisitRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/visit-slots')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/visit-slots' && request.method === 'GET') {
    const [slotsResult, appointmentsResult, petsResult] = await Promise.all([
      client.from('visit_slots').select('*').order('starts_at', { ascending: true }).limit(2000),
      client.from('appointments').select('*').eq('status', 'booked').limit(5000),
      client.from('appointment_pets').select('appointment_id, pet_id, pet_name').limit(10000),
    ]);
    if (slotsResult.error) return databaseError('admin.visit_slots.list', slotsResult.error);
    if (appointmentsResult.error) return databaseError('admin.visit_slots.appointments', appointmentsResult.error);
    if (petsResult.error) return databaseError('admin.visit_slots.pets', petsResult.error);
    const petsByAppointment = new Map<string, { id: string; name: string }[]>();
    for (const row of petsResult.data as { appointment_id: string; pet_id: string; pet_name: string }[]) {
      petsByAppointment.set(row.appointment_id, [...(petsByAppointment.get(row.appointment_id) ?? []), { id: row.pet_id, name: row.pet_name }]);
    }
    const bySlot = new Map<string, AdminVisitAppointment[]>();
    for (const appointment of appointmentsResult.data as DatabaseAppointment[]) {
      bySlot.set(appointment.slot_id, [...(bySlot.get(appointment.slot_id) ?? []), {
        id: appointment.id,
        memberId: appointment.member_id,
        memberName: appointment.member_name,
        memberEmail: appointment.member_email,
        purpose: appointment.purpose,
        status: appointment.status,
        createdAt: appointment.created_at,
        updatedAt: appointment.updated_at,
        partySize: appointment.party_size ?? 1,
        pets: petsByAppointment.get(appointment.id) ?? [],
      }]);
    }
    const payload: AdminVisitScheduleResponse = {
      slots: (slotsResult.data as DatabaseVisitSlot[]).map((slot) => {
        const appointments = bySlot.get(slot.id) ?? [];
        return {
          id: slot.id,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          status: slot.status,
          createdAt: slot.created_at,
          capacity: slot.capacity ?? 1,
          ruleId: slot.rule_id ?? null,
          eventId: slot.event_id ?? null,
          appointment: appointments[0] ?? null,
          appointments,
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
      p_capacity: parsed.value.capacity ?? 1,
    });
    if (error) return visitMutationError('admin.visit_slots.publish', error);
    return respond({ id: data }, 201);
  }

  const capacityMatch = path.match(/^\/admin\/visit-slots\/([0-9a-f-]{36})\/capacity$/i);
  if (capacityMatch && request.method === 'PUT') {
    const body = await jsonBody(request) as { capacity?: unknown } | null;
    const capacity = Number(body?.capacity);
    if (!UUID_PATTERN.test(capacityMatch[1]) || !Number.isInteger(capacity)) return errorResponse('Visit capacity must be between 1 and 50 groups.', 400);
    const { error } = await client.rpc('set_visit_slot_capacity', { p_slot_id: capacityMatch[1], p_capacity: capacity });
    if (error) return visitMutationError('admin.visit_slots.capacity', error);
    return respond({ ok: true });
  }

  const withdrawMatch = path.match(/^\/admin\/visit-slots\/([0-9a-f-]{36})\/withdraw$/i);
  if (withdrawMatch && request.method === 'POST') {
    const { error } = await client.rpc('withdraw_visit_slot', { p_slot_id: withdrawMatch[1] });
    if (error) return visitMutationError('admin.visit_slots.withdraw', error);
    return respond({ ok: true });
  }

  return null;
}
