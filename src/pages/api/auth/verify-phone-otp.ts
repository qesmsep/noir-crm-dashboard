import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const MAX_ATTEMPTS = 5;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, code } = requestSchema.parse(req.body);

    // Normalize phone number (remove all non-digits, then take last 10 digits)
    const digitsOnly = phone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.slice(-10);

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
      .select('member_id, auth_user_id, email, first_name, last_name, phone')
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
        .select('member_id, auth_user_id, email, first_name, last_name, phone')
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

    // If member doesn't have auth_user_id, they need to be linked to a Supabase user first
    if (!member.auth_user_id) {
      return res.status(400).json({
        error: 'Account not set up for portal access. Please contact support.',
        needsSetup: true,
        memberId: member.member_id,
      });
    }

    // Generate session token for member
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

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

    res.status(200).json({
      success: true,
      sessionToken,
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
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Verify phone OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
