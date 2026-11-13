import { NextApiRequest } from 'next';
import { timingSafeEqual } from 'crypto';
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
  const secret = process.env.CRON_SECRET;
  const given = req.headers['x-internal-secret'];
  if (!secret || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guard for pages-router API routes: lets through an active admin (Bearer
 * token) or an internal caller (x-internal-secret = CRON_SECRET). Otherwise
 * sends 401 and returns false, so a route can simply `if (!(await requireAdmin(req, res))) return;`.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  opts: { allowInternal?: boolean } = { allowInternal: true },
): Promise<boolean> {
  if (opts.allowInternal !== false && process.env.CRON_SECRET && isInternalCall(req)) return true;
  if (await verifyAdmin(req)) return true;
  res.status(401).json({ error: 'Admin access required' });
  return false;
}
