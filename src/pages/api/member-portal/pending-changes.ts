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

    // Get pending changes
    const { data: changes, error: changesError } = await supabase
      .from('member_profile_changes')
      .select('*')
      .eq('member_id', member.member_id)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (changesError) {
      console.error('Error fetching pending changes:', changesError);
      return res.status(500).json({ error: 'Failed to fetch pending changes' });
    }

    res.status(200).json({
      success: true,
      changes: changes || [],
    });
  } catch (error) {
    console.error('Pending changes API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}