import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const requestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  otpCode: z.string().length(6, 'OTP code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, otpCode, newPassword } = requestSchema.parse(req.body);

    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

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

    // Get member by phone
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, email')
      .eq('phone', normalizedPhone)
      .single();

    if (memberError || !member) {
      return res.status(404).json({
        error: 'No member found with this phone number.',
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update member's password
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
      })
      .eq('member_id', member.member_id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return res.status(500).json({ error: 'Failed to set password' });
    }

    res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now login with your phone number and password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Set password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
