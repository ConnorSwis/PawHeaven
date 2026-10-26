import type { AdminLostPetInquiryListResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, type ApiResponse } from '../lib/http';
import {
  LOST_PET_BUCKET,
  adminLostPetInquiryForClient,
  lostPetError,
  lostPetStatusInput,
  purgeExpiredLostPetData,
  type DatabaseLostPetInquiry,
  type DatabaseLostPetSearch,
} from '../lib/lost-pets';
import type { AdminContext } from '../lib/session';
import { supabase, userSupabase } from '../lib/supabase';

export async function adminLostPetRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/lost-pet')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/lost-pet-inquiries' && request.method === 'GET') {
    const { data, error } = await client.from('lost_pet_inquiries').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return databaseError('admin.lost_pet.list', error);
    const inquiries = data as DatabaseLostPetInquiry[];
    const searchIds = [...new Set(inquiries.map((row) => row.search_id))];
    const petIds = [...new Set(inquiries.flatMap((row) => row.pet_id ? [row.pet_id] : []))];
    const [searchResult, petResult] = await Promise.all([
      searchIds.length ? client.from('lost_pet_searches').select('id, species, description, photo_paths').in('id', searchIds) : { data: [], error: null },
      petIds.length ? client.from('pets').select('id, image_path').in('id', petIds) : { data: [], error: null },
    ]);
    if (searchResult.error) return databaseError('admin.lost_pet.searches', searchResult.error);
    if (petResult.error) return databaseError('admin.lost_pet.pets', petResult.error);
    const searches = new Map((searchResult.data as DatabaseLostPetSearch[]).map((search) => [search.id, search]));
    const petImages = new Map((petResult.data as { id: string; image_path: string | null }[]).map((pet) => [pet.id, pet.image_path]));
    const payload: AdminLostPetInquiryListResponse = {
      inquiries: await Promise.all(inquiries.map(async (row) => {
        const search = searches.get(row.search_id);
        const photoUrls: string[] = [];
        for (const photoPath of search?.photo_paths ?? []) {
          const { data: signed } = await client.storage.from(LOST_PET_BUCKET).createSignedUrl(photoPath, 900);
          if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
        }
        const imagePath = row.pet_id ? petImages.get(row.pet_id) : null;
        return adminLostPetInquiryForClient(row, search, imagePath ? supabase(env).storage.from('pet-images').getPublicUrl(imagePath).data.publicUrl : null, photoUrls);
      })),
    };
    return respond(payload);
  }

  const match = path.match(/^\/admin\/lost-pet-inquiries\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'PUT') {
    const input = lostPetStatusInput(await jsonBody(request));
    if (!input) return errorResponse('Choose New, In progress, or Resolved and keep the note under 1,000 characters.', 400);
    const { error } = await client.rpc('update_lost_pet_inquiry', { p_inquiry_id: match[1], p_status: input.status, p_note: input.staffNote });
    if (error) return lostPetError('admin.lost_pet.update', error);
    return respond({ ok: true });
  }

  if (path === '/admin/lost-pet/purge-expired' && request.method === 'POST') {
    return respond({ removed: await purgeExpiredLostPetData(client) });
  }

  return null;
}
