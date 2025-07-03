import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, change_type, current_data, proposed_data, reason } = req.body;

  if (!member_id || !change_type || !proposed_data) {
    return res.status(400).json({ error: 'Missing required fields' });
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

    // Verify member ownership
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .eq('member_id', member_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Submit profile change for approval
    const { data: change, error: changeError } = await supabase
      .from('member_profile_changes')
      .insert([{
        member_id,
        change_type,
        current_data,
        proposed_data,
        reason: reason || null,
        status: 'pending',
      }])
      .select()
      .single();

    if (changeError) {
      console.error('Error submitting change:', changeError);
      return res.status(500).json({ error: 'Failed to submit change request' });
    }

    // TODO: Send notification to admin about pending change
    // This could be an email, SMS, or in-app notification

    res.status(201).json({
      success: true,
      change,
    });
  } catch (error) {
    console.error('Submit changes API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}