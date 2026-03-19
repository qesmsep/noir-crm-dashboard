import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { serialize } from 'cookie';
import { findMemberByPhone, getSessionCookieDomain, normalizePhone } from '@/lib/security';
import { Logger } from '@/lib/logger';

interface SetPasswordMember {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
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
  otpCode: z.string().length(6, 'OTP code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const SESSION_DURATION_DAYS = 7;
const MAX_OTP_ATTEMPTS = 5;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, otpCode, newPassword } = requestSchema.parse(req.body);

    // findMemberByPhone normalizes internally, but we need normalizedPhone for OTP lookup
    const normalizedPhone = normalizePhone(phone);

    // Verify OTP first (try both normalizedPhone and +1 prefix — mirrors verify-phone-otp.ts)
    let otpRecord: OtpRecord | null = null;

    const otp1 = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otp1.data && otp1.data.length > 0) {
      otpRecord = otp1.data[0] as unknown as OtpRecord;
    } else {
      const otp2 = await supabaseAdmin
        .from('phone_otp_codes')
        .select('*')
        .eq('phone', `+1${normalizedPhone}`)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (otp2.data && otp2.data.length > 0) {
        otpRecord = otp2.data[0] as unknown as OtpRecord;
      }
    }

    if (!otpRecord) {
      return res.status(400).json({
        error: 'No verification code found. Please request a new code.',
      });
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
      });
    }

    // Check max attempts (prevents brute-force on 6-digit OTP)
    const attempts = otpRecord.attempts || 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new code.',
      });
    }

    // Increment attempts BEFORE checking code (prevents timing attacks)
    await supabaseAdmin
      .from('phone_otp_codes')
      .update({ attempts: attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify code
    if (otpRecord.code !== otpCode) {
      return res.status(400).json({
        error: 'Invalid verification code.',
      });
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('phone_otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    // Get member by phone (handles all phone formats via normalization)
    const member = await findMemberByPhone<SetPasswordMember>(
      normalizedPhone,
      'member_id, first_name, last_name, email'
    );

    if (!member) {
      return res.status(404).json({
        error: 'No member found with this phone number.',
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update member's password (not temporary since user set it themselves)
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
        password_is_temporary: false,
      })
      .eq('member_id', member.member_id);

    if (updateError) {
      Logger.error('Failed to update password', updateError);
      return res.status(500).json({ error: 'Failed to set password' });
    }

    // Create session automatically after setting password
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const { error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .insert({
        member_id: member.member_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      Logger.error('Failed to create session', sessionError);
      // Still return success for password set, but don't create session
      return res.status(200).json({
        success: true,
        message: 'Password set successfully. You can now login with your phone number and password.',
      });
    }

    // Set httpOnly cookie for session (secure in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = getSessionCookieDomain();
    res.setHeader('Set-Cookie', [
      serialize('member_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
        path: '/',
        ...(cookieDomain && { domain: cookieDomain }),
      }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Password set successfully. You are now logged in.',
      member: {
        id: member.member_id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    Logger.error('Set password error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}
