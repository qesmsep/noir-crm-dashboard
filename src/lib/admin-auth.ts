import { NextApiRequest } from 'next';
import { supabaseAdmin } from './supabase';

/**
 * Resolve the admin identity for a Bearer token.
 * Shared core used by both the pages-router (`verifyAdmin`) and
 * app-router (`verifyAdminAccess`) auth helpers so the Bearer-token +
 * `admins` table check lives in exactly one place.
 *
 * @returns the authenticated user and admin row, or null if the token is
 *          missing/invalid or the user is not an active admin.
 */
export async function resolveAdmin(token: string | undefined | null) {
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('access_level, status')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!admin) return null;

  return { user, adminData: admin };
}

/**
 * Verify the request comes from an authenticated admin.
 * Uses Bearer token + admins table lookup (pages router pattern).
 */
export async function verifyAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  return (await resolveAdmin(token)) !== null;
}

/**
 * Check if the request is an internal service call (webhook/cron).
 * Uses a dedicated x-internal-secret header to avoid ambiguity with
 * the Authorization header used by admin JWTs.
 */
export function isInternalCall(req: NextApiRequest): boolean {
  return req.headers['x-internal-secret'] === process.env.CRON_SECRET;
}
