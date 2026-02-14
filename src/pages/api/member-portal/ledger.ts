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

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get ledger entries
    const { data: entries, error: ledgerError } = await supabase
      .from('member_ledger')
      .select('*')
      .eq('member_id', member.member_id)
      .order('transaction_date', { ascending: false });

    if (ledgerError) {
      console.error('Error fetching ledger:', ledgerError);
      return res.status(500).json({ error: 'Failed to fetch ledger data' });
    }

    res.status(200).json({
      success: true,
      entries: entries || [],
    });
  } catch (error) {
    console.error('Ledger API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}