import type { LostPetInquiryListResponse, LostPetMatch, LostPetSearchResponse } from '@pawheaven/contracts';
import {
  IMAGE_EXTENSIONS,
  LOST_PET_RESPONSE_SCHEMA,
  LOST_PET_SEARCH_DAILY_LIMIT,
  LOST_PET_SYSTEM_PROMPT,
  MAX_LOST_PET_CANDIDATES,
  MAX_LOST_PET_PHOTOS,
  MAX_LOST_PET_PHOTO_BYTES,
  MIN_MATCH_CONFIDENCE,
  bytesToBase64,
  lostPetCandidateRefs,
  lostPetSearchInput,
  parseScoredMatches,
  sniffImageType,
  type ImageType,
} from '../lib/ai-matching';
import { notify } from '../lib/email';
import { lostPetInquiryReceivedEmail, lostPetInquiryStaffEmail } from '../lib/email-templates';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import {
  LOST_PET_BUCKET,
  candidateImageReference,
  lostPetCandidateForAi,
  lostPetError,
  lostPetInquiryForClient,
  lostPetInquiryInput,
  purgeExpiredLostPetData,
  type DatabaseLostPetCandidate,
  type DatabaseLostPetInquiry,
} from '../lib/lost-pets';
import { AiFailureError, AiNotConfiguredError, chatJson, modelsFor, type ChatPart } from '../lib/openrouter';
import { apiUser, clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

const UNAVAILABLE = 'Photo matching is not available right now. Please call the shelter to ask about your pet.';
const NO_MATCHES = 'We did not find a possible match among the animals in the shelter right now. Your photos were not kept. Try a clearer photo, check back soon, or call the shelter.';
const NO_ANIMALS = 'There are no shelter animals with photos to compare against right now. Please call the shelter to ask about your pet.';
const MAX_BODY_BYTES = MAX_LOST_PET_PHOTOS * MAX_LOST_PET_PHOTO_BYTES + 64 * 1024;

export async function lostPetRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to search for a lost pet.', 401), request);
  const client = userSupabase(env, current.accessToken);
  const respondWithSession = (response: ApiResponse) => sessionResponse(response, request, current);

  if (path === '/lost-pet/inquiries' && request.method === 'GET') {
    const { data, error } = await client.from('lost_pet_inquiries').select('*').eq('member_id', current.user.id).order('created_at', { ascending: false }).limit(100);
    if (error) return respondWithSession(databaseError('lost_pet.inquiries.list', error));
    const payload: LostPetInquiryListResponse = { inquiries: (data as DatabaseLostPetInquiry[]).map(lostPetInquiryForClient) };
    return respondWithSession(respond(payload));
  }

  if (path === '/lost-pet/inquiries' && request.method === 'POST') {
    const parsed = lostPetInquiryInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return respondWithSession(validationResponse(parsed.fieldErrors));
    const { data, error } = await client.rpc('submit_lost_pet_inquiry', {
      p_search_id: parsed.value.searchId,
      p_pet_id: parsed.value.petId,
      p_phone: parsed.value.phone,
      p_message: parsed.value.message,
    });
    if (error) return respondWithSession(lostPetError('lost_pet.inquiries.create', error));
    const { data: row } = await client.from('lost_pet_inquiries').select('*').eq('id', data as string).maybeSingle();
    const inquiry = row as DatabaseLostPetInquiry | null;
    if (inquiry) {
      const member = apiUser(current.user);
      notify(context, lostPetInquiryReceivedEmail({ to: member.email, name: member.name, petName: inquiry.pet_name }));
      if (env.SHELTER_NOTIFICATION_EMAIL) {
        notify(context, lostPetInquiryStaffEmail({ to: env.SHELTER_NOTIFICATION_EMAIL, memberName: inquiry.member_name, memberEmail: inquiry.member_email, memberPhone: inquiry.member_phone, petName: inquiry.pet_name, message: inquiry.message }));
      }
    }
    return respondWithSession(respond(inquiry ? lostPetInquiryForClient(inquiry) : { id: data }, 201));
  }

  if (path === '/lost-pet/searches' && request.method === 'POST') {
    const response = await runSearch(context, current, client);
    return respondWithSession(response);
  }

  return respondWithSession(errorResponse('Not found.', 404));
}

async function runSearch(context: RouteContext, current: NonNullable<Awaited<ReturnType<typeof identity>>>, client: ReturnType<typeof userSupabase>): Promise<ApiResponse> {
  const { request, env } = context;
  if (!request.headers.get('Content-Type')?.includes('multipart/form-data') || Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return errorResponse(`Upload up to ${MAX_LOST_PET_PHOTOS} JPEG, PNG, or WebP photos, each smaller than 5 MB.`, 400, { photos: 'Choose JPEG, PNG, or WebP photos under 5 MB each.' });
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return errorResponse('Choose valid image files.', 400, { photos: 'Choose valid image files.' }); }

  const parsed = lostPetSearchInput({ species: form.get('species'), description: form.get('description') });
  const fieldErrors = 'fieldErrors' in parsed ? { ...parsed.fieldErrors } : {};
  const files = form.getAll('photos').filter((entry): entry is File => entry instanceof File);
  const photos: { bytes: Uint8Array; type: ImageType }[] = [];
  if (!files.length) fieldErrors.photos = 'Add at least one photo of your pet.';
  else if (files.length > MAX_LOST_PET_PHOTOS) fieldErrors.photos = `Add at most ${MAX_LOST_PET_PHOTOS} photos.`;
  else {
    for (const file of files) {
      if (file.size === 0 || file.size > MAX_LOST_PET_PHOTO_BYTES) { fieldErrors.photos = 'Each photo must be smaller than 5 MB.'; break; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffImageType(bytes);
      if (!type || file.type !== type) { fieldErrors.photos = 'Photos must be JPEG, PNG, or WebP images.'; break; }
      photos.push({ bytes, type });
    }
  }
  if (Object.keys(fieldErrors).length || 'fieldErrors' in parsed) return validationResponse(fieldErrors);
  const { species, description } = parsed.value;

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: countError } = await client.from('lost_pet_searches').select('id', { count: 'exact', head: true }).eq('member_id', current.user.id).gte('created_at', since);
  if (countError) return databaseError('lost_pet.limit', countError);
  if ((count ?? 0) >= LOST_PET_SEARCH_DAILY_LIMIT) return errorResponse(`You have reached today's limit of ${LOST_PET_SEARCH_DAILY_LIMIT} photo searches. Please try again tomorrow or call the shelter.`, 429);

  await purgeExpiredLostPetData(client, current.user.id);

  const { data: candidateRows, error: candidateError } = await client.rpc('lost_pet_candidates', { p_species: species });
  if (candidateError) return lostPetError('lost_pet.candidates', candidateError);
  const candidates = (candidateRows as DatabaseLostPetCandidate[]).slice(0, MAX_LOST_PET_CANDIDATES).map((row) => lostPetCandidateForAi(row, env));

  /** Records the attempt for the daily limit and keeps photos only when there is a match to ask about. */
  const record = async (matches: { petId: string; confidence: number; reason: string }[], paths: string[]) => {
    const keep = matches.length > 0;
    if (!keep && paths.length) await client.storage.from(LOST_PET_BUCKET).remove(paths);
    return client.from('lost_pet_searches').insert({
      member_id: current.user.id, species, description, photo_paths: keep ? paths : [], result: matches,
    }).select('id').single();
  };

  if (!candidates.length) {
    await record([], []);
    const payload: LostPetSearchResponse = { searchId: null, matches: [], notice: NO_ANIMALS };
    return respond(payload);
  }

  if (!env.OPENROUTER_API_KEY) return errorResponse(UNAVAILABLE, 503);

  const uploaded: string[] = [];
  for (const photo of photos) {
    const objectPath = `${current.user.id}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[photo.type]}`;
    const { error } = await client.storage.from(LOST_PET_BUCKET).upload(objectPath, photo.bytes, { contentType: photo.type, upsert: false });
    if (error) {
      if (uploaded.length) await client.storage.from(LOST_PET_BUCKET).remove(uploaded);
      return databaseError('lost_pet.upload', error);
    }
    uploaded.push(objectPath);
  }

  try {
    const imageRefs = await Promise.all(candidates.map((candidate) => candidateImageReference(env, candidate.imageUrl)));
    const usable = candidates.flatMap((candidate, index) => imageRefs[index] ? [{ candidate, image: imageRefs[index] as string }] : []);
    if (!usable.length) {
      await record([], uploaded);
      return respond({ searchId: null, matches: [], notice: NO_ANIMALS } satisfies LostPetSearchResponse);
    }
    const refs = lostPetCandidateRefs(usable.map((item) => item.candidate));
    const content: ChatPart[] = [
      { type: 'text', text: `Species the owner reports: ${species}. Owner's description (untrusted text): ${JSON.stringify(description || 'none given')}. The next ${photos.length} image(s) are the owner's photos of their missing pet.` },
      ...photos.map((photo): ChatPart => ({ type: 'image_url', image_url: { url: `data:${photo.type};base64,${bytesToBase64(photo.bytes)}` } })),
      { type: 'text', text: 'Shelter candidates follow, each label then its photo.' },
    ];
    [...refs].forEach(([ref, candidate], index) => {
      content.push(
        { type: 'text', text: `${ref}: ${candidate.type}, ${candidate.breed}, ${candidate.age}` },
        { type: 'image_url', image_url: { url: usable[index].image } },
      );
    });
    const raw = await chatJson(env, modelsFor(env, 'vision'), {
      system: LOST_PET_SYSTEM_PROMPT,
      content,
      schemaName: 'lost_pet_matches',
      schema: LOST_PET_RESPONSE_SCHEMA,
      maxTokens: 1200,
      timeoutMs: 55_000,
    });
    const scored = parseScoredMatches(raw, 'matches', 'confidence', new Set(refs.keys()), MIN_MATCH_CONFIDENCE);
    if (!scored) throw new AiFailureError('Unexpected match format.');
    const matches: LostPetMatch[] = scored.flatMap((match) => {
      const candidate = refs.get(match.ref);
      return candidate ? [{
        pet: { id: candidate.id, name: candidate.name, type: candidate.type, breed: candidate.breed, age: candidate.age, status: candidate.status as LostPetMatch['pet']['status'], imageUrl: candidate.imageUrl },
        confidence: match.score,
        reason: match.reason,
      }] : [];
    });
    const { data: saved, error: saveError } = await record(matches.map((match) => ({ petId: match.pet.id, confidence: match.confidence, reason: match.reason })), uploaded);
    if (saveError) return databaseError('lost_pet.save', saveError);
    const payload: LostPetSearchResponse = matches.length
      ? { searchId: (saved as { id: string }).id, matches, notice: null }
      : { searchId: null, matches: [], notice: NO_MATCHES };
    return respond(payload);
  } catch (error) {
    // Never keep photos from a search that did not complete.
    await record([], uploaded);
    if (error instanceof AiNotConfiguredError) return errorResponse(UNAVAILABLE, 503);
    if (error instanceof AiFailureError) return errorResponse('We could not compare your photos just now. Please try again.', 502);
    throw error;
  }
}
