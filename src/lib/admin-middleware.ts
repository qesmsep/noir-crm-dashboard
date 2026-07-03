import { NextResponse } from 'next/server';
import { resolveAdmin } from './admin-auth';

/**
 * Verify that the request comes from an authenticated admin user.
 * Checks for valid Bearer token and active admin status in database.
 *
 * Delegates the token + `admins` table lookup to the shared `resolveAdmin`
 * helper so there is a single source of truth for admin auth.
 *
 * @param request - The incoming request object
 * @returns Object with authorized status and either user data or error response
 */
export async function verifyAdminAccess(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const admin = await resolveAdmin(authHeader.split(' ')[1]);
  if (!admin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    };
  }

  return { authorized: true, user: admin.user, adminData: admin.adminData };
}
