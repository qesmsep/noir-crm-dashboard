import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/member/verify-phone
 *
 * Verifies if a phone number belongs to an active member and returns member info
 *
 * Body:
 *   - phone: string (10-digit phone number)
 *
 * Returns:
 *   - exists: boolean
 *   - member: { first_name, member_id, has_password } (if exists)
 *   - message: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Normalize phone number (remove all non-digits, keep last 10 digits)
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

    // Get all active members and filter in memory (since we need to normalize database phone numbers)
    const { data: members, error } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, phone, password_hash, deactivated')
      .eq('deactivated', false)
      .not('phone', 'is', null);

    if (error) {
      console.error('Error verifying phone:', error);
      throw error;
    }

    // Filter members by normalized phone number (last 10 digits match)
    const matchingMember = members?.find(m => {
      const dbPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
      return dbPhone === normalizedPhone;
    });

    // If no member found
    if (!matchingMember) {
      return res.json({
        exists: false,
        message: 'Phone number not recognized',
      });
    }

    const member = matchingMember;

    // Check if member has set a password (first-time login check)
    const hasPassword = !!member.password_hash;

    return res.json({
      exists: true,
      member: {
        first_name: member.first_name,
        member_id: member.member_id,
        has_password: hasPassword,
      },
      message: 'Member found',
    });
  } catch (error: any) {
    console.error('Error in verify-phone API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
