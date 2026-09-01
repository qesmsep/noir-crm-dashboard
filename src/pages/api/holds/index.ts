import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import {
  getHoldSettings,
  fetchHeldTableIds,
  fetchHoldOccupancy,
  secondsRemaining,
} from '../../../lib/holds';
import {
  calcPeakConcurrentGuests,
  fetchOccupancyReservations,
  getLocationCapacity,
  CAPACITY_ERROR_MESSAGE,
} from '../../../lib/capacity';

/**
 * POST /api/holds
 *
 * Holds a table for a guest who is mid-checkout. Picks the smallest free table
 * that fits the party — the same rule the booking API uses — skipping tables
 * that are already booked or held, and refusing if the location is at its seat
 * cap. Returns the hold token and how long the guest has.
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

    // Resolve the location
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

    // Candidate tables: smallest first, matching how the booking API assigns
    const { data: tables, error: tablesError } = await client
      .from('tables')
      .select('id, table_number, seats')
      .eq('location_id', locationId)
      .gte('seats', partySize)
      .order('seats', { ascending: true });

    if (tablesError) {
      console.error('Error fetching tables for hold:', tablesError);
      return res.status(500).json({ error: 'Could not check table availability' });
    }

    const excludedTableNumbers = [4, 8, 12];
    const candidates = (tables || []).filter(
      (t: any) => !excludedTableNumbers.includes(parseInt(t.table_number, 10))
    );

    if (candidates.length === 0) {
      return res
        .status(400)
        .json({ error: `No tables can accommodate ${partySize} guests.` });
    }

    // Tables already booked for this window
    const { data: overlapping, error: resError } = await client
      .from('reservations')
      .select('table_id, status')
      .in('table_id', candidates.map((t: any) => t.id))
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString());

    if (resError) {
      console.error('Error checking reservations for hold:', resError);
      return res.status(500).json({ error: 'Could not check table availability' });
    }

    const bookedTableIds = new Set(
      (overlapping || [])
        .filter((r: any) => !r.status || r.status !== 'cancelled')
        .map((r: any) => String(r.table_id))
    );

    // Tables someone else is already holding
    const heldTableIds = await fetchHeldTableIds(client, locationId, startTime, endTime);

    const table = candidates.find(
      (t: any) => !bookedTableIds.has(String(t.id)) && !heldTableIds.has(String(t.id))
    );

    if (!table) {
      return res.status(409).json({
        error: 'That time was just taken. Please choose another time.',
        code: 'NO_TABLE_AVAILABLE',
      });
    }

    const seats = Number(table.seats) || partySize;

    // Holding this table takes its seats out of service — refuse if that would
    // breach the location's cap, counting both bookings and other live holds.
    const cap = await getLocationCapacity(client, locationId);
    if (cap !== null) {
      const [reservations, holds] = await Promise.all([
        fetchOccupancyReservations(client, locationId, startTime, endTime),
        fetchHoldOccupancy(client, locationId, startTime, endTime),
      ]);
      const peak = calcPeakConcurrentGuests(
        [...reservations, ...holds],
        startTime,
        endTime
      );
      if (peak + seats > cap) {
        return res.status(409).json({
          error: CAPACITY_ERROR_MESSAGE,
          code: 'CAPACITY_EXCEEDED',
        });
      }
    }

    const { holdMinutes } = await getHoldSettings(client, locationId);
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

    const { data: hold, error: holdError } = await client
      .from('reservation_holds')
      .insert([
        {
          location_id: locationId,
          table_id: table.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          party_size: partySize,
          seats,
          stage: 'details',
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select('id, hold_token, table_id, seats, expires_at, stage')
      .single();

    if (holdError || !hold) {
      console.error('Error creating hold:', holdError);
      return res.status(500).json({ error: 'Could not hold that table. Please try again.' });
    }

    return res.status(201).json({
      hold_token: hold.hold_token,
      table_id: hold.table_id,
      seats: hold.seats,
      expires_at: hold.expires_at,
      seconds_remaining: secondsRemaining(hold.expires_at),
      hold_minutes: holdMinutes,
    });
  } catch (err) {
    console.error('Unhandled error creating hold:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
