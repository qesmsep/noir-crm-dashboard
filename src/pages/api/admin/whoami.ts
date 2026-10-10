import type { NextApiResponse } from 'next';
import { withAdminAuth, type AuthenticatedRequest } from '@/lib/api-auth';

/**
 * GET /api/admin/whoami
 *
 * 200 with the caller's access level when the Bearer token belongs to an
 * active admin; 401/403 otherwise (withAdminAuth). The admin layout uses it
 * to keep signed-in non-admins (members also get Supabase users) out of the
 * admin UI. It reads the admins table server-side, so it does not depend on
 * the table's RLS policies.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ admin: true, access_level: req.user?.access_level ?? null });
}

export default withAdminAuth(handler);
