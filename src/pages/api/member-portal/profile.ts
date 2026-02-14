import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      console.error('Error fetching member:', memberError);
      return res.status(500).json({ error: 'Failed to fetch member data' });
    }

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Calculate current balance
    const { data: balanceResult, error: balanceError } = await supabase
      .rpc('calculate_member_balance', { p_member_id: member.member_id });

    if (balanceError) {
      console.error('Error calculating balance:', balanceError);
    }

    const memberWithBalance = {
      ...member,
      balance: balanceResult || 0,
    };

    res.status(200).json({
      success: true,
      member: memberWithBalance,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}