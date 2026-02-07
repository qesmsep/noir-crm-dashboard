import { supabaseAdmin } from './supabase';
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
 * Check if account is locked
 */
export async function isAccountLocked(phone: string): Promise<{ locked: boolean; until?: Date }> {
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('account_locked_until, failed_login_count')
    .eq('phone', phone)
    .single();

  if (!member || !member.account_locked_until) {
    return { locked: false };
  }

  const lockedUntil = new Date(member.account_locked_until);
  if (lockedUntil > new Date()) {
    return { locked: true, until: lockedUntil };
  }

  // Auto-unlock if expired
  await supabaseAdmin
    .from('members')
    .update({ account_locked_until: null, failed_login_count: 0 })
    .eq('phone', phone);

  return { locked: false };
}

/**
 * Record failed login attempt and check if account should be locked
 */
export async function recordFailedLogin(
  phone: string,
  ipAddress: string
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
    .select('*')
    .eq('phone', phone)
    .eq('success', false)
    .gte('created_at', fifteenMinutesAgo.toISOString());

  const failedCount = recentAttempts?.length || 0;
  const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - failedCount);

  // Lock account if too many failed attempts
  if (failedCount >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

    await supabaseAdmin
      .from('members')
      .update({
        account_locked_until: lockedUntil.toISOString(),
        failed_login_count: failedCount,
      })
      .eq('phone', phone);

    return { shouldLock: true, attemptsLeft: 0 };
  }

  // Update failed login count
  await supabaseAdmin
    .from('members')
    .update({ failed_login_count: failedCount })
    .eq('phone', phone);

  return { shouldLock: false, attemptsLeft };
}

/**
 * Record successful login and clear failed attempts
 */
export async function recordSuccessfulLogin(phone: string, ipAddress: string): Promise<void> {
  // Record successful attempt
  await supabaseAdmin.from('login_attempts').insert({
    phone,
    ip_address: ipAddress,
    success: true,
  });

  // Reset failed login count
  await supabaseAdmin
    .from('members')
    .update({
      account_locked_until: null,
      failed_login_count: 0,
    })
    .eq('phone', phone);
}

/**
 * Rate limiting check by IP address
 */
export async function checkRateLimit(
  ipAddress: string,
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
  metadata?: Record<string, any>;
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
