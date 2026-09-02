import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { getHoldSettings, secondsRemaining } from '../../../lib/holds';
import { CAPACITY_ERROR_MESSAGE, isCapacityError } from '../../../lib/capacity';

/**
 * POST /api/holds
 *
 * Holds a table for a guest who is mid-checkout.
 *
 * Choosing the table and holding it happen inside `create_reservation_hold`,
 * one transaction guarded by a per-location advisory lock. Doing it here in
 * separate queries would let two guests hitting the same slot at the same
 * instant both pass the availability check and both be handed the same table.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = supabaseAdmin || supabase;

  try {
    const { start_time, end_time, party_size, location_slug } = req.body || {};

    if (!start_time || !end_time || !party_size) {
      return res
        .status(400)
        .json({ error: 'start_time, end_time and party_size are required' });
    }

    const partySize = Number(party_size);
    if (!Number.isFinite(partySize) || partySize < 1) {
      return res.status(400).json({ error: 'party_size must be a positive number' });
    }

    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime) {
      return res.status(400).json({ error: 'Invalid start_time or end_time' });
    }

    let locationId: string | null = null;
    if (location_slug) {
      const { data: locationData } = await client
        .from('locations')
        .select('id')
        .eq('slug', location_slug)
        .single();
      locationId = locationData?.id || null;
    }
    if (!locationId) {
      return res.status(400).json({ error: 'A valid location is required to hold a table' });
    }

    const { data: hold, error } = await client
      .rpc('create_reservation_hold', {
        p_location_id: locationId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      })
      .single();

    if (error) {
      const message = error.message || '';

      if (message.includes('NO_TABLE_AVAILABLE')) {
        return res.status(409).json({
          error: 'That time was just taken. Please choose another time.',
          code: 'NO_TABLE_AVAILABLE',
        });
      }

      if (isCapacityError(error)) {
        return res.status(409).json({
          error: CAPACITY_ERROR_MESSAGE,
          code: 'CAPACITY_EXCEEDED',
        });
      }

      console.error('Error creating hold:', error);
      return res.status(500).json({ error: 'Could not hold that table. Please try again.' });
    }

    const holdRow = hold as any;
    const { holdMinutes } = await getHoldSettings(client, locationId);

    return res.status(201).json({
      hold_token: holdRow.hold_token,
      table_id: holdRow.table_id,
      seats: holdRow.seats,
      expires_at: holdRow.expires_at,
      seconds_remaining: secondsRemaining(holdRow.expires_at),
      hold_minutes: holdMinutes,
    });
  } catch (err) {
    console.error('Unhandled error creating hold:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
