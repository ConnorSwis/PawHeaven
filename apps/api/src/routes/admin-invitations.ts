import type { AdminInvitationListResponse } from '@pawheaven/contracts';
import { databaseError, errorResponse, jsonBody, respond, validEmail, type ApiResponse } from '../lib/http';
import { adminRole, isBlocked, type AdminContext } from '../lib/session';
import { supabase, supabaseAdmin } from '../lib/supabase';

function authAdminError(operation: string, error: { message: string; status?: number }): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message }));
  if (error.status === 429) return errorResponse('Too many account changes were requested. Please wait and try again.', 429);
  return errorResponse('The account service could not complete that change. Please try again.', 503);
}

/** Administrator invitations are a superuser-only capability. */
export async function adminInvitationRoutes({ request, env, path, current, role }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/invitations')) return null;
  const resendMatch = path.match(/^\/admin\/invitations\/([0-9a-f-]{36})\/resend$/i);

  if (path === '/admin/invitations' && request.method === 'GET') {
    if (role !== 'superuser') return errorResponse('Only superusers can view staff invitations.', 403);
    const adminClient = supabaseAdmin(env);
    if (!adminClient) return errorResponse('Staff invitations are not configured. Contact the deployment owner.', 503);
    const [{ data: users, error: usersError }, { data: auditRows, error: auditError }] = await Promise.all([
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      adminClient.from('admin_invitation_audit').select('invited_user_id, invited_at, password_set_at').not('invited_user_id', 'is', null).order('invited_at', { ascending: false }).limit(1000),
    ]);
    if (usersError) return authAdminError('admin.invitations.list_users', usersError);
    if (auditError) return databaseError('admin.invitations.list_audit', auditError);
    const latestInvite = new Map<string, string>();
    const passwordSet = new Set<string>();
    for (const row of (auditRows ?? []) as { invited_user_id: string | null; invited_at: string; password_set_at: string | null }[]) {
      if (!row.invited_user_id) continue;
      if (!latestInvite.has(row.invited_user_id)) latestInvite.set(row.invited_user_id, row.invited_at);
      if (row.password_set_at) passwordSet.add(row.invited_user_id);
    }
    const invitations = users.users
      .filter((user) => adminRole(user) === 'staff')
      .map((user) => ({
        userId: user.id,
        email: user.email ?? 'No email address',
        invitedAt: latestInvite.get(user.id) ?? user.created_at,
        createdAt: user.created_at,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        status: passwordSet.has(user.id) ? 'active' as const : 'awaiting_setup' as const,
      }))
      .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
    const payload: AdminInvitationListResponse = { invitations };
    return respond(payload);
  }

  if (resendMatch && request.method === 'POST') {
    if (role !== 'superuser') return errorResponse('Only superusers can resend staff invitations.', 403);
    const adminClient = supabaseAdmin(env);
    if (!adminClient) return errorResponse('Staff invitations are not configured. Contact the deployment owner.', 503);
    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(resendMatch[1]);
    if (targetError || !targetData.user) return targetError?.status === 404 ? errorResponse('Invitation not found.', 404) : authAdminError('admin.invite_resend_lookup', targetError ?? { message: 'No user returned' });
    if (adminRole(targetData.user) !== 'staff' || !targetData.user.email) return errorResponse('This account is not a staff invitation.', 400);
    if (isBlocked(targetData.user)) return errorResponse('Unblock this staff member before resending their invitation.', 409);
    const redirectTo = env.ADMIN_INVITE_REDIRECT_URL ?? 'https://admin.pawheaven.online/accept-invite';
    // Supabase does not permit a second invite for an existing Auth user. A
    // recovery link lets a pending invitee choose their first password, and
    // this page supports both recovery and invitation links.
    const { error } = await supabase(env).auth.resetPasswordForEmail(targetData.user.email, { redirectTo });
    if (error) return authAdminError('admin.invite_resend', error);
    const { error: auditError } = await adminClient.from('admin_invitation_audit').insert({
      invited_email: targetData.user.email,
      invited_user_id: targetData.user.id,
      invited_by: current.user.id,
    });
    if (auditError) console.error(JSON.stringify({ operation: 'admin.invite_resend_audit', error: auditError.message, invitedUserId: targetData.user.id }));
    console.info(JSON.stringify({ operation: 'admin.invite_resend', invitedUserId: targetData.user.id, invitedBy: current.user.id }));
    return respond({ message: 'A new password setup email was sent.' });
  }

  if (path === '/admin/invitations' && request.method === 'POST') {
    if (role !== 'superuser') return errorResponse('Only superusers can invite staff.', 403);
    const body = await jsonBody(request) as Record<string, unknown> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!validEmail(email)) return errorResponse('Enter a valid email address.', 400);
    const adminClient = supabaseAdmin(env);
    if (!adminClient) return errorResponse('Staff invitations are not configured. Contact the deployment owner.', 503);
    const redirectTo = env.ADMIN_INVITE_REDIRECT_URL ?? 'https://admin.pawheaven.online/accept-invite';
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError || !invited.user) {
      console.error(JSON.stringify({ operation: 'admin.invite', error: inviteError?.message ?? 'No invited user returned' }));
      return errorResponse('We could not send that invitation. Check the address or try again later.', inviteError?.status === 429 ? 429 : 400);
    }
    const { error: roleError } = await adminClient.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { ...invited.user.app_metadata, role: 'staff' },
    });
    if (roleError) {
      console.error(JSON.stringify({ operation: 'admin.invite_role', error: roleError.message, invitedUserId: invited.user.id }));
      return errorResponse('The invitation was not completed. Contact the deployment owner before asking the person to sign in.', 503);
    }
    const { error: auditError } = await adminClient.from('admin_invitation_audit').insert({
      invited_email: email,
      invited_user_id: invited.user.id,
      invited_by: current.user.id,
    });
    if (auditError) console.error(JSON.stringify({ operation: 'admin.invite_audit', error: auditError.message, invitedUserId: invited.user.id }));
    console.info(JSON.stringify({ operation: 'admin.invite', invitedUserId: invited.user.id, invitedBy: current.user.id }));
    return respond({ message: 'Invitation sent.' }, 201);
  }

  return null;
}
