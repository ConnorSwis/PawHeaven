import type { FieldErrors } from '@pawheaven/contracts';

export type ApiResponse = Response;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function respond(body: unknown, status = 200): ApiResponse {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(message: string, status: number, fieldErrors?: FieldErrors): ApiResponse {
  return respond(fieldErrors ? { message, fieldErrors } : { message }, status);
}

/** A 400 response that tells the client which form fields need correcting. */
export function validationResponse(fieldErrors: FieldErrors): ApiResponse {
  const first = Object.values(fieldErrors)[0] ?? 'Check the highlighted fields and try again.';
  return errorResponse(Object.keys(fieldErrors).length > 1 ? 'Please correct the highlighted fields.' : first, 400, fieldErrors);
}

export function databaseError(operation: string, error: { message: string }): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message }));
  return errorResponse('The shelter database is unavailable. Please try again.', 503);
}

export async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function jsonBody(request: Request): Promise<unknown | null> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) return null;
  const bytes = await readLimited(request, 16_384);
  if (!bytes) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isoInstant(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64 || !value.endsWith('Z')) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value ? value : null;
}
