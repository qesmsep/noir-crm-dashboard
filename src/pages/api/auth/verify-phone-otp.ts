import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { serialize } from 'cookie';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const MAX_ATTEMPTS = 5;
const SESSION_DURATION_DAYS = 7;
const MAX_FAILED_VERIFICATIONS_15MIN = 5;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[VERIFY-OTP] Request body:', { phone: req.body.phone, code: req.body.code });

    const { phone, code } = requestSchema.parse(req.body);

    // Normalize phone number (remove all non-digits, then take last 10 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.slice(-10);

    console.log('[VERIFY-OTP] Normalized phone:', normalizedPhone, 'Code length:', code.length);

    // Get client IP address
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                     (req.headers['x-real-ip'] as string) ||
                     req.socket.remoteAddress ||
                     'unknown';

    // ACCOUNT LOCKOUT: Check for too many failed verification attempts (5 in 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: recentFailedAttempts, error: failedCheckError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('attempts')
      .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
      .gte('created_at', fifteenMinutesAgo.toISOString());

    if (failedCheckError) {
      console.error('Failed to check account lockout:', failedCheckError);
    } else if (recentFailedAttempts) {
      const totalFailedAttempts = recentFailedAttempts.reduce((sum, record) => sum + (record.attempts || 0), 0);
      if (totalFailedAttempts >= MAX_FAILED_VERIFICATIONS_15MIN) {
        // AUDIT LOG: Account locked due to too many failed attempts
        console.log('[AUTH-AUDIT] Account Locked', {
          event: 'account_locked',
          phone: normalizedPhone,
          ip_address: clientIp,
          failed_attempts: totalFailedAttempts,
          timestamp: new Date().toISOString(),
        });

        return res.status(429).json({
          error: 'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes or contact support.',
          retryAfter: 900, // 15 minutes
        });
      }
    }

    // Find the most recent OTP for this phone (try both with and without +1)
    let otpRecords: any = null;

    const otp1 = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otp1.data && otp1.data.length > 0) {
      otpRecords = otp1.data;
    } else {
      const otp2 = await supabaseAdmin
        .from('phone_otp_codes')
        .select('*')
        .eq('phone', `+1${normalizedPhone}`)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (otp2.data && otp2.data.length > 0) {
        otpRecords = otp2.data;
      }
    }

    if (!otpRecords || otpRecords.length === 0) {
      console.error('[VERIFY-OTP] No unverified OTP found for phone:', normalizedPhone);
      return res.status(400).json({
        error: 'No verification code found. Please request a new code.',
      });
    }

    const otpRecord = otpRecords[0];

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
      });
    }

    // Check max attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new code.',
      });
    }

    // Increment attempts
    await supabaseAdmin
      .from('phone_otp_codes')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify code
    if (otpRecord.code !== code) {
      // AUDIT LOG: Failed verification attempt
      console.log('[AUTH-AUDIT] OTP Verification Failed', {
        event: 'otp_verification_failed',
        phone: normalizedPhone,
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        attempts: otpRecord.attempts + 1,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        error: 'Invalid verification code. Please try again.',
      });
    }

    // Mark as verified
    await supabaseAdmin
      .from('phone_otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    // Get member by phone (try both with and without +1 prefix)
    let member: any = null;

    const result1 = await supabaseAdmin
      .from('members')
      .select('member_id, auth_user_id, email, first_name, last_name, phone, password_hash, password_is_temporary')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (result1.data && result1.data.length > 0) {
      member = result1.data[0];
      if (result1.data.length > 1) {
        console.warn('[VERIFY-OTP] WARNING: Multiple members found with phone:', normalizedPhone);
      }
    } else {
      const result2 = await supabaseAdmin
        .from('members')
        .select('member_id, auth_user_id, email, first_name, last_name, phone, password_hash, password_is_temporary')
        .eq('phone', `+1${normalizedPhone}`)
        .limit(1);

      if (result2.data && result2.data.length > 0) {
        member = result2.data[0];
        if (result2.data.length > 1) {
          console.warn('[VERIFY-OTP] WARNING: Multiple members found with phone:', `+1${normalizedPhone}`);
        }
      }
    }

    if (!member) {
      return res.status(404).json({
        error: 'Member not found',
      });
    }

    // If member doesn't have auth_user_id, create Supabase Auth user on first login
    if (!member.auth_user_id) {
      console.log('[VERIFY-OTP] First time login - creating Supabase Auth user for member:', member.member_id);

      try {
        let authUserId: string | null = null;

        // Try to create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email || `${member.phone}@noirkc.com`,
          phone: member.phone.startsWith('+') ? member.phone : `+1${normalizedPhone}`,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            first_name: member.first_name,
            last_name: member.last_name,
            member_id: member.member_id,
          },
        });

        if (authError) {
          // If email already exists, try to find existing auth user by email
          if (authError.message?.includes('email address has already been registered') || authError.code === 'email_exists') {
            console.log('[VERIFY-OTP] Email exists, finding existing auth user by email:', member.email);

            const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

            if (listError) {
              console.error('[VERIFY-OTP] Failed to list users:', listError);
              return res.status(500).json({
                error: 'Failed to set up account. Please contact support.',
              });
            }

            const existingUser = existingUsers.users.find(u => u.email === member.email);

            if (existingUser) {
              console.log('[VERIFY-OTP] Found existing auth user:', existingUser.id);
              authUserId = existingUser.id;
            } else {
              console.error('[VERIFY-OTP] Email exists but user not found');
              return res.status(500).json({
                error: 'Failed to set up account. Please contact support.',
              });
            }
          } else {
            console.error('[VERIFY-OTP] Failed to create auth user:', authError);
            return res.status(500).json({
              error: 'Failed to create account. Please try again.',
            });
          }
        } else {
          authUserId = authData.user.id;
          console.log('[VERIFY-OTP] Created new auth user:', authUserId);
        }

        // Link auth user to member
        const { error: linkError } = await supabaseAdmin
          .from('members')
          .update({ auth_user_id: authUserId })
          .eq('member_id', member.member_id);

        if (linkError) {
          console.error('[VERIFY-OTP] Failed to link auth user to member:', linkError);
          return res.status(500).json({
            error: 'Failed to link account. Please try again.',
          });
        }

        member.auth_user_id = authUserId;
        console.log('[VERIFY-OTP] Successfully linked auth user to member');
      } catch (createError: any) {
        console.error('[VERIFY-OTP] Error during auth user creation:', createError);
        return res.status(500).json({
          error: 'Failed to set up account. Please contact support.',
        });
      }
    }

    // Generate session token for member
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Create member portal session
    const { error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .insert({
        member_id: member.member_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Set httpOnly cookie for session (secure in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      path: '/',
      // Explicitly set domain for production
      ...(isProduction && { domain: '.noirkc.com' }),
    };

    const cookie = serialize('member_session', sessionToken, cookieOptions);

    console.log('[VERIFY-OTP] Setting cookie:', {
      name: 'member_session',
      options: cookieOptions,
      cookieString: cookie.split(';').slice(0, 2).join(';'), // Log first parts only (not the full token)
    });

    res.setHeader('Set-Cookie', [cookie]);

    // Check if member needs to set a password
    const needsPassword = !member.password_hash || member.password_is_temporary;

    // AUDIT LOG: Successful OTP verification and login
    console.log('[AUTH-AUDIT] OTP Verification Success', {
      event: 'otp_verification_success',
      member_id: member.member_id,
      phone: normalizedPhone,
      ip_address: clientIp,
      user_agent: req.headers['user-agent'],
      needs_password: needsPassword,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      needsPasswordSetup: needsPassword,
      member: {
        id: member.member_id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        phone: member.phone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[VERIFY-OTP] Validation error:', error.issues);
      return res.status(400).json({
        error: error.issues[0].message,
        details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      });
    }

    console.error('Verify phone OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
