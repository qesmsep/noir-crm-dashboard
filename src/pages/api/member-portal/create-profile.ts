import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, phone, email, first_name, last_name } = req.body;

  if (!user_id || (!phone && !email)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('members')
      .select('member_id')
      .eq('user_id', user_id)
      .single();

    if (existingMember) {
      return res.status(200).json({
        success: true,
        member: existingMember,
        message: 'Member already exists',
      });
    }

    // Create member profile
    const memberData = {
      user_id,
      first_name: first_name || '',
      last_name: last_name || '',
      email: email || '',
      phone: phone || '',
      membership_type: 'standard',
      membership_status: 'active',
      preferences: {},
    };

    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert([memberData])
      .select()
      .single();

    if (memberError) {
      console.error('Error creating member:', memberError);
      return res.status(500).json({ error: 'Failed to create member profile' });
    }

    // Add initial welcome credit
    const { error: ledgerError } = await supabase
      .rpc('add_ledger_entry', {
        p_member_id: member.member_id,
        p_transaction_type: 'credit',
        p_amount: 25.00,
        p_description: 'Welcome credit - New member bonus',
        p_metadata: { type: 'welcome_bonus' },
      });

    if (ledgerError) {
      console.error('Error adding welcome credit:', ledgerError);
    }

    res.status(201).json({
      success: true,
      member,
    });
  } catch (error) {
    console.error('Create profile API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}