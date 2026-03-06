import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/members/[memberId]/mark-incomplete
 *
 * Marks a pending member as incomplete (didn't complete signup)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { memberId } = req.query;

  if (!memberId || typeof memberId !== 'string') {
    return res.status(400).json({ error: 'member_id is required' });
  }

  try {
    // Update member status to 'incomplete'
    const { data, error } = await supabase
      .from('members')
      .update({ status: 'incomplete' })
      .eq('member_id', memberId)
      .eq('status', 'pending') // Only allow changing from pending to incomplete
      .select()
      .single();

    if (error) {
      console.error('Error marking member as incomplete:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Member not found or not in pending status' });
    }

    return res.json({
      success: true,
      message: 'Member marked as incomplete successfully',
      data
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
