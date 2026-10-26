import assert from 'node:assert/strict';
import test from 'node:test';
import {
  lostPetSearchInput,
  parseScoredMatches,
  quizAnswersInput,
  quizCandidateRefs,
  quizUserPrompt,
  sniffImageType,
} from '../apps/api/src/lib/ai-matching.ts';
import { matchStrength } from '../packages/contracts/src/index.ts';
import { AiFailureError, AiNotConfiguredError, chatJson, extractJson, modelsFor } from '../apps/api/src/lib/openrouter.ts';

const validAnswers = {
  livingSpace: 'apartment', household: 'adults', otherPets: 'none', activityLevel: 'moderate', hoursAlone: '4-8',
  experience: 'some', species: 'either', size: 'any', age: 'any', traits: ['calm', 'cuddly'], notes: '',
};

test('quiz: a complete set of answers is accepted', () => {
  const parsed = quizAnswersInput(validAnswers);
  assert.ok('value' in parsed);
  assert.deepEqual(parsed.value.traits, ['calm', 'cuddly']);
});

test('quiz: every unanswered or invalid question is reported by field', () => {
  const parsed = quizAnswersInput({ ...validAnswers, livingSpace: undefined, size: 'giant', traits: [], notes: 'x'.repeat(501) });
  assert.ok('fieldErrors' in parsed);
  for (const field of ['livingSpace', 'size', 'traits', 'notes']) assert.ok(parsed.fieldErrors[field], `${field} should have an error`);
  assert.equal(parsed.fieldErrors.household, undefined);
});

test('quiz: unknown traits and more than three traits are rejected, and prototype keys are not answers', () => {
  assert.ok('fieldErrors' in quizAnswersInput({ ...validAnswers, traits: ['calm', 'invisible'] }));
  assert.ok('fieldErrors' in quizAnswersInput({ ...validAnswers, traits: ['calm', 'playful', 'cuddly', 'active'] }));
  assert.ok('fieldErrors' in quizAnswersInput({ ...validAnswers, livingSpace: 'constructor' }));
});

test('quiz: the prompt shows the model readable answers and refs, never database ids', () => {
  const refs = quizCandidateRefs([{ id: 'secret-db-id', name: 'Baxter', type: 'Dog', breed: 'Mix', age: '4 years', tags: ['big-dog'], summary: 'Calm.', medicalHistory: '' }]);
  const prompt = quizUserPrompt(validAnswers, refs);
  assert.ok(prompt.includes('"ref":"P1"'));
  assert.ok(prompt.includes('Apartment or condo'));
  assert.ok(!prompt.includes('secret-db-id'));
});

test('matches: unknown refs, duplicates, bad scores, and empty reasons are discarded; the best fit is first', () => {
  const refs = new Set(['P1', 'P2', 'P3']);
  const matches = parseScoredMatches({ recommendations: [
    { ref: 'P2', score: 71.6, reason: '  Calm   and quiet. ' },
    { ref: 'P1', score: 95, reason: 'Great fit.' },
    { ref: 'P1', score: 99, reason: 'Duplicate.' },
    { ref: 'P9', score: 90, reason: 'Invented animal.' },
    { ref: 'P3', score: 'high', reason: 'Not a number.' },
    { ref: 'P3', score: 10, reason: 'Below the minimum.' },
    { ref: 'P3', score: 80, reason: '' },
  ] }, 'recommendations', 'score', refs, 40);
  assert.deepEqual(matches, [
    { ref: 'P1', score: 95, reason: 'Great fit.' },
    { ref: 'P2', score: 72, reason: 'Calm and quiet.' },
  ]);
});

test('matches: scores are clamped, reasons are capped, and the list is limited to five', () => {
  const refs = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
  const matches = parseScoredMatches({ matches: ['A', 'B', 'C', 'D', 'E', 'F'].map((ref, index) => ({ ref, confidence: 150 - index, reason: 'r'.repeat(500) })) }, 'matches', 'confidence', refs, 0);
  assert.equal(matches.length, 5);
  assert.equal(matches[0].score, 100);
  assert.ok(matches[0].reason.length <= 240);
});

test('matches: an unusable response is null so the caller can report a retryable failure', () => {
  assert.equal(parseScoredMatches('nonsense', 'matches', 'confidence', new Set(['C1']), 0), null);
  assert.equal(parseScoredMatches({ matches: 'none' }, 'matches', 'confidence', new Set(['C1']), 0), null);
  assert.deepEqual(parseScoredMatches({ matches: [] }, 'matches', 'confidence', new Set(['C1']), 0), []);
});

test('lost pet: species and description are validated', () => {
  assert.ok('value' in lostPetSearchInput({ species: 'Cat', description: ' tabby ' }));
  assert.ok('fieldErrors' in lostPetSearchInput({ species: 'Dragon', description: '' }));
  assert.ok('fieldErrors' in lostPetSearchInput({ species: 'Dog', description: 'x'.repeat(301) }));
});

test('lost pet: images are identified by content, not by the declared type', () => {
  assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffImageType(new TextEncoder().encode('GIF89a')), null);
});

test('openrouter: JSON wrapped in a code fence is still read', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('openrouter: models default sensibly and honor overrides', () => {
  assert.deepEqual(modelsFor({}, 'quiz'), ['anthropic/claude-haiku-5.5', 'google/gemini-2.5-flash-lite']);
  assert.deepEqual(modelsFor({ OPENROUTER_VISION_MODEL: 'google/gemini-2.5-flash-lite' }, 'vision'), ['google/gemini-2.5-flash-lite']);
});

test('openrouter: without a key nothing is sent', async () => {
  await assert.rejects(chatJson({}, ['m'], { system: 's', content: 'c', schemaName: 'n', schema: {}, maxTokens: 10, timeoutMs: 1000 }), AiNotConfiguredError);
});

test('openrouter: requests deny data collection, require structured output, and never leak the key into errors', async () => {
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, init };
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  };
  try {
    const result = await chatJson({ OPENROUTER_API_KEY: 'sk-test-key' }, ['primary', 'fallback'], { system: 's', content: 'c', schemaName: 'n', schema: { type: 'object' }, maxTokens: 10, timeoutMs: 1000 });
    assert.deepEqual(result, { ok: true });
    const body = JSON.parse(sent.init.body);
    assert.deepEqual(body.provider, { data_collection: 'deny', require_parameters: true });
    assert.deepEqual(body.models, ['primary', 'fallback']);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(sent.init.headers.Authorization, 'Bearer sk-test-key');
    assert.ok(!sent.init.body.includes('sk-test-key'));

    globalThis.fetch = async () => new Response('upstream says sk-test-key is bad', { status: 401 });
    await assert.rejects(chatJson({ OPENROUTER_API_KEY: 'sk-test-key' }, ['m'], { system: 's', content: 'c', schemaName: 'n', schema: {}, maxTokens: 10, timeoutMs: 1000 }), (error) => error instanceof AiFailureError && !error.message.includes('sk-test-key'));

    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 });
    await assert.rejects(chatJson({ OPENROUTER_API_KEY: 'k' }, ['m'], { system: 's', content: 'c', schemaName: 'n', schema: {}, maxTokens: 10, timeoutMs: 1000 }), AiFailureError);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('lost pet: a model estimate is shown as a band, never a precise percentage', () => {
  assert.equal(matchStrength(100), 'Strong');
  assert.equal(matchStrength(85), 'Strong');
  assert.equal(matchStrength(84), 'Likely');
  assert.equal(matchStrength(65), 'Likely');
  assert.equal(matchStrength(64), 'Possible');
  assert.equal(matchStrength(35), 'Possible');
});
