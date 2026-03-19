import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { serialize } from 'cookie';
import { getSessionCookieDomain, findMemberByPhone, getClientIP, normalizePhone } from '@/lib/security';
import { Logger } from '@/lib/logger';

interface OtpVerifyMember {
  member_id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password_hash: string | null;
  password_is_temporary: boolean | null;
}

interface OtpRecord {
  id: string;
  phone: string;
  code: string;
  expires_at: string;
  attempts: number;
  verified: boolean;
}

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
    const { phone, code } = requestSchema.parse(req.body);

    // Normalize phone for OTP table lookups
    const normalizedPhone = normalizePhone(phone);

    const clientIp = getClientIP(req);

    // ACCOUNT LOCKOUT: Check for too many failed verification attempts (5 in 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: recentFailedAttempts, error: failedCheckError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('attempts')
      .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
      .gte('created_at', fifteenMinutesAgo.toISOString());

    if (failedCheckError) {
      Logger.error('Failed to check account lockout', failedCheckError);
    } else if (recentFailedAttempts) {
      const totalFailedAttempts = recentFailedAttempts.reduce((sum, record) => sum + (record.attempts || 0), 0);
      if (totalFailedAttempts >= MAX_FAILED_VERIFICATIONS_15MIN) {
        Logger.auth('Account locked due to failed OTP attempts', undefined, {
          ip_address: clientIp,
          failed_attempts: totalFailedAttempts,
        });

        return res.status(429).json({
          error: 'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes or contact support.',
          retryAfter: 900, // 15 minutes
        });
      }
    }

    // Find the most recent OTP for this phone (try both with and without +1)
    let otpRecords: OtpRecord[] | null = null;

    const otp1 = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otp1.data && otp1.data.length > 0) {
      otpRecords = otp1.data as unknown as OtpRecord[];
    } else {
      const otp2 = await supabaseAdmin
        .from('phone_otp_codes')
        .select('*')
        .eq('phone', `+1${normalizedPhone}`)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (otp2.data && otp2.data.length > 0) {
        otpRecords = otp2.data as unknown as OtpRecord[];
      }
    }

    if (!otpRecords || otpRecords.length === 0) {
      Logger.warn('No unverified OTP found for phone');
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

    // Increment attempts BEFORE checking code (prevents timing attacks).
    // Uses .eq('attempts', otpRecord.attempts) as an optimistic lock — if a concurrent
    // request already incremented, this update is a no-op and the next read sees the true count.
    await supabaseAdmin
      .from('phone_otp_codes')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id)
      .eq('attempts', otpRecord.attempts);

    // Verify code
    if (otpRecord.code !== code) {
      Logger.auth('OTP verification failed', undefined, {
        ip_address: clientIp,
        attempts: otpRecord.attempts + 1,
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

    // Get member by phone (handles all phone formats via normalization)
    const member = await findMemberByPhone<OtpVerifyMember>(
      normalizedPhone,
      'member_id, auth_user_id, email, first_name, last_name, phone, password_hash, password_is_temporary'
    );

    if (!member) {
      return res.status(404).json({
        error: 'Member not found',
      });
    }

    // If member doesn't have auth_user_id, create Supabase Auth user on first login
    if (!member.auth_user_id) {
      Logger.auth('First time login — creating Supabase Auth user', member.member_id);

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
          // If email already exists, search for existing auth user
          if (authError.message?.includes('email address has already been registered') || authError.code === 'email_exists') {
            Logger.auth('Email exists, searching for existing auth user', member.member_id);

            let existingUser: { id: string; email?: string } | null = null;

            try {
              // List users with pagination, searching for matching email
              let page = 1;
              let found = false;

              while (!found && page <= 10) { // Limit to 10 pages (1000 users)
                const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                  page,
                  perPage: 100,
                });

                if (listError || !data) {
                  Logger.error('Failed to list auth users', listError);
                  break;
                }

                const foundUser = data.users.find((u: { email?: string }) => u.email?.toLowerCase() === member.email?.toLowerCase());
                if (foundUser) {
                  existingUser = foundUser;
                }

                if (existingUser) {
                  found = true;
                  Logger.auth('Found existing auth user by email', existingUser.id);
                } else if (data.users.length < 100) {
                  // Last page reached
                  break;
                }

                page++;
              }

              if (existingUser) {
                authUserId = existingUser.id;
              } else {
                Logger.error('Email exists but could not find auth user');
                return res.status(500).json({
                  error: 'Account setup conflict. Please contact support.',
                });
              }
            } catch (e) {
              Logger.error('Error searching for auth user', e instanceof Error ? e : undefined);
              return res.status(500).json({
                error: 'Failed to set up account. Please contact support.',
              });
            }
          } else {
            Logger.error('Failed to create auth user', authError);
            return res.status(500).json({
              error: 'Failed to create account. Please try again.',
            });
          }
        } else {
          authUserId = authData.user.id;
          Logger.auth('Created new auth user', authUserId || undefined);
        }

        // Link auth user to member
        const { error: linkError } = await supabaseAdmin
          .from('members')
          .update({ auth_user_id: authUserId })
          .eq('member_id', member.member_id);

        if (linkError) {
          Logger.error('Failed to link auth user to member', linkError);
          return res.status(500).json({
            error: 'Failed to link account. Please try again.',
          });
        }

        member.auth_user_id = authUserId;
        Logger.auth('Successfully linked auth user to member', member.member_id);
      } catch (createError: unknown) {
        Logger.error('Error during auth user creation', createError instanceof Error ? createError : undefined);
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
      Logger.error('Failed to create session', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Set httpOnly cookie for session (secure in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = getSessionCookieDomain();
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    };

    const cookie = serialize('member_session', sessionToken, cookieOptions);

    res.setHeader('Set-Cookie', [cookie]);

    // Check if member needs to set a password
    const needsPassword = !member.password_hash || member.password_is_temporary;

    Logger.auth('OTP verification success', member.member_id, { needs_password: needsPassword });

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
      return res.status(400).json({
        error: error.issues[0].message,
        details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      });
    }

    Logger.error('Verify phone OTP error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}
