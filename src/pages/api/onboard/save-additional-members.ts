import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, additional_members } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  if (!Array.isArray(additional_members)) {
    return res.status(400).json({ error: 'Additional members must be an array' });
  }

  try {
    // Find waitlist entry with this token
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('agreement_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if already completed
    if (waitlist.member_id) {
      return res.status(400).json({ error: 'Onboarding already completed' });
    }

    // Update waitlist with additional members
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({ additional_members })
      .eq('agreement_token', token);

    if (updateError) {
      console.error('Error saving additional members:', updateError);
      return res.status(500).json({ error: 'Failed to save additional members' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Save additional members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
