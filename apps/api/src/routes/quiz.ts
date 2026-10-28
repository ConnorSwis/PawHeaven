import type { LatestQuizResponse, QuizAnswers, QuizRecommendation, QuizResultResponse } from '@pawheaven/contracts';
import {
  MAX_QUIZ_CANDIDATES,
  MIN_QUIZ_SCORE,
  QUIZ_DAILY_LIMIT,
  QUIZ_RESPONSE_SCHEMA,
  QUIZ_SYSTEM_PROMPT,
  parseScoredMatches,
  quizAnswersInput,
  quizCandidateRefs,
  quizUserPrompt,
  type QuizCandidate,
} from '../lib/ai-matching';
import { databaseError, errorResponse, jsonBody, respond, validationResponse, type ApiResponse } from '../lib/http';
import { AiFailureError, AiNotConfiguredError, chatJson, modelsFor } from '../lib/openrouter';
import { petForClient, type DatabasePet } from '../lib/pets';
import { clearSession, identity, sessionResponse, type RouteContext } from '../lib/session';
import { userSupabase } from '../lib/supabase';

type StoredRecommendation = { petId: string; score: number; reason: string };
type DatabaseQuizResponse = { id: string; answers: QuizAnswers; recommendations: StoredRecommendation[]; created_at: string };

const UNAVAILABLE = 'Pet matching is not available right now. Browse the available pets instead, or try again later.';
const NO_MATCHES = 'No available animals fit those answers right now. Browse all available pets, or change your answers and try again.';

async function hydrate(client: ReturnType<typeof userSupabase>, env: Env, row: DatabaseQuizResponse, notice: string | null): Promise<QuizResultResponse | null> {
  const ids = row.recommendations.map((item) => item.petId);
  const { data, error } = ids.length
    ? await client.from('pets').select('*').in('id', ids).eq('status', 'Available')
    : { data: [], error: null };
  if (error) return null;
  const pets = new Map((data as DatabasePet[]).map((pet) => [pet.id, pet]));
  // An animal that was adopted since the quiz ran is no longer a recommendation.
  const recommendations = row.recommendations.flatMap((item): QuizRecommendation[] => {
    const pet = pets.get(item.petId);
    return pet ? [{ pet: petForClient(pet, env), score: item.score, reason: item.reason }] : [];
  });
  return { id: row.id, answers: row.answers, recommendations, createdAt: row.created_at, notice: recommendations.length ? notice : notice ?? NO_MATCHES };
}

export async function quizRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const current = await identity(request, env);
  if (!current) return clearSession(errorResponse('Log in to take the pet-matching quiz.', 401), request);
  const client = userSupabase(env, current.accessToken);

  if (path === '/quiz/latest' && request.method === 'GET') {
    const { data, error } = await client.from('quiz_responses').select('id, answers, recommendations, created_at').eq('user_id', current.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return sessionResponse(databaseError('quiz.latest', error), request, current);
    const payload: LatestQuizResponse = { result: data ? await hydrate(client, env, data as DatabaseQuizResponse, null) : null };
    return sessionResponse(respond(payload), request, current);
  }

  if (path === '/quiz' && request.method === 'POST') {
    const parsed = quizAnswersInput(await jsonBody(request));
    if ('fieldErrors' in parsed) return sessionResponse(validationResponse(parsed.fieldErrors), request, current);
    const answers = parsed.value;

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count, error: countError } = await client.from('quiz_responses').select('id', { count: 'exact', head: true }).eq('user_id', current.user.id).gte('created_at', since);
    if (countError) return sessionResponse(databaseError('quiz.limit', countError), request, current);
    if ((count ?? 0) >= QUIZ_DAILY_LIMIT) return sessionResponse(errorResponse(`You have taken the quiz ${QUIZ_DAILY_LIMIT} times today. Please try again tomorrow, or browse the available pets.`, 429), request, current);

    let query = client.from('pets').select('*').eq('status', 'Available').order('intake_date', { ascending: true }).limit(MAX_QUIZ_CANDIDATES);
    if (answers.species === 'dog') query = query.ilike('species', 'dog');
    if (answers.species === 'cat') query = query.ilike('species', 'cat');
    const { data: petRows, error: petError } = await query;
    if (petError) return sessionResponse(databaseError('quiz.pets', petError), request, current);
    const pets = petRows as DatabasePet[];

    let stored: StoredRecommendation[] = [];
    if (pets.length) {
      const candidates = new Map<string, DatabasePet>(pets.map((pet) => [pet.id, pet]));
      const candidateList: QuizCandidate[] = pets.map((pet) => ({
        id: pet.id, name: pet.name, type: pet.species, breed: pet.breed, age: pet.age_label, tags: pet.tags, summary: pet.summary, medicalHistory: pet.medical_history ?? '',
        attributes: { sex: pet.sex ?? '', size: pet.size ?? '', color: pet.color ?? '', weightLbs: pet.weight_lbs ?? null, spayedNeutered: pet.spayed_neutered ?? 'Unknown', goodWithKids: pet.good_with_kids ?? 'Unknown', goodWithDogs: pet.good_with_dogs ?? 'Unknown', goodWithCats: pet.good_with_cats ?? 'Unknown', energyLevel: pet.energy_level ?? '' },
      }));
      const refs = quizCandidateRefs(candidateList);
      try {
        const raw = await chatJson(env, modelsFor(env, 'quiz'), {
          system: QUIZ_SYSTEM_PROMPT,
          content: quizUserPrompt(answers, refs),
          schemaName: 'pet_recommendations',
          schema: QUIZ_RESPONSE_SCHEMA,
          maxTokens: 1200,
          timeoutMs: 30_000,
        });
        const matches = parseScoredMatches(raw, 'recommendations', 'score', new Set(refs.keys()), MIN_QUIZ_SCORE);
        if (!matches) throw new AiFailureError('Unexpected recommendation format.');
        stored = matches.flatMap((match) => {
          const candidate = refs.get(match.ref);
          return candidate && candidates.has(candidate.id) ? [{ petId: candidate.id, score: match.score, reason: match.reason }] : [];
        });
      } catch (error) {
        if (error instanceof AiNotConfiguredError) return sessionResponse(errorResponse(UNAVAILABLE, 503), request, current);
        if (error instanceof AiFailureError) return sessionResponse(errorResponse('We could not finish matching just now. Please try again.', 502), request, current);
        throw error;
      }
    }

    const { data: saved, error: saveError } = await client.from('quiz_responses').insert({ user_id: current.user.id, answers, recommendations: stored }).select('id, answers, recommendations, created_at').single();
    if (saveError) return sessionResponse(databaseError('quiz.save', saveError), request, current);
    const result = await hydrate(client, env, saved as DatabaseQuizResponse, pets.length ? null : NO_MATCHES);
    if (!result) return sessionResponse(errorResponse('The shelter database is unavailable. Please try again.', 503), request, current);
    return sessionResponse(respond(result, 201), request, current);
  }

  return sessionResponse(errorResponse('Not found.', 404), request, current);
}
