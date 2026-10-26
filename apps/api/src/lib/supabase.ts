import { createClient } from '@supabase/supabase-js';

export function configurationError(env: Env): string | null {
  // Wrangler does not include values from the `previews` block in generated
  // types, so these must remain runtime values rather than literal unions.
  const deploymentTarget = String(env.DEPLOYMENT_TARGET);
  const supabaseUrl = String(env.SUPABASE_URL);
  const supabaseKey = String(env.SUPABASE_KEY);

  if (deploymentTarget === 'local') {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) return 'Local API development must use the local Supabase URL.';
    } catch {
      return 'Local API development has an invalid Supabase URL.';
    }
    return supabaseKey === 'local-publishable-key-not-configured'
      ? 'Run npm run db:start, then npm run db:configure-api before starting the local API.'
      : null;
  }

  if (deploymentTarget === 'preview'
    && (supabaseUrl === 'https://preview-supabase-not-configured.invalid'
      || supabaseKey === 'preview-publishable-key-not-configured')) {
    return 'This Preview has no separate Supabase project configured. It will not use production data.';
  }

  return null;
}

export function supabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/** Uses the caller's JWT, so every query remains subject to database and Storage RLS. */
export function userSupabase(env: Env, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** This client is only used for server-side Auth administration and privileged audit records. */
export function supabaseAdmin(env: Env) {
  if (!env.ADMIN_SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.ADMIN_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
