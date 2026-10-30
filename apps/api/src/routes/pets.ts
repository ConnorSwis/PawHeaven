import { matchesPetSearch } from '@pawheaven/contracts';
import { databaseError, errorResponse, respond, type ApiResponse } from '../lib/http';
import { petForClient, type DatabasePet } from '../lib/pets';
import { shelterStatusForClient } from '../lib/shelter';
import type { RouteContext } from '../lib/session';
import { supabase } from '../lib/supabase';

export async function publicPetRoutes({ request, env, path }: RouteContext): Promise<ApiResponse> {
  const client = supabase(env);
  // How full each kennel group is, and how many animals need help. Counts only; cached briefly.
  if (path === '/public/shelter-status' && request.method === 'GET') {
    const { data, error } = await client.rpc('get_shelter_status');
    if (error) return databaseError('public.shelter_status', error);
    const response = respond(shelterStatusForClient(data));
    response.headers.set('Cache-Control', 'public, max-age=60');
    return response;
  }
  if (path === '/pets' && request.method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim().toLowerCase().slice(0, 100) ?? '';
    const tag = url.searchParams.get('tag')?.trim().slice(0, 40) ?? '';
    let query = client.from('pets').select('*').eq('status', 'Available').order('name', { ascending: true }).limit(200);
    if (tag) query = query.contains('tags', [tag]);
    const { data, error } = await query;
    if (error) return databaseError('pets.list', error);
    const pets = (data as DatabasePet[]).map((row) => petForClient(row, env));
    return respond({ pets: pets.filter((pet) => matchesPetSearch(pet, search)) });
  }
  const match = path.match(/^\/pets\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'GET') {
    const { data, error } = await client.from('pets').select('*').eq('id', match[1]).eq('status', 'Available').maybeSingle();
    if (error) return databaseError('pets.get', error);
    return data ? respond(petForClient(data as DatabasePet, env)) : errorResponse('Pet not found.', 404);
  }
  // /pets/s/<8 hex>: the short id used in public addresses such as /adopt/blizzard-4f2a91c3.
  const short = path.match(/^\/pets\/s\/([0-9a-f]{8})$/i);
  if (short && request.method === 'GET') {
    const prefix = short[1].toLowerCase();
    const { data, error } = await client.from('pets').select('*').gte('id', `${prefix}-0000-0000-0000-000000000000`).lte('id', `${prefix}-ffff-ffff-ffff-ffffffffffff`).eq('status', 'Available').limit(1).maybeSingle();
    if (error) return databaseError('pets.get_short', error);
    return data ? respond(petForClient(data as DatabasePet, env)) : errorResponse('Pet not found.', 404);
  }
  return errorResponse('Not found.', 404);
}
