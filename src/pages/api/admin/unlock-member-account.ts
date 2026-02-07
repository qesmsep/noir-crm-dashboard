import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { logAuthEvent, getClientIP, getUserAgent } from '@/lib/security';

const requestSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { memberId } = requestSchema.parse(req.body);

    // Get member details
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('member_id, phone, first_name, last_name, account_locked_until, failed_login_count')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check if account is actually locked
    if (!member.account_locked_until) {
      return res.status(400).json({ error: 'Account is not locked' });
    }

    // Unlock the account
    const { error: unlockError } = await supabaseAdmin
      .from('members')
      .update({
        account_locked_until: null,
        failed_login_count: 0,
      })
      .eq('member_id', memberId);

    if (unlockError) {
      console.error('Failed to unlock account:', unlockError);
      return res.status(500).json({ error: 'Failed to unlock account' });
    }

    // Log the unlock event
    await logAuthEvent({
      memberId: member.member_id,
      phone: member.phone,
      eventType: 'account_locked', // Using existing enum, metadata will show it was unlocked
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req),
      metadata: {
        action: 'admin_unlock',
        admin_user_id: undefined, // TODO: Add admin auth context
        previous_locked_until: member.account_locked_until,
        failed_attempts_cleared: member.failed_login_count,
      },
    });

    res.status(200).json({
      success: true,
      message: `Account unlocked successfully for ${member.first_name} ${member.last_name}`,
      member: {
        id: member.member_id,
        phone: member.phone,
        firstName: member.first_name,
        lastName: member.last_name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }

    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
