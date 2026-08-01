import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

/**
 * Reservations API (Pages Router) - single resource
 * DELETE: Deletes a reservation by ID.
 * Uses service role when available to bypass RLS in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Reservation ID is required' });
  }

  if (req.method === 'DELETE') {
    try {
      const client = supabaseAdmin || supabase;

      console.log('DELETE /api/reservations/[id] - Deleting reservation:', id);

      const { data, error } = await client
        .from('reservations')
        .delete()
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error deleting reservation:', error);
        return res.status(500).json({ error: 'Failed to delete reservation' });
      }

      if (!data) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      console.log('Reservation deleted successfully:', id);
      return res.status(200).json({ data });
    } catch (err) {
      console.error('Unhandled error deleting reservation:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
