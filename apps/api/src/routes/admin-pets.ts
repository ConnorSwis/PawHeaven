import type { AdminPetListResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { petForClient, petInput, petRow, type DatabasePet } from '../lib/pets';
import type { AdminContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

const PET_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_PET_IMAGE_BYTES = 5 * 1024 * 1024;

export async function adminPetRoutes({ request, env, path, current }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/pets')) return null;
  const client = userSupabase(env, current.accessToken);

  if (path === '/admin/pets' && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').order('name', { ascending: true }).limit(500);
    if (error) return databaseError('admin.pets.list', error);
    const payload: AdminPetListResponse = { pets: (data as DatabasePet[]).map((pet) => petForClient(pet, env)) };
    return respond(payload);
  }
  if (path === '/admin/pets' && request.method === 'POST') {
    const parsed = petInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { data, error } = await client.from('pets').insert(petRow(parsed.value)).select('*').single();
    if (error) return databaseError('admin.pets.create', error);
    return respond(petForClient(data as DatabasePet, env), 201);
  }

  const petMatch = path.match(/^\/admin\/pets\/([0-9a-f-]{36})$/i);
  if (petMatch && request.method === 'PUT') {
    const parsed = petInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return validationResponse(parsed.fieldErrors);
    const { data, error } = await client.from('pets').update(petRow(parsed.value)).eq('id', petMatch[1]).select('*').maybeSingle();
    if (error) return databaseError('admin.pets.update', error);
    if (!data) return errorResponse('Pet not found.', 404);
    return respond(petForClient(data as DatabasePet, env));
  }
  if (petMatch && request.method === 'DELETE') {
    const { data, error } = await client.from('pets').delete().eq('id', petMatch[1]).select('id').maybeSingle();
    if (error) return databaseError('admin.pets.delete', error);
    if (!data) return errorResponse('Pet not found.', 404);
    return respond({ ok: true });
  }

  const imageMatch = path.match(/^\/admin\/pets\/([0-9a-f-]{36})\/image$/i);
  if (imageMatch && request.method === 'POST') {
    if (!request.headers.get('Content-Type')?.includes('multipart/form-data') || Number(request.headers.get('Content-Length') ?? 0) > MAX_PET_IMAGE_BYTES + 16_384) return errorResponse('Choose a JPEG, PNG, or WebP image smaller than 5 MB.', 400);
    let form: FormData;
    try { form = await request.formData(); } catch { return errorResponse('Choose a valid image file.', 400); }
    const image = form.get('image');
    if (!(image instanceof File) || !PET_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > MAX_PET_IMAGE_BYTES) return errorResponse('Choose a JPEG, PNG, or WebP image smaller than 5 MB.', 400);
    const { data: existing, error: existingError } = await client.from('pets').select('id, image_path').eq('id', imageMatch[1]).maybeSingle();
    if (existingError) return databaseError('admin.pets.image_lookup', existingError);
    if (!existing) return errorResponse('Pet not found.', 404);
    const imagePath = `pets/${existing.id}/${crypto.randomUUID()}.${PET_IMAGE_TYPES.get(image.type)}`;
    const { error: uploadError } = await client.storage.from('pet-images').upload(imagePath, image, { cacheControl: '3600', contentType: image.type, upsert: false });
    if (uploadError) return databaseError('admin.pets.image_upload', uploadError);
    const { data, error } = await client.from('pets').update({ image_path: imagePath }).eq('id', existing.id).select('*').maybeSingle();
    if (error || !data) {
      const { error: cleanupError } = await client.storage.from('pet-images').remove([imagePath]);
      if (cleanupError) console.error(JSON.stringify({ operation: 'admin.pets.image_cleanup', error: cleanupError.message, imagePath }));
      return error ? databaseError('admin.pets.image_update', error) : errorResponse('Pet not found.', 404);
    }
    if (existing.image_path) {
      const { error: cleanupError } = await client.storage.from('pet-images').remove([existing.image_path]);
      if (cleanupError) console.error(JSON.stringify({ operation: 'admin.pets.old_image_cleanup', error: cleanupError.message, imagePath: existing.image_path }));
    }
    return respond(petForClient(data as DatabasePet, env));
  }

  return null;
}
