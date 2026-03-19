import { supabaseAdmin } from './supabase';
import { Logger } from '@/lib/logger';
import type { NextApiRequest } from 'next';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Get client IP address from request
 */
export function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.socket.remoteAddress || 'unknown';
  return ip;
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: NextApiRequest): string {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Max rows to fetch in fallback normalization query to prevent unbounded table scans.
 * Set high enough to cover the full member base for now.
 * TODO(#phone-normalization): Replace fallback with a phone_normalized indexed column
 * and remove this limit entirely.
 */
const FALLBACK_MEMBER_LIMIT = 5000;

/** Base shape for all findMemberByPhone results. */
interface MemberBase {
  member_id: string;
}

/**
 * Normalize a phone string to its last 10 digits.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Mask a phone number for logging (PII protection).
 * "5551234567" → "***4567"
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return '***' + phone.slice(-4);
}

/**
 * Find a member by phone number.
 * Accepts any phone format — normalizes to last 10 digits internally.
 *
 * Lookup strategy (short-circuits on first hit):
 *   1. Exact match on raw 10-digit number
 *   2. Exact match with +1 prefix
 *   3. Fallback: fetch up to {@link FALLBACK_MEMBER_LIMIT} rows and normalize in-memory
 *
 * @param phone - Phone number in any format (will be normalized)
 * @param select - Supabase select string. Must include 'member_id'.
 * @param opts.includeDeactivated - If true, skips the deactivated=false filter (needed for lockout checks)
 * @returns The matched member row, or null
 */
export async function findMemberByPhone<T extends MemberBase = MemberBase>(
  phone: string,
  select: string = 'member_id, phone',
  opts?: { includeDeactivated?: boolean }
): Promise<T | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) {
    Logger.warn('findMemberByPhone: phone too short after normalization', { phone: maskPhone(phone) });
    return null;
  }

  const filterDeactivated = !opts?.includeDeactivated;

  // 1. Exact match (fastest)
  let query1 = supabaseAdmin.from('members').select(select).eq('phone', normalized);
  if (filterDeactivated) query1 = query1.eq('deactivated', false);
  const result1 = await query1.limit(1);

  if (result1.error) {
    Logger.error('findMemberByPhone: exact match query error', result1.error, { phone: maskPhone(normalized) });
  }
  if (result1.data && result1.data.length > 0) {
    return result1.data[0] as unknown as T;
  }

  // 2. Try with +1 prefix
  let query2 = supabaseAdmin.from('members').select(select).eq('phone', `+1${normalized}`);
  if (filterDeactivated) query2 = query2.eq('deactivated', false);
  const result2 = await query2.limit(1);

  if (result2.error) {
    Logger.error('findMemberByPhone: +1 prefix query error', result2.error, { phone: maskPhone(normalized) });
  }
  if (result2.data && result2.data.length > 0) {
    return result2.data[0] as unknown as T;
  }

  // 3. Fallback: fetch members and normalize in-memory.
  //    Capped at FALLBACK_MEMBER_LIMIT to bound memory/transfer.
  //    TODO(#phone-normalization): Remove once phone_normalized column exists.
  const selectFields = select.split(',').map(s => s.trim());
  const fallbackSelect = selectFields.includes('phone') ? select : `${select}, phone`;

  let query3 = supabaseAdmin.from('members').select(fallbackSelect).not('phone', 'is', null);
  if (filterDeactivated) query3 = query3.eq('deactivated', false);
  const result3 = await query3.limit(FALLBACK_MEMBER_LIMIT);

  if (result3.error) {
    Logger.error('findMemberByPhone: fallback query error', result3.error, { phone: maskPhone(normalized) });
    return null;
  }

  if (result3.data && result3.data.length >= FALLBACK_MEMBER_LIMIT) {
    Logger.error('findMemberByPhone: fallback hit row limit — member may not be found. Run phone normalization migration.', undefined, {
      limit: FALLBACK_MEMBER_LIMIT,
      phone: maskPhone(normalized),
    });
  }

  const rows = result3.data as unknown as Array<Record<string, unknown>>;
  const match = rows?.find((m) => {
    const dbPhone = normalizePhone(String(m.phone || ''));
    return dbPhone === normalized;
  }) || null;

  if (match) {
    Logger.warn('findMemberByPhone: resolved via fallback normalization — consider normalizing this phone in the DB', {
      phone: maskPhone(normalized),
      member_id: match.member_id,
    });
  }

  return match as unknown as T | null;
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(phone: string): Promise<{ locked: boolean; until?: Date }> {
  // Include deactivated members — lockout status must be visible regardless of account status
  const member = await findMemberByPhone(phone, 'member_id, phone, account_locked_until, failed_login_count', { includeDeactivated: true });

  if (!member || !member.account_locked_until) {
    return { locked: false };
  }

  const lockedUntil = new Date(member.account_locked_until as string);
  if (lockedUntil > new Date()) {
    return { locked: true, until: lockedUntil };
  }

  // Auto-unlock if expired
  await supabaseAdmin
    .from('members')
    .update({ account_locked_until: null, failed_login_count: 0 })
    .eq('member_id', member.member_id);

  return { locked: false };
}

/**
 * Record failed login attempt and check if account should be locked.
 *
 * @param phone - Normalized phone number
 * @param ipAddress - Client IP
 * @param memberId - If already resolved, pass to skip redundant lookup
 */
export async function recordFailedLogin(
  phone: string,
  ipAddress: string,
  memberId?: string,
): Promise<{ shouldLock: boolean; attemptsLeft: number }> {
  // Record the failed attempt
  await supabaseAdmin.from('login_attempts').insert({
    phone,
    ip_address: ipAddress,
    success: false,
  });

  // Count failed attempts in last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const { data: recentAttempts } = await supabaseAdmin
    .from('login_attempts')
    .select('created_at')
    .eq('phone', phone)
    .eq('success', false)
    .gte('created_at', fifteenMinutesAgo.toISOString());

  const failedCount = recentAttempts?.length || 0;
  const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - failedCount);

  // Resolve member_id if not provided
  const resolvedMemberId = memberId ??
    (await findMemberByPhone(phone, 'member_id, phone', { includeDeactivated: true }))?.member_id ??
    null;

  if (!resolvedMemberId) {
    Logger.warn('recordFailedLogin: could not find member — lockout tracking skipped', { phone: maskPhone(phone) });
    // Still report attempts left based on IP-level tracking, but don't claim we locked
    return { shouldLock: false, attemptsLeft };
  }

  // Lock account if too many failed attempts
  if (failedCount >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

    await supabaseAdmin
      .from('members')
      .update({
        account_locked_until: lockedUntil.toISOString(),
        failed_login_count: failedCount,
      })
      .eq('member_id', resolvedMemberId);

    return { shouldLock: true, attemptsLeft: 0 };
  }

  // Update failed login count
  await supabaseAdmin
    .from('members')
    .update({ failed_login_count: failedCount })
    .eq('member_id', resolvedMemberId);

  return { shouldLock: false, attemptsLeft };
}

/**
 * Record successful login and clear failed attempts.
 *
 * @param phone - Normalized phone number
 * @param ipAddress - Client IP
 * @param memberId - If already resolved, pass to skip redundant lookup
 */
export async function recordSuccessfulLogin(
  phone: string,
  ipAddress: string,
  memberId?: string,
): Promise<void> {
  // Record successful attempt
  await supabaseAdmin.from('login_attempts').insert({
    phone,
    ip_address: ipAddress,
    success: true,
  });

  // Resolve member_id if not provided
  const resolvedMemberId = memberId ??
    (await findMemberByPhone(phone, 'member_id, phone', { includeDeactivated: true }))?.member_id ??
    null;

  if (!resolvedMemberId) {
    Logger.warn('recordSuccessfulLogin: could not find member — lockout clear skipped', { phone: maskPhone(phone) });
    return;
  }

  await supabaseAdmin
    .from('members')
    .update({
      account_locked_until: null,
      failed_login_count: 0,
    })
    .eq('member_id', resolvedMemberId);
}

/**
 * Rate limiting check by IP address
 */
export async function checkRateLimit(
  ipAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endpoint: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const { data: recentAttempts } = await supabaseAdmin
    .from('login_attempts')
    .select('created_at')
    .eq('ip_address', ipAddress)
    .gte('created_at', windowStart.toISOString());

  const requestCount = recentAttempts?.length || 0;

  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    const oldestAttempt = recentAttempts?.[0]?.created_at;
    if (oldestAttempt) {
      const retryAfter = Math.ceil(
        (new Date(oldestAttempt).getTime() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }
    return { allowed: false };
  }

  return { allowed: true };
}

/**
 * Log authentication event to audit trail
 */
export async function logAuthEvent(params: {
  memberId?: string;
  phone: string;
  eventType: 'login_success' | 'login_failed' | 'password_reset' | 'biometric_registered' | 'biometric_login' | 'logout' | 'account_locked';
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from('auth_audit_logs').insert({
    member_id: params.memberId || null,
    phone: params.phone,
    event_type: params.eventType,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    device_fingerprint: params.deviceFingerprint,
    metadata: params.metadata || {},
  });
}

/**
 * Get cookie domain for session cookies.
 * Uses COOKIE_DOMAIN env var if set, otherwise falls back to '.noirkc.com' in production.
 * Returns undefined in development (cookie scoped to current host).
 */
export function getSessionCookieDomain(): string | undefined {
  const envDomain = process.env.COOKIE_DOMAIN?.trim();
  if (envDomain) {
    return envDomain;
  }
  if (process.env.NODE_ENV === 'production') {
    return '.noirkc.com';
  }
  return undefined;
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // Simple validation - in production, store CSRF tokens in session
  return !!(token && sessionToken && token.length > 0);
}
