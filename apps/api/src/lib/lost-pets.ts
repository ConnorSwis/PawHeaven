import type {
  AdminLostPetInquiry,
  FieldErrors,
  LostPetInquiry,
  LostPetInquiryInput,
  LostPetInquiryStatus,
  LostPetSpecies,
} from '@pawheaven/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bytesToBase64, type LostPetCandidate } from './ai-matching';
import { validPhone } from './applications';
import { rpcErrorResponse, UUID_PATTERN, type ApiResponse } from './http';
import { supabase } from './supabase';

export const LOST_PET_BUCKET = 'lost-pet-uploads';

export type DatabaseLostPetCandidate = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_label: string;
  status: string;
  image_path: string;
};

export type DatabaseLostPetInquiry = {
  id: string;
  search_id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  pet_id: string | null;
  pet_name: string;
  message: string;
  status: LostPetInquiryStatus;
  staff_note: string;
  handled_at: string | null;
  created_at: string;
};

export type DatabaseLostPetSearch = {
  id: string;
  species: LostPetSpecies;
  description: string;
  photo_paths: string[];
};

export function lostPetCandidateForAi(row: DatabaseLostPetCandidate, env: Env): LostPetCandidate {
  return {
    id: row.id,
    name: row.name,
    type: row.species,
    breed: row.breed,
    age: row.age_label,
    status: row.status,
    imageUrl: supabase(env).storage.from('pet-images').getPublicUrl(row.image_path).data.publicUrl,
  };
}

/**
 * Production candidate photos are public Supabase URLs the model provider can
 * fetch itself. A local Supabase URL is unreachable from outside, so local
 * development downloads the photo and sends it inline instead.
 */
export async function candidateImageReference(env: Env, imageUrl: string): Promise<string | null> {
  if (String(env.DEPLOYMENT_TARGET) !== 'local') return imageUrl;
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) return null;
    const type = response.headers.get('Content-Type')?.split(';')[0] ?? 'image/jpeg';
    return `data:${type};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

export function lostPetInquiryInput(body: unknown): { value: LostPetInquiryInput } | { fieldErrors: FieldErrors } {
  const input = body as Record<string, unknown> | null;
  const text = (key: string) => typeof input?.[key] === 'string' ? (input[key] as string).trim() : '';
  const searchId = text('searchId');
  const petId = text('petId');
  const phone = text('phone');
  const message = text('message');
  const errors: FieldErrors = {};
  if (!UUID_PATTERN.test(searchId) || !UUID_PATTERN.test(petId)) errors.petId = 'Choose one of the possible matches to ask about.';
  if (!phone) errors.phone = 'Enter a phone number where the shelter can reach you.';
  else if (!validPhone(phone)) errors.phone = 'Enter a valid phone number with at least 10 digits.';
  if (message.length < 10) errors.message = 'Tell the shelter a little more, at least 10 characters. Include when and where your pet went missing.';
  else if (message.length > 1000) errors.message = 'Keep your message under 1,000 characters.';
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { value: { searchId, petId, phone, message } };
}

export function lostPetInquiryForClient(row: DatabaseLostPetInquiry): LostPetInquiry {
  return {
    id: row.id,
    petId: row.pet_id,
    petName: row.pet_name,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function adminLostPetInquiryForClient(
  row: DatabaseLostPetInquiry,
  search: DatabaseLostPetSearch | undefined,
  petImageUrl: string | null,
  photoUrls: string[],
): AdminLostPetInquiry {
  return {
    ...lostPetInquiryForClient(row),
    memberName: row.member_name,
    memberEmail: row.member_email,
    memberPhone: row.member_phone,
    staffNote: row.staff_note,
    handledAt: row.handled_at,
    petImageUrl,
    searchSpecies: search?.species ?? 'Other',
    searchDescription: search?.description ?? '',
    photoUrls,
  };
}

export function lostPetStatusInput(body: unknown): { status: LostPetInquiryStatus; staffNote: string } | null {
  const input = body as Record<string, unknown> | null;
  const status = input?.status;
  const staffNote = typeof input?.staffNote === 'string' ? input.staffNote.trim() : '';
  if ((status !== 'New' && status !== 'In progress' && status !== 'Resolved') || staffNote.length > 1000) return null;
  return { status, staffNote };
}

export function lostPetError(operation: string, error: { message: string; code?: string }): ApiResponse {
  return rpcErrorResponse(operation, error, {
    expired: 'Your session has expired. Log in again to continue.',
    duplicate: 'You already sent the shelter a message about this animal.',
  });
}

/**
 * Deletes expired lost-pet searches, their inquiries (by cascade), and their
 * photos. Members only reach their own rows and objects; staff reach all.
 * Returns the number of searches removed; failures are logged, never thrown,
 * because cleanup must not block the request that triggered it.
 */
export async function purgeExpiredLostPetData(client: SupabaseClient, memberId?: string): Promise<number> {
  try {
    let query = client.from('lost_pet_searches').select('id, photo_paths').lte('expires_at', new Date().toISOString()).limit(200);
    if (memberId) query = query.eq('member_id', memberId);
    const { data, error } = await query;
    if (error || !data?.length) return 0;
    const paths = (data as { photo_paths: string[] }[]).flatMap((row) => row.photo_paths);
    if (paths.length) await client.storage.from(LOST_PET_BUCKET).remove(paths);
    const { error: deleteError } = await client.from('lost_pet_searches').delete().in('id', (data as { id: string }[]).map((row) => row.id));
    return deleteError ? 0 : data.length;
  } catch (error) {
    console.error(JSON.stringify({ operation: 'lost_pet.purge', error: error instanceof Error ? error.message : 'Unknown error' }));
    return 0;
  }
}
