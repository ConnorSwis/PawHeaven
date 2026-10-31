import { errorResponse, respond, type ApiResponse } from '../lib/http';
import { adminIdentity, adminUser, clearSession, sessionResponse, type AdminContext, type RouteContext } from '../lib/session';
import { adminApplicationRoutes } from './admin-applications';
import { adminDonationRoutes } from './admin-donations';
import { adminFosterApplicationRoutes } from './admin-foster-applications';
import { adminInvitationRoutes } from './admin-invitations';
import { adminLostPetRoutes } from './admin-lost-pets';
import { adminOutreachRoutes } from './admin-outreach';
import { adminPetRoutes } from './admin-pets';
import { adminUserRoutes } from './admin-users';
import { adminScheduleRoutes } from './admin-schedule';
import { adminVisitRoutes } from './admin-visits';
import { adminVolunteerRoutes } from './admin-volunteer';

/**
 * Staff-level access gate. Every /admin route requires staff, admin, or
 * superuser; account management and invitations apply their own stricter checks.
 */
export async function adminRoutes(context: RouteContext): Promise<ApiResponse> {
  const { request, env, path } = context;
  const authorized = await adminIdentity(request, env);
  if (!authorized) return clearSession(errorResponse('Not signed in.', 401), request);
  const { current, role } = authorized;
  if (!role) return sessionResponse(errorResponse('This account does not have administrator access.', 403), request, current);

  const admin: AdminContext = { ...context, current, role };
  if (path === '/admin/me' && request.method === 'GET') return sessionResponse(respond({ user: adminUser(current.user, role) }), request, current);

  const response = (await adminUserRoutes(admin))
    ?? (await adminInvitationRoutes(admin))
    ?? (await adminPetRoutes(admin))
    ?? (await adminApplicationRoutes(admin))
    ?? (await adminFosterApplicationRoutes(admin))
    ?? (await adminVisitRoutes(admin))
    ?? (await adminVolunteerRoutes(admin))
    ?? (await adminScheduleRoutes(admin))
    ?? (await adminOutreachRoutes(admin))
    ?? (await adminLostPetRoutes(admin))
    ?? (await adminDonationRoutes(admin))
    ?? errorResponse('Not found.', 404);
  return sessionResponse(response, request, current);
}
