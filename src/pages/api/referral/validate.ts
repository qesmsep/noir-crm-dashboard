import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    // Look up the member by referral code
    const { data: member, error } = await supabaseAdmin
      .from('members')
      .select('member_id, first_name, last_name, referral_code')
      .eq('referral_code', code.toUpperCase())
      .eq('deactivated', false)
      .single();

    if (error || !member) {
      console.error('Error validating referral code:', error);
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    return res.status(200).json({
      valid: true,
      referrer_id: member.member_id,
      referrer_name: `${member.first_name} ${member.last_name}`,
      referral_code: member.referral_code
    });

  } catch (error: any) {
    console.error('Referral validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
