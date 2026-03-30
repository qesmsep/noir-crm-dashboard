import { NextApiRequest } from 'next';
import { supabaseAdmin } from './supabase';

/**
 * Verify the request comes from an authenticated admin.
 * Uses Bearer token + admins table lookup (pages router pattern).
 */
export async function verifyAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('access_level')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single();

  return !!admin;
}

/**
 * Check if the request is an internal service call (webhook/cron).
 * Uses a dedicated x-internal-secret header to avoid ambiguity with
 * the Authorization header used by admin JWTs.
 */
export function isInternalCall(req: NextApiRequest): boolean {
  return req.headers['x-internal-secret'] === process.env.CRON_SECRET;
}
