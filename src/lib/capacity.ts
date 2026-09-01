import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-location concurrent guest capacity.
 *
 * A location may define `locations.max_concurrent_guests` — the maximum total
 * booked guests allowed on-site at any single moment, regardless of table
 * availability. The hard guarantee lives in the `check_reservation_capacity`
 * database trigger; the helpers here exist so API routes can (a) hide time
 * slots that would exceed the cap and (b) return a friendly error before the
 * insert ever reaches the trigger.
 *
 * Excluded from occupancy, mirroring the trigger:
 * - cancelled reservations
 * - private event RSVPs (private_event_id set) — events carry their own cap
 */

export interface OccupancyReservation {
  start_time: string;
  end_time: string;
  party_size: number | null;
}

/** Matches the message raised by the check_reservation_capacity trigger. */
export const CAPACITY_ERROR_MARKER = 'CAPACITY_EXCEEDED';

export function isCapacityError(error: any): boolean {
  const message = error?.message || error?.details || '';
  return typeof message === 'string' && message.includes(CAPACITY_ERROR_MARKER);
}

export const CAPACITY_ERROR_MESSAGE =
  'We are at capacity for that time. Please choose a different time or reduce your party size.';

/**
 * Peak number of concurrent guests within [windowStart, windowEnd), given the
 * reservations that overlap that window. Occupancy only changes when a
 * reservation starts, so evaluating the window start plus each overlapping
 * reservation's start time is sufficient to find the peak.
 */
export function calcPeakConcurrentGuests(
  reservations: OccupancyReservation[],
  windowStart: Date,
  windowEnd: Date
): number {
  const overlapping = reservations.filter((r) => {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start < windowEnd && end > windowStart;
  });

  if (overlapping.length === 0) return 0;

  const points = [windowStart.getTime()];
  for (const r of overlapping) {
    const start = new Date(r.start_time).getTime();
    if (start >= windowStart.getTime() && start < windowEnd.getTime()) {
      points.push(start);
    }
  }

  let peak = 0;
  for (const t of points) {
    let occupancy = 0;
    for (const r of overlapping) {
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      if (start <= t && end > t) {
        occupancy += r.party_size || 0;
      }
    }
    if (occupancy > peak) peak = occupancy;
  }
  return peak;
}

/** The location's guest cap, or null when the location has no limit. */
export async function getLocationCapacity(
  client: SupabaseClient,
  locationId: string
): Promise<number | null> {
  const { data, error } = await client
    .from('locations')
    .select('max_concurrent_guests')
    .eq('id', locationId)
    .single();

  if (error) {
    // Column may not exist yet if the migration hasn't run; treat as no cap
    console.error('Error fetching location capacity:', error);
    return null;
  }
  return data?.max_concurrent_guests ?? null;
}

/**
 * Active reservations at a location that overlap [windowStart, windowEnd),
 * for occupancy math. Matches rows by location_id, falling back to the
 * assigned table's location for rows created without one.
 */
export async function fetchOccupancyReservations(
  client: SupabaseClient,
  locationId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<OccupancyReservation[]> {
  const { data: locationTables, error: tablesError } = await client
    .from('tables')
    .select('id')
    .eq('location_id', locationId);

  if (tablesError) {
    console.error('Error fetching location tables for occupancy:', tablesError);
  }

  const tableIds = (locationTables || []).map((t: any) => t.id);
  const locationFilter =
    tableIds.length > 0
      ? `location_id.eq.${locationId},table_id.in.(${tableIds.join(',')})`
      : `location_id.eq.${locationId}`;

  const { data, error } = await client
    .from('reservations')
    .select('start_time, end_time, party_size, status, private_event_id')
    .or(locationFilter)
    .lt('start_time', windowEnd.toISOString())
    .gt('end_time', windowStart.toISOString());

  if (error) {
    console.error('Error fetching reservations for occupancy:', error);
    return [];
  }

  return (data || []).filter(
    (r: any) =>
      (!r.status || r.status !== 'cancelled') && !r.private_event_id
  );
}

export interface CapacityCheckResult {
  allowed: boolean;
  cap: number | null;
  projectedPeak: number;
}

/**
 * Would a reservation of `partySize` guests over [startTime, endTime) push the
 * location past its cap? Best-effort UX check — the database trigger is the
 * authoritative enforcement.
 */
export async function checkReservationCapacity(
  client: SupabaseClient,
  params: {
    locationId: string;
    startTime: Date;
    endTime: Date;
    partySize: number;
  }
): Promise<CapacityCheckResult> {
  const { locationId, startTime, endTime, partySize } = params;

  const cap = await getLocationCapacity(client, locationId);
  if (cap === null) {
    return { allowed: true, cap: null, projectedPeak: partySize };
  }

  const reservations = await fetchOccupancyReservations(
    client,
    locationId,
    startTime,
    endTime
  );
  const peak = calcPeakConcurrentGuests(reservations, startTime, endTime);
  const projectedPeak = peak + partySize;

  return { allowed: projectedPeak <= cap, cap, projectedPeak };
}
