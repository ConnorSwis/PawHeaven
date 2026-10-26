import type { User } from '@supabase/supabase-js';
import type {
  AdminUserDetailResponse,
  AdminUserListResponse,
  AdminUserRoleInput,
  AdminUserUpdateInput,
} from '@pawheaven/contracts';
import type { DatabaseAdoptionApplication } from '../lib/applications';
import { applicationForClient } from '../lib/applications';
import { databaseError, errorResponse, jsonBody, respond, validEmail, type ApiResponse } from '../lib/http';
import { adminRole, isBlocked, managedUser, mayManageUser, type AdminContext } from '../lib/session';
import { supabase, supabaseAdmin } from '../lib/supabase';

const USER_PATH = /^\/admin\/users\/([0-9a-f-]{36})(?:\/(access|password-reset|role))?$/i;

function authAdminError(operation: string, error: { message: string; status?: number }): ApiResponse {
  console.error(JSON.stringify({ operation, error: error.message }));
  if (error.status === 429) return errorResponse('Too many account changes were requested. Please wait and try again.', 429);
  return errorResponse('The account service could not complete that change. Please try again.', 503);
}

async function lookupTarget(adminClient: NonNullable<ReturnType<typeof supabaseAdmin>>, id: string, operation: string): Promise<{ user: User } | { response: ApiResponse }> {
  const { data, error } = await adminClient.auth.admin.getUserById(id);
  if (error || !data.user) {
    return { response: error?.status === 404 ? errorResponse('User not found.', 404) : authAdminError(operation, error ?? { message: 'No user returned' }) };
  }
  return { user: data.user };
}

/** Account management is limited to administrators and superusers; staff never reach these routes. */
export async function adminUserRoutes({ request, env, path, current, role }: AdminContext): Promise<ApiResponse | null> {
  if (!path.startsWith('/admin/users')) return null;
  const adminClient = supabaseAdmin(env);
  if (!adminClient) return errorResponse('User management is not configured. Contact the deployment owner.', 503);

  if (path === '/admin/users' && request.method === 'GET') {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return authAdminError('admin.users.list', error);
    const users = data.users.map(managedUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const payload: AdminUserListResponse = { users };
    return respond(payload);
  }

  const match = path.match(USER_PATH);
  if (!match) return null;
  const [, targetId, action] = match;

  if (!action && request.method === 'GET') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.get');
    if ('response' in target) return target.response;
    const { data: applications, error } = await adminClient.from('adoption_applications').select('*').eq('applicant_id', target.user.id).order('submitted_at', { ascending: false }).limit(100);
    if (error) return databaseError('admin.users.applications', error);
    const payload: AdminUserDetailResponse = {
      user: managedUser(target.user),
      applications: (applications as DatabaseAdoptionApplication[]).map(applicationForClient),
    };
    return respond(payload);
  }

  if (!action && request.method === 'PUT') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.update_lookup');
    if ('response' in target) return target.response;
    if (!mayManageUser(role, current.user.id, target.user)) return errorResponse('You cannot edit this staff account.', 403);
    const body = await jsonBody(request) as Partial<AdminUserUpdateInput> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || name.length > 100 || !validEmail(email)) return errorResponse('Enter a name and valid email address.', 400);
    const { data, error } = await adminClient.auth.admin.updateUserById(target.user.id, {
      email,
      user_metadata: { ...target.user.user_metadata, name },
    });
    if (error || !data.user) return authAdminError('admin.users.update', error ?? { message: 'No user returned' });
    console.info(JSON.stringify({ operation: 'admin.users.update', targetUserId: data.user.id, actorUserId: current.user.id }));
    return respond({ user: managedUser(data.user) });
  }

  if (action === 'access' && request.method === 'PUT') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.access_lookup');
    if ('response' in target) return target.response;
    if (!mayManageUser(role, current.user.id, target.user)) return errorResponse('You cannot change access for this staff account.', 403);
    const body = await jsonBody(request) as { blocked?: unknown } | null;
    if (typeof body?.blocked !== 'boolean') return errorResponse('Choose whether this account is blocked.', 400);
    const { data, error } = await adminClient.auth.admin.updateUserById(target.user.id, { ban_duration: body.blocked ? '876000h' : 'none' });
    if (error || !data.user) return authAdminError('admin.users.access', error ?? { message: 'No user returned' });
    console.info(JSON.stringify({ operation: body.blocked ? 'admin.users.block' : 'admin.users.unblock', targetUserId: data.user.id, actorUserId: current.user.id }));
    return respond({ user: managedUser(data.user) });
  }

  if (action === 'role' && request.method === 'PUT') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.role_lookup');
    if ('response' in target) return target.response;
    if (!mayManageUser(role, current.user.id, target.user)) return errorResponse('You cannot change the role of this account.', 403);
    if (role !== 'superuser') return errorResponse('Only a superuser can change an account’s role.', 403);
    const body = await jsonBody(request) as Partial<AdminUserRoleInput> | null;
    if (body?.role !== 'member' && body?.role !== 'staff') return errorResponse('Choose Member or Staff.', 400);
    const { data, error } = await adminClient.auth.admin.updateUserById(target.user.id, {
      // A null value removes the key from app_metadata.
      app_metadata: { ...target.user.app_metadata, role: body.role === 'staff' ? 'staff' : null },
    });
    if (error || !data.user) return authAdminError('admin.users.role', error ?? { message: 'No user returned' });
    console.info(JSON.stringify({ operation: 'admin.users.role', targetUserId: data.user.id, actorUserId: current.user.id, role: body.role }));
    return respond({ user: managedUser(data.user) });
  }

  if (action === 'password-reset' && request.method === 'POST') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.password_reset_lookup');
    if ('response' in target) return target.response;
    if (!mayManageUser(role, current.user.id, target.user) || !target.user.email) return errorResponse('You cannot reset the password for this staff account.', 403);
    if (isBlocked(target.user)) return errorResponse('Unblock this account before sending a password reset.', 409);
    const redirectTo = env.ADMIN_INVITE_REDIRECT_URL ?? 'https://admin.pawheaven.online/accept-invite';
    const { error } = await supabase(env).auth.resetPasswordForEmail(target.user.email, { redirectTo });
    if (error) return authAdminError('admin.users.password_reset', error);
    console.info(JSON.stringify({ operation: 'admin.users.password_reset', targetUserId: target.user.id, actorUserId: current.user.id }));
    return respond({ message: 'Password reset email sent.' });
  }

  if (!action && request.method === 'DELETE') {
    const target = await lookupTarget(adminClient, targetId, 'admin.users.delete_lookup');
    if ('response' in target) return target.response;
    if (!mayManageUser(role, current.user.id, target.user)) return errorResponse('You cannot delete this staff account.', 403);
    const targetRole = adminRole(target.user);
    if (targetRole === 'staff') {
      const { error: auditError } = await adminClient.from('admin_invitation_audit').delete().eq('invited_user_id', target.user.id);
      if (auditError) return databaseError('admin.users.delete_invitation_audit', auditError);
    }
    const { error } = await adminClient.auth.admin.deleteUser(target.user.id, false);
    if (error) return authAdminError('admin.users.delete', error);
    console.info(JSON.stringify({ operation: 'admin.users.delete', targetUserId: target.user.id, actorUserId: current.user.id, targetRole: targetRole ?? 'member' }));
    return respond({ ok: true });
  }

  return null;
}
