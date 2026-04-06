import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    // Delete the waitlist entry
    const { error } = await supabase
      .from('waitlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting referral:', error);
      return res.status(500).json({ error: 'Failed to delete referral' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error in referral delete:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
