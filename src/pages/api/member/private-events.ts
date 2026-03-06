import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Get all upcoming private events (for showing when Noir is closed)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date().toISOString();

    // Fetch all upcoming private events with visibility and RSVP settings
    const { data: privateEvents, error } = await supabaseAdmin
      .from('private_events')
      .select('id, title, start_time, end_time, is_member_event, rsvp_enabled, rsvp_url')
      .gte('start_time', now)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching private events:', error);
      return res.status(500).json({ error: 'Failed to fetch private events' });
    }

    res.status(200).json({
      events: privateEvents || [],
    });
  } catch (error) {
    console.error('Private events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
