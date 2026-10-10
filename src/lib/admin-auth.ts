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
  // Fails closed: with CRON_SECRET unset, a request without the header used to
  // compare undefined === undefined and pass.
  const header = req.headers['x-internal-secret'];
  return secretsMatch(Array.isArray(header) ? header[0] : header, process.env.CRON_SECRET);
}

/** Header an internal server-to-server call carries (see isInternalCall). */
export function internalCallHeaders(): Record<string, string> {
  return process.env.CRON_SECRET ? { 'x-internal-secret': process.env.CRON_SECRET } : {};
}

/**
 * Constant-time string comparison for shared secrets.
 */
export function secretsMatch(provided: string | undefined | null, expected: string | undefined | null): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * True when the Authorization header is `Bearer ${CRON_SECRET}`.
 *
 * This is the only proof a scheduled request is accepted on: Vercel cron sends
 * exactly this header when the project has CRON_SECRET set. Fails closed when
 * CRON_SECRET is unset. User-agent and x-vercel-* headers are not checked —
 * any client can send them.
 */
export function isCronAuthorizedHeader(authorization: string | undefined | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization || !authorization.startsWith('Bearer ')) return false;
  return secretsMatch(authorization.slice(7), secret);
}

/** Pages-router convenience wrapper around isCronAuthorizedHeader. */
export function isCronAuthorized(req: NextApiRequest): boolean {
  return isCronAuthorizedHeader(req.headers.authorization);
}

/**
 * Resolve a member portal session token (the `member_session` cookie) to the
 * member and account it belongs to. Same lookup the /api/member/* routes do
 * inline. Returns null when the token is missing, unknown or expired.
 */
export async function resolveMemberSession(sessionToken: string | undefined | null) {
  if (!sessionToken) return null;

  const { data: session, error } = await supabaseAdmin
    .from('member_portal_sessions')
    .select('member_id, members(account_id)')
    .eq('session_token', sessionToken)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (error || !session) return null;

  const member = Array.isArray(session.members) ? session.members[0] : session.members;
  return {
    member_id: session.member_id as string,
    account_id: (member?.account_id ?? null) as string | null,
  };
}

function readCookie(cookieHeader: string | undefined | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return undefined;
}

export type AccountAccess =
  | { ok: true; via: 'admin' | 'member'; memberAccountId?: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Who may act on a billing account: an active admin (Bearer token), or the
 * member portal user whose own account it is (`member_session` cookie).
 * Used by routes the member portal legitimately calls with its own
 * account_id — balance payment, payment methods, adding a secondary member.
 */
export async function authorizeAccountAccess(
  headers: { authorization?: string | null; cookie?: string | null },
  accountId: string | undefined | null
): Promise<AccountAccess> {
  const bearer = headers.authorization?.startsWith('Bearer ') ? headers.authorization.slice(7) : undefined;
  if (bearer && (await resolveAdmin(bearer))) {
    return { ok: true, via: 'admin' };
  }

  const member = await resolveMemberSession(readCookie(headers.cookie, 'member_session'));
  if (!member) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!accountId || !member.account_id || member.account_id !== accountId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, via: 'member', memberAccountId: member.account_id };
}

/** Pages-router convenience wrapper around authorizeAccountAccess. */
export function authorizeAccountAccessReq(req: NextApiRequest, accountId: string | undefined | null) {
  return authorizeAccountAccess(
    { authorization: req.headers.authorization, cookie: req.headers.cookie },
    accountId
  );
}

/**
 * As authorizeAccountAccess, for a Stripe object known only by its customer:
 * an admin, or the member whose own account holds that Stripe customer.
 */
export async function authorizeStripeCustomerAccess(
  req: NextApiRequest,
  stripeCustomerId: string | null | undefined
): Promise<AccountAccess> {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  if (bearer && (await resolveAdmin(bearer))) {
    return { ok: true, via: 'admin' };
  }

  const member = await resolveMemberSession(readCookie(req.headers.cookie, 'member_session'));
  if (!member) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!member.account_id || !stripeCustomerId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('stripe_customer_id')
    .eq('account_id', member.account_id)
    .single();

  if (!account?.stripe_customer_id || account.stripe_customer_id !== stripeCustomerId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, via: 'member', memberAccountId: member.account_id };
}
