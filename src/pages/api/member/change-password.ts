import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { parse } from 'cookie';
import { logAuthEvent, getClientIP, getUserAgent } from '@/lib/security';

const requestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * Change password for logged-in member
 */
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
    const { currentPassword, newPassword } = requestSchema.parse(req.body);

    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(member_id, phone, password_hash)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.members) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    if (!member || !member.password_hash) {
      return res.status(400).json({ error: 'No password set for this account' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, member.password_hash);

    if (!passwordMatch) {
      await logAuthEvent({
        memberId: member.member_id,
        phone: member.phone,
        eventType: 'login_failed',
        ipAddress,
        userAgent,
        metadata: { reason: 'incorrect_current_password', action: 'password_change' },
      });

      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear temporary flag
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        password_hash: newPasswordHash,
        password_set_at: new Date().toISOString(),
        password_is_temporary: false,
      })
      .eq('member_id', member.member_id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Log successful password change
    await logAuthEvent({
      memberId: member.member_id,
      phone: member.phone,
      eventType: 'password_reset',
      ipAddress,
      userAgent,
      metadata: { initiated_by: 'member', action: 'password_change' },
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
