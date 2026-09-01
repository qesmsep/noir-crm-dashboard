import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checkout holds.
 *
 * When a guest picks a table and time, that table is held for a few minutes so
 * nobody else can take it while they finish booking. A held table is out of
 * service exactly like a booked one — its seats count toward the location's
 * concurrent seat cap (see `check_reservation_capacity`).
 *
 * Holds expire by wall clock: every read filters on `expires_at > now()`, so an
 * expired hold stops blocking the instant it lapses. Nothing has to sweep them
 * for correctness.
 */

export const DEFAULT_HOLD_MINUTES = 5;
export const DEFAULT_PAYMENT_EXTENSION_MINUTES = 5;

export interface HoldSettings {
  holdMinutes: number;
  paymentExtensionMinutes: number;
}

export interface ActiveHold {
  id: string;
  table_id: string;
  start_time: string;
  end_time: string;
  seats: number;
}

export interface HoldRecord extends ActiveHold {
  hold_token: string;
  location_id: string;
  party_size: number;
  stage: 'details' | 'payment';
  expires_at: string;
}

export const HOLD_EXPIRED_MESSAGE =
  'Your hold on this table expired. Please pick a time again.';

/** Per-location hold timings, falling back to the defaults. */
export async function getHoldSettings(
  client: SupabaseClient,
  locationId: string
): Promise<HoldSettings> {
  const { data, error } = await client
    .from('locations')
    .select('hold_duration_minutes, hold_payment_extension_minutes')
    .eq('id', locationId)
    .single();

  if (error) {
    console.error('Error fetching hold settings:', error);
    return {
      holdMinutes: DEFAULT_HOLD_MINUTES,
      paymentExtensionMinutes: DEFAULT_PAYMENT_EXTENSION_MINUTES,
    };
  }

  return {
    holdMinutes: data?.hold_duration_minutes ?? DEFAULT_HOLD_MINUTES,
    paymentExtensionMinutes:
      data?.hold_payment_extension_minutes ?? DEFAULT_PAYMENT_EXTENSION_MINUTES,
  };
}

/**
 * Live holds at a location overlapping [windowStart, windowEnd).
 * `exceptHoldId` skips the caller's own hold so it does not block itself.
 */
export async function fetchActiveHolds(
  client: SupabaseClient,
  locationId: string,
  windowStart: Date,
  windowEnd: Date,
  exceptHoldId?: string | null
): Promise<ActiveHold[]> {
  let query = client
    .from('reservation_holds')
    .select('id, table_id, start_time, end_time, seats')
    .eq('location_id', locationId)
    .gt('expires_at', new Date().toISOString())
    .lt('start_time', windowEnd.toISOString())
    .gt('end_time', windowStart.toISOString());

  if (exceptHoldId) {
    query = query.neq('id', exceptHoldId);
  }

  const { data, error } = await query;

  if (error) {
    // Table may not exist yet if the holds migration has not run
    console.error('Error fetching active holds:', error);
    return [];
  }
  return data || [];
}

/**
 * Live holds shaped for the shared occupancy math in `lib/capacity`, so held
 * tables and booked tables are counted the same way.
 */
export async function fetchHoldOccupancy(
  client: SupabaseClient,
  locationId: string,
  windowStart: Date,
  windowEnd: Date,
  exceptHoldId?: string | null
): Promise<Array<{ start_time: string; end_time: string; occupancy: number }>> {
  const holds = await fetchActiveHolds(
    client,
    locationId,
    windowStart,
    windowEnd,
    exceptHoldId
  );
  return holds.map((h) => ({
    start_time: h.start_time,
    end_time: h.end_time,
    occupancy: Number(h.seats) || 0,
  }));
}

/** Table ids currently held for any part of [windowStart, windowEnd). */
export async function fetchHeldTableIds(
  client: SupabaseClient,
  locationId: string,
  windowStart: Date,
  windowEnd: Date,
  exceptHoldId?: string | null
): Promise<Set<string>> {
  const holds = await fetchActiveHolds(
    client,
    locationId,
    windowStart,
    windowEnd,
    exceptHoldId
  );
  return new Set(holds.map((h) => String(h.table_id)));
}

/** Seconds left on a hold, floored at 0. */
export function secondsRemaining(expiresAt: string, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

/** "4min 49sec" / "48sec" — the countdown wording shown to guests. */
export function formatHoldCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes <= 0) return `${seconds}sec`;
  return `${minutes}min ${seconds.toString().padStart(2, '0')}sec`;
}
