import type { FieldErrors } from '@pawheaven/contracts';

export type ApiResponse = Response;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function respond(body: unknown, status = 200): ApiResponse {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
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

export type RpcErrorMessages = {
  /** Shown when the session has expired (database code 28000). */
  expired: string;
  /** Shown for a duplicate (23505) when the database's own text would be unclear. */
  duplicate?: string;
};

/**
 * Maps a Postgres error from a locked RPC to an HTTP response. Every feature
 * that books, registers, or reviews through an RPC raises the same codes:
 * 22023 invalid input, 28000 not signed in, 42501 not allowed, P0001 a rule
 * refused it (full, duplicate, overlap), 23505 and 23P01 a uniqueness clash.
 */
export function rpcErrorResponse(operation: string, error: { message: string; code?: string }, messages: RpcErrorMessages): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message, code: error.code }));
  if (error.code === '22023') return errorResponse(error.message, 400);
  if (error.code === '28000') return errorResponse(messages.expired, 401);
  if (error.code === '42501') return errorResponse(error.message, 403);
  if (error.code === 'P0001' || error.code === '23P01') return errorResponse(error.message, 409);
  if (error.code === '23505') return errorResponse(messages.duplicate ?? error.message, 409);
  return errorResponse('The shelter database is unavailable. Please try again.', 503);
}
