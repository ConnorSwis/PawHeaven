/**
 * The only module that talks to OpenRouter. Every AI feature goes through
 * `chatJson`, so the provider, privacy settings, and failure behavior are set
 * in one place.
 */

export type ChatPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';
const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';

/** AI matching is switched off: no key is configured. */
export class AiNotConfiguredError extends Error {}
/** The provider failed, timed out, or returned something unusable. Safe to retry. */
export class AiFailureError extends Error {}

export type ChatJsonRequest = {
  model?: string;
  system: string;
  content: string | ChatPart[];
  schemaName: string;
  schema: object;
  maxTokens: number;
  timeoutMs: number;
};

export function aiConfigured(env: Env): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function modelsFor(env: Env, purpose: 'quiz' | 'vision'): string[] {
  const configured = (purpose === 'quiz' ? env.OPENROUTER_QUIZ_MODEL : env.OPENROUTER_VISION_MODEL)?.trim();
  const primary = configured || DEFAULT_MODEL;
  return primary === DEFAULT_FALLBACK_MODEL ? [primary] : [primary, DEFAULT_FALLBACK_MODEL];
}

/** Models sometimes wrap JSON in a code fence even when asked not to. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

export async function chatJson(env: Env, models: string[], request: ChatJsonRequest): Promise<unknown> {
  if (!env.OPENROUTER_API_KEY) throw new AiNotConfiguredError('OPENROUTER_API_KEY is not configured.');
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pawheaven.online',
        'X-Title': 'PawHeaven',
      },
      body: JSON.stringify({
        models,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.content },
        ],
        max_tokens: request.maxTokens,
        response_format: { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
        // No `temperature`: newer Anthropic models reject it, and with `require_parameters`
        // that would make OpenRouter refuse to route to them at all.
        // Never route shelter or member data to providers that retain or train on it,
        // and only use providers that honor the structured-output request.
        provider: { data_collection: 'deny', require_parameters: true },
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error) {
    console.error(JSON.stringify({ operation: 'ai.request', error: error instanceof Error ? error.name : 'Unknown error' }));
    throw new AiFailureError('The AI service could not be reached.');
  }
  if (!response.ok) {
    console.error(JSON.stringify({ operation: 'ai.response', status: response.status, detail: (await response.text().catch(() => '')).slice(0, 300) }));
    throw new AiFailureError('The AI service returned an error.');
  }
  try {
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[]; error?: { message?: string } };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error(payload.error?.message ?? 'Empty completion');
    return extractJson(content);
  } catch (error) {
    console.error(JSON.stringify({ operation: 'ai.parse', error: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error' }));
    throw new AiFailureError('The AI service returned an unreadable answer.');
  }
}
