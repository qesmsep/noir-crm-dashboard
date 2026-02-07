import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sendPersonalizedSMS } from '@/utils/openphoneUtils';

const requestSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  generateTemporaryPassword: z.boolean().optional(),
});

/**
 * Generate a random temporary password
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
  const length = 8;
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { memberId, generateTemporaryPassword = true } = requestSchema.parse(req.body);

    // Get member details
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, phone, first_name, last_name, email, password_hash')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (!member.phone) {
      return res.status(400).json({ error: 'Member has no phone number' });
    }

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${portalUrl}/member/login`;

    let messageText = '';

    // If member doesn't have a password OR we want to generate a new temporary one
    if (!member.password_hash || generateTemporaryPassword) {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Update member with temporary password
      const { error: updateError } = await supabaseAdmin
        .from('members')
        .update({
          password_hash: passwordHash,
          password_set_at: new Date().toISOString(),
          password_is_temporary: true,
        })
        .eq('member_id', memberId);

      if (updateError) {
        console.error('Failed to set temporary password:', updateError);
        return res.status(500).json({ error: 'Failed to generate login credentials' });
      }

      // Display phone number (remove +1 if present for simpler login instructions)
      const displayPhone = member.phone.replace(/^\+1/, '');

      // Compose SMS with temporary password
      messageText = `Hi ${member.first_name}! Welcome to the Noir Member Portal.\n\nYour login credentials:\n📱 Phone: ${displayPhone}\n🔑 Password: ${tempPassword}\n\n🔗 Login here: ${loginUrl}\n\n⚠️ Please change your password after logging in for security.\n\n- Noir Team`;
    } else {
      // Display phone number (remove +1 if present)
      const displayPhone = member.phone.replace(/^\+1/, '');

      // Member already has a password, just send reset link
      messageText = `Hi ${member.first_name}! Here's your Noir Member Portal access:\n\n📱 Phone: ${displayPhone}\n🔗 Login: ${loginUrl}\n\nForgot your password? Use "Forgot Password" on the login page.\n\n- Noir Team`;
    }

    // Send SMS via OpenPhone
    try {
      await sendPersonalizedSMS(
        member.phone,
        messageText,
        member.first_name
      );
    } catch (smsError) {
      console.error('Failed to send SMS:', smsError);
      return res.status(500).json({
        error: 'Failed to send SMS. Login credentials were prepared but not delivered.',
      });
    }

    res.status(200).json({
      success: true,
      message: `Login information sent to ${member.first_name} ${member.last_name}`,
      sentTo: member.phone,
      generatedNewPassword: !member.password_hash || generateTemporaryPassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Send login info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
