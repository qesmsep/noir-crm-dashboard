import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

/**
 * Reservations API (Pages Router)
 * Returns all reservations sorted by start_time (ascending).
 * Uses service role when available to bypass RLS in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching reservations:', error);
      return res.status(500).json({ error: 'Failed to fetch reservations' });
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.error('Unhandled error fetching reservations:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

