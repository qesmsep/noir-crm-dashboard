import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  getClientIP,
  getUserAgent,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  checkRateLimit,
  logAuthEvent,
} from '@/lib/security';
import { serialize } from 'cookie';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const SESSION_DURATION_DAYS = 7; // Reduced from 30 days

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ipAddress = getClientIP(req);
  const userAgent = getUserAgent(req);

  try {
    const { phone, password } = requestSchema.parse(req.body);

    // Normalize phone number (remove all non-digits, then take last 10 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.slice(-10); // Take last 10 digits (removes +1, *1, etc.)

    // Check rate limiting by IP
    const rateLimit = await checkRateLimit(ipAddress, 'login');
    if (!rateLimit.allowed) {
      await logAuthEvent({
        phone: normalizedPhone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'rate_limited' },
      });

      return res.status(429).json({
        error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter,
      });
    }

    // Check if account is locked
    const lockStatus = await isAccountLocked(normalizedPhone);
    if (lockStatus.locked) {
      await logAuthEvent({
        phone: normalizedPhone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'account_locked', locked_until: lockStatus.until },
      });

      const minutesLeft = lockStatus.until
        ? Math.ceil((lockStatus.until.getTime() - Date.now()) / 60000)
        : 15;

      return res.status(403).json({
        error: `Account is locked due to multiple failed login attempts. Please try again in ${minutesLeft} minutes.`,
        lockedUntil: lockStatus.until,
      });
    }

    // Get member by phone (try both with and without +1 prefix)
    let member: any = null;
    let memberError: any = null;

    // Try exact match with normalized phone
    const result1 = await supabaseAdmin
      .from('members')
      .select('member_id, auth_user_id, email, first_name, last_name, phone, password_hash, membership, password_is_temporary')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (result1.data && result1.data.length > 0) {
      member = result1.data[0];
      if (result1.data.length > 1) {
        console.warn('[LOGIN] WARNING: Multiple members found with phone:', normalizedPhone);
      }
    } else {
      // Try with +1 prefix
      const result2 = await supabaseAdmin
        .from('members')
        .select('member_id, auth_user_id, email, first_name, last_name, phone, password_hash, membership, password_is_temporary')
        .eq('phone', `+1${normalizedPhone}`)
        .limit(1);

      if (result2.data && result2.data.length > 0) {
        member = result2.data[0];
        if (result2.data.length > 1) {
          console.warn('[LOGIN] WARNING: Multiple members found with phone:', `+1${normalizedPhone}`);
        }
      }
      memberError = result2.error;
    }

    if (memberError || !member) {
      await recordFailedLogin(normalizedPhone, ipAddress);
      await logAuthEvent({
        phone: normalizedPhone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'member_not_found' },
      });

      return res.status(401).json({
        error: 'Invalid phone number or password',
      });
    }

    // Check if member has password set
    if (!member.password_hash) {
      await logAuthEvent({
        memberId: member.member_id,
        phone: normalizedPhone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'no_password_set' },
      });

      return res.status(400).json({
        error: 'No password set for this account. Please reset your password.',
        needsPasswordSetup: true,
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, member.password_hash);

    if (!passwordMatch) {
      const failedResult = await recordFailedLogin(normalizedPhone, ipAddress);

      await logAuthEvent({
        memberId: member.member_id,
        phone: normalizedPhone,
        eventType: failedResult.shouldLock ? 'account_locked' : 'login_failed',
        ipAddress,
        userAgent,
        metadata: {
          reason: 'invalid_password',
          attempts_left: failedResult.attemptsLeft,
        },
      });

      if (failedResult.shouldLock) {
        return res.status(403).json({
          error: 'Account locked due to multiple failed login attempts. Please try again in 15 minutes.',
        });
      }

      return res.status(401).json({
        error: `Invalid phone number or password. ${failedResult.attemptsLeft} attempts remaining.`,
        attemptsLeft: failedResult.attemptsLeft,
      });
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Create member portal session
    const { error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .insert({
        member_id: member.member_id,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Record successful login
    await recordSuccessfulLogin(normalizedPhone, ipAddress);
    await logAuthEvent({
      memberId: member.member_id,
      phone: normalizedPhone,
      eventType: 'login_success',
      ipAddress,
      userAgent,
      metadata: { membership: member.membership },
    });

    // Set httpOnly cookie for session (secure in production)
    res.setHeader('Set-Cookie', [
      serialize('member_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
        path: '/',
      }),
    ]);

    res.status(200).json({
      success: true,
      passwordIsTemporary: member.password_is_temporary || false,
      member: {
        id: member.member_id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        phone: member.phone,
        membership: member.membership,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
