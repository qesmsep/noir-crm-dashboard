import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { serialize } from 'cookie';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  otpCode: z.string().length(6, 'OTP code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const SESSION_DURATION_DAYS = 7;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[SET-PASSWORD] Request body:', req.body);
    const { phone, otpCode, newPassword } = requestSchema.parse(req.body);

    // Normalize phone number (remove all non-digits, then take last 10 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.slice(-10);
    console.log('[SET-PASSWORD] Normalized phone:', normalizedPhone);

    // Verify OTP first (security requirement)
    const { data: otpRecords, error: fetchError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !otpRecords || otpRecords.length === 0) {
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

    // Get member by phone (try both with and without +1 prefix)
    let member: any = null;

    const result1 = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, email')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (result1.data && result1.data.length > 0) {
      member = result1.data[0];
    } else {
      const result2 = await supabaseAdmin
        .from('members')
        .select('member_id, first_name, last_name, email')
        .eq('phone', `+1${normalizedPhone}`)
        .limit(1);

      if (result2.data && result2.data.length > 0) {
        member = result2.data[0];
      }
    }

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
      console.error('Failed to update password:', updateError);
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
      console.error('Failed to create session:', sessionError);
      // Still return success for password set, but don't create session
      return res.status(200).json({
        success: true,
        message: 'Password set successfully. You can now login with your phone number and password.',
      });
    }

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
      console.error('[SET-PASSWORD] Validation error:', error.issues);
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('[SET-PASSWORD] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
