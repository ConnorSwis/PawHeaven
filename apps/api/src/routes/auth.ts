import { passwordProblem, type ChangeEmailInput, type ChangePasswordInput, type FieldErrors } from '@pawheaven/contracts';
import { errorResponse, jsonBody, respond, validationResponse, validEmail, type ApiResponse } from '../lib/http';
import { adminRole, apiUser, clearSession, identity, sessionCookies, sessionResponse, withSession, type RouteContext } from '../lib/session';
import { supabase, supabaseAdmin } from '../lib/supabase';

const WEAK_PASSWORD_MESSAGE = passwordProblem('') ?? 'Choose a stronger password.';

function authFailure(action: 'login' | 'register', error: { message: string; status?: number }): ApiResponse {
  console.error(JSON.stringify({ operation: `auth.${action}`, error: error.message }));
  if (error.status === 429) return errorResponse('Too many attempts. Please wait a few minutes before trying again.', 429);
  if (error.status && error.status >= 500) return errorResponse('The account service is temporarily unavailable. Please try again in a few minutes.', 503);
  if (action === 'login') return errorResponse('We could not log you in. Check your email and password, and confirm your email if you recently registered.', 401);
  if (/signups? (are )?(disabled|not allowed)/i.test(error.message)) return errorResponse('Online account creation is not available right now. Please contact the shelter for help.', 403);
  if (/password/i.test(error.message) && /(weak|short|character|requirement)/i.test(error.message)) return errorResponse(WEAK_PASSWORD_MESSAGE, 400, { password: WEAK_PASSWORD_MESSAGE });
  return errorResponse('We could not create an account with those details. If you already have an account, try logging in.', 400);
}

/** Confirms the signed-in user's current password before a sensitive account change. */
async function currentPasswordIsCorrect(env: Env, email: string, password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password || password.length > 1024 || !email) return false;
  const { data, error } = await supabase(env).auth.signInWithPassword({ email, password });
  return !error && Boolean(data.session);
}

export async function authRoutes({ request, env, path }: RouteContext): Promise<ApiResponse> {
  if (path === '/auth/register' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    const errors: FieldErrors = {};
    if (!name || name.length > 100) errors.name = 'Enter your name, using 100 characters or fewer.';
    if (!validEmail(email)) errors.email = 'Enter a valid email address.';
    if (typeof password !== 'string') errors.password = 'Create a password.';
    else {
      const problem = passwordProblem(password);
      if (problem) errors.password = problem;
    }
    if (Object.keys(errors).length || typeof password !== 'string') return validationResponse(errors);
    const { data, error } = await supabase(env).auth.signUp({ email, password, options: { data: { name } } });
    if (error) return authFailure('register', error);
    if (!data.user) return errorResponse('The account service returned an unexpected response. Please try again in a few minutes.', 503);
    if (!data.session) return respond({ message: 'If the address can be used for an account, check its inbox for the next steps before logging in.', requiresEmailConfirmation: true }, 202);
    return withSession(respond({ user: apiUser(data.user) }, 201), request, data.session);
  }
  if (path === '/auth/login' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!validEmail(email) || typeof password !== 'string' || password.length === 0 || password.length > 1024) return errorResponse('Enter a valid email address and password.', 400);
    const { data, error } = await supabase(env).auth.signInWithPassword({ email, password });
    if (error) return authFailure('login', error);
    if (!data.session || !data.user) return errorResponse('The account service returned an unexpected response. Please try again in a few minutes.', 503);
    return withSession(respond({ user: apiUser(data.user) }), request, data.session);
  }
  if (path === '/auth/verify-invitation' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const tokenHash = typeof body?.tokenHash === 'string' ? body.tokenHash : '';
    if (!/^[a-f0-9]{56}$/i.test(tokenHash)) return errorResponse('The invitation link is incomplete. Ask a superadmin for a new invitation.', 400);
    const { data, error } = await supabase(env).auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
    if (error || !data.user || !data.session) return errorResponse('This invitation is invalid, expired, or has already been used. Ask a superadmin for a new invitation.', 401);
    return withSession(respond({ user: apiUser(data.user) }), request, data.session);
  }
  if (path === '/auth/exchange' && request.method === 'POST') {
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!accessToken || accessToken.length > 16_384 || !refreshToken || refreshToken.length > 16_384) return errorResponse('The account link is incomplete or expired. Request a new invitation or password reset.', 400);
    const { data, error } = await supabase(env).auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error || !data.user || !data.session) return errorResponse('The account link is invalid or expired. Request a new invitation or password reset.', 401);
    return withSession(respond({ user: apiUser(data.user) }), request, data.session);
  }
  if (path === '/auth/password' && request.method === 'POST') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Your session has expired. Use your account link again.', 401), request);
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const password = body?.password;
    const problem = typeof password === 'string' ? passwordProblem(password) : 'Choose a password.';
    if (typeof password !== 'string' || problem) return errorResponse(problem ?? 'Choose a password.', 400);
    const client = supabase(env);
    const { error: sessionError } = await client.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    if (sessionError) return clearSession(errorResponse('Your session has expired. Use your account link again.', 401), request);
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      console.error(JSON.stringify({ operation: 'auth.password', error: error.message }));
      return errorResponse('We could not save that password. Please try again.', 503);
    }
    if (adminRole(current.user) === 'staff') {
      const adminClient = supabaseAdmin(env);
      if (adminClient) {
        const { error: auditError } = await adminClient
          .from('admin_invitation_audit')
          .update({ password_set_at: new Date().toISOString() })
          .eq('invited_user_id', current.user.id)
          .is('password_set_at', null);
        if (auditError) console.error(JSON.stringify({ operation: 'admin.invite_password_setup_audit', error: auditError.message, invitedUserId: current.user.id }));
      }
    }
    return sessionResponse(respond({ ok: true }), request, current);
  }
  if (path === '/auth/me' && request.method === 'GET') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Not signed in.', 401), request);
    return sessionResponse(respond({ user: apiUser(current.user) }), request, current);
  }
  if (path === '/auth/profile' && request.method === 'PUT') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Your session has expired. Log in again to update your profile.', 401), request);
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 100) return sessionResponse(errorResponse('Enter a name up to 100 characters long.', 400), request, current);
    const client = supabase(env);
    const { error } = await client.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    if (error) return clearSession(errorResponse('Your session has expired. Log in again to update your profile.', 401), request);
    const { data, error: updateError } = await client.auth.updateUser({ data: { ...current.user.user_metadata, name } });
    if (updateError || !data.user) {
      console.error(JSON.stringify({ operation: 'auth.profile.update', error: updateError?.message ?? 'No user returned' }));
      return sessionResponse(errorResponse('We could not save your profile. Please try again.', 503), request, current);
    }
    return sessionResponse(respond({ user: apiUser(data.user) }), request, current);
  }
  if (path === '/auth/email' && request.method === 'PUT') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Your session has expired. Log in again to change your email.', 401), request);
    const body = await jsonBody(request) as Partial<ChangeEmailInput> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!validEmail(email)) return sessionResponse(validationResponse({ email: 'Enter a valid email address.' }), request, current);
    if (email === current.user.email?.toLowerCase()) return sessionResponse(validationResponse({ email: 'That is already your email address.' }), request, current);
    if (!await currentPasswordIsCorrect(env, current.user.email ?? '', body?.currentPassword)) return sessionResponse(validationResponse({ currentPassword: 'Your current password is not correct.' }), request, current);
    const client = supabase(env);
    const { error: sessionError } = await client.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    if (sessionError) return clearSession(errorResponse('Your session has expired. Log in again to change your email.', 401), request);
    const { error } = await client.auth.updateUser({ email });
    if (error) {
      console.error(JSON.stringify({ operation: 'auth.email.update', error: error.message }));
      if (error.status === 429) return sessionResponse(errorResponse('Too many email changes were requested. Please wait a few minutes and try again.', 429), request, current);
      return sessionResponse(errorResponse('We could not start that email change. Check the address and try again.', error.status && error.status >= 500 ? 503 : 400), request, current);
    }
    return sessionResponse(respond({ message: 'Check the inboxes for both your current and new email addresses and confirm the change. Your email stays the same until you confirm.' }, 202), request, current);
  }
  if (path === '/auth/change-password' && request.method === 'POST') {
    const current = await identity(request, env);
    if (!current) return clearSession(errorResponse('Your session has expired. Log in again to change your password.', 401), request);
    const body = await jsonBody(request) as Partial<ChangePasswordInput> | null;
    const newPassword = body?.newPassword;
    const problem = typeof newPassword === 'string' ? passwordProblem(newPassword) : 'Choose a new password.';
    if (typeof newPassword !== 'string' || problem) return sessionResponse(validationResponse({ newPassword: problem ?? 'Choose a new password.' }), request, current);
    if (!await currentPasswordIsCorrect(env, current.user.email ?? '', body?.currentPassword)) return sessionResponse(validationResponse({ currentPassword: 'Your current password is not correct.' }), request, current);
    const client = supabase(env);
    const { error: sessionError } = await client.auth.setSession({ access_token: current.accessToken, refresh_token: current.refreshToken });
    if (sessionError) return clearSession(errorResponse('Your session has expired. Log in again to change your password.', 401), request);
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      console.error(JSON.stringify({ operation: 'auth.change_password', error: error.message }));
      return sessionResponse(errorResponse(error.status === 422 ? 'Choose a different password from your current one.' : 'We could not change your password. Please try again.', error.status === 422 ? 400 : 503), request, current);
    }
    return sessionResponse(respond({ ok: true }), request, current);
  }
  if (path === '/auth/logout' && request.method === 'POST') {
    const { access, refresh } = sessionCookies(request);
    if (access && refresh) {
      const client = supabase(env);
      const { error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (!error) await client.auth.signOut({ scope: 'local' });
    }
    return clearSession(respond({ ok: true }), request);
  }
  return errorResponse('Not found.', 404);
}
