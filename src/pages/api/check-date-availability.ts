import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Helper: Get operating hours for a specific date and location
 */
async function getOperatingHoursForDate(
  requestDate: DateTime,
  locationId: string | null
): Promise<Array<{ start: string; end: string }>> {
  let venueHoursQuery = supabase
    .from('venue_hours')
    .select('*')
    .eq('type', 'base')
    .eq('day_of_week', requestDate.weekday % 7);

  if (locationId) {
    venueHoursQuery = venueHoursQuery.eq('location_id', locationId);
  }

  const { data: venueHours } = await venueHoursQuery;

  const defaultHours = [
    { start: '18:00', end: '23:00' }
  ];

  return venueHours && venueHours.length > 0 && venueHours[0].time_ranges
    ? venueHours[0].time_ranges
    : defaultHours;
}

/**
 * Helper: Generate 30-minute time slots for operating hours and add to blockedTimeRanges
 */
function blockAllSlotsInHours(
  operatingHours: Array<{ start: string; end: string }>,
  requestDate: DateTime,
  timezone: string,
  reason: string,
  blockedTimeRanges: any[]
): void {
  operatingHours.forEach((hours: any) => {
    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);

    // Generate 30-minute time slots
    for (let hour = startHour; hour < endHour || (hour === endHour && 0 < endMin); hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endHour && minute >= endMin) break;
        if (hour > endHour) break;

        const slotStart = DateTime.fromObject({
          year: requestDate.year,
          month: requestDate.month,
          day: requestDate.day,
          hour,
          minute
        }, { zone: timezone });

        const slotEnd = slotStart.plus({ minutes: 30 });

        blockedTimeRanges.push({
          id: `no-tables-${hour}-${minute}`,
          title: 'No tables available',
          startTime: slotStart.toFormat('h:mm a'),
          endTime: slotEnd.toFormat('h:mm a'),
          startHour: hour,
          startMinute: minute,
          endHour: slotEnd.hour,
          endMinute: slotEnd.minute,
          reason
        });
      }
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, location, adminOverride, partySize } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get location_id and timezone if location slug is provided
    let locationId: string | null = null;
    let timezone = 'America/Chicago'; // Default timezone

    if (location && typeof location === 'string') {
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id, timezone')
        .eq('slug', location)
        .single();

      if (!locationError && locationData) {
        locationId = locationData.id;
        timezone = locationData.timezone || 'America/Chicago';
      }
    }

    // Parse the date in the location's timezone (format: YYYY-MM-DD)
    // This ensures we check the correct day in the location's local time
    const requestDate = DateTime.fromISO(date, { zone: timezone });

    // Validate that the DateTime object is valid (timezone could be invalid)
    if (!requestDate.isValid) {
      return res.status(400).json({
        error: 'Invalid date or timezone',
        details: requestDate.invalidReason
      });
    }

    // Check for exceptional closures first
    let closuresQuery = supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', date);

    // Filter by location if provided
    if (locationId) {
      closuresQuery = closuresQuery.eq('location_id', locationId);
    }

    const { data: closures, error: closureError } = await closuresQuery;

    if (closureError) {
      console.error('Error fetching exceptional closures:', closureError);
    }

    const blockedTimeRanges: any[] = [];

    // Skip exceptional closures if adminOverride is true
    const skipExceptionalClosures = adminOverride === 'true';

    // Add exceptional closure time ranges (unless admin override is enabled)
    if (!skipExceptionalClosures && closures && closures.length > 0) {
      closures.forEach((closure) => {
        if (closure.full_day) {
          // Block entire day (00:00 to 23:59)
          blockedTimeRanges.push({
            id: `closure-${closure.id}`,
            title: closure.reason || 'Closed',
            startTime: '12:00 am',
            endTime: '11:59 pm',
            startHour: 0,
            startMinute: 0,
            endHour: 23,
            endMinute: 59,
          });
        } else if (closure.time_ranges && closure.time_ranges.length > 0) {
          // Add each time range
          closure.time_ranges.forEach((range: any, idx: number) => {
            const [startHour, startMinute] = range.start.split(':').map(Number);
            const [endHour, endMinute] = range.end.split(':').map(Number);

            const start = DateTime.fromObject({ hour: startHour, minute: startMinute }, { zone: timezone });
            const end = DateTime.fromObject({ hour: endHour, minute: endMinute }, { zone: timezone });

            blockedTimeRanges.push({
              id: `closure-${closure.id}-${idx}`,
              title: closure.reason || 'Closed',
              startTime: start.toFormat('h:mm a'),
              endTime: end.toFormat('h:mm a'),
              startHour,
              startMinute,
              endHour,
              endMinute,
            });
          });
        }
      });
    }

    // Fetch private events for this date
    // Skip private events if adminOverride is true
    const skipPrivateEvents = adminOverride === 'true';

    if (!skipPrivateEvents) {
      // Filter by location if provided
      let eventsQuery = supabase
        .from('private_events')
        .select('id, title, start_time, end_time')
        .gte('end_time', requestDate.startOf('day').toISO())
        .lte('start_time', requestDate.endOf('day').toISO())
        .order('start_time', { ascending: true });

      if (locationId) {
        eventsQuery = eventsQuery.eq('location_id', locationId);
      }

      const { data: events, error } = await eventsQuery;

      if (error) {
        console.error('Error fetching private events:', error);
        return res.status(500).json({ error: 'Failed to fetch events' });
      }

      // Add private event time ranges
      (events || []).forEach((event) => {
        const start = DateTime.fromISO(event.start_time).setZone(timezone);
        const end = DateTime.fromISO(event.end_time).setZone(timezone);

        blockedTimeRanges.push({
          id: event.id,
          title: event.title,
          startTime: start.toFormat('h:mm a'),
          endTime: end.toFormat('h:mm a'),
          startHour: start.hour,
          startMinute: start.minute,
          endHour: end.hour,
          endMinute: end.minute,
        });
      });
    }

    // Check table availability if partySize is provided
    if (partySize && typeof partySize === 'string') {
      const partySizeNum = parseInt(partySize);

      if (!isNaN(partySizeNum) && partySizeNum > 0) {
        // Determine the actual reservation duration for this location so we check for a
        // contiguous free window, not just the isolated 30-minute display slot. Otherwise a
        // slot can show as "available" while no table is actually free for the full stay.
        let reservationDurationHours = 2.0;
        if (locationId) {
          const { data: locationDurationData } = await supabase
            .from('locations')
            .select('default_reservation_duration_hours')
            .eq('id', locationId)
            .single();

          if (locationDurationData?.default_reservation_duration_hours) {
            reservationDurationHours = locationDurationData.default_reservation_duration_hours;
          }
        }

        // Get tables that can accommodate the party size
        let tablesQuery = supabase
          .from('tables')
          .select('id, table_number, seats')
          .gte('seats', partySizeNum)
          .eq('status', 'active')
          .order('seats', { ascending: true });

        // Filter by location if provided
        if (locationId) {
          tablesQuery = tablesQuery.eq('location_id', locationId);
        }

        const { data: tables, error: tablesError } = await tablesQuery;

        if (tablesError) {
          console.error('Error fetching tables:', tablesError);
        } else if (!tables || tables.length === 0) {
          // No tables at all can fit this party size (query returned 0 rows)
          // Block all operating hours since party size exceeds all table capacities
          const operatingHours = await getOperatingHoursForDate(requestDate, locationId);
          blockAllSlotsInHours(operatingHours, requestDate, timezone, 'party_size_too_large', blockedTimeRanges);
        } else {
          // Filter out tables 4, 8, and 12 (not available for reservations)
          const excludedTableNumbers = [4, 8, 12];
          const availableTables = tables.filter((t: any) =>
            !excludedTableNumbers.includes(parseInt(t.table_number, 10))
          );

          if (availableTables.length > 0) {
            // Get all reservations that overlap with this date
            // Parse in location timezone, then convert to UTC for database query
            const startOfDay = requestDate.startOf('day').toUTC().toISO();
            const endOfDay = requestDate.endOf('day').toUTC().toISO();

            const tableIds = availableTables.map(t => t.id);

            // Get existing reservations for these tables that overlap with this date
            // A reservation overlaps if: start_time < end_of_day AND end_time > start_of_day
            const { data: reservations, error: resError } = await supabase
              .from('reservations')
              .select('id, table_id, start_time, end_time, status')
              .in('table_id', tableIds)
              .lt('start_time', endOfDay)
              .gt('end_time', startOfDay);

            if (resError) {
              console.error('Error fetching reservations:', resError);
            } else {
              // Filter out cancelled reservations
              const activeReservations = (reservations || []).filter(
                (r: any) => !r.status || r.status !== 'cancelled'
              );

              // Get venue hours for this date and location
              const operatingHours = await getOperatingHoursForDate(requestDate, locationId);

              // Check availability for each 30-minute slot within operating hours
              operatingHours.forEach((hours: any) => {
                const [startHour, startMin] = hours.start.split(':').map(Number);
                const [endHour, endMin] = hours.end.split(':').map(Number);

                // Generate 30-minute time slots
                for (let hour = startHour; hour < endHour || (hour === endHour && 0 < endMin); hour++) {
                  for (let minute = 0; minute < 60; minute += 30) {
                    // Skip if past end time
                    if (hour === endHour && minute >= endMin) break;
                    if (hour > endHour) break;

                    const slotStart = DateTime.fromObject({
                      year: requestDate.year,
                      month: requestDate.month,
                      day: requestDate.day,
                      hour,
                      minute
                    }, { zone: timezone });

                    const slotEnd = slotStart.plus({ minutes: 30 });
                    // The full window a reservation starting in this slot would actually occupy
                    const conflictWindowEnd = slotStart.plus({ hours: reservationDurationHours });

                    // Check if ANY table is available for this time slot
                    let tableAvailable = false;

                    for (const table of availableTables) {
                      // Check if this table has any conflicting reservations over the full
                      // reservation duration (not just the 30-minute display slot)
                      const hasConflict = activeReservations.some((res: any) => {
                        if (res.table_id !== table.id) return false;

                        const resStart = DateTime.fromISO(res.start_time);
                        const resEnd = DateTime.fromISO(res.end_time);

                        // Check for overlap
                        return (slotStart < resEnd) && (conflictWindowEnd > resStart);
                      });

                      if (!hasConflict) {
                        tableAvailable = true;
                        break; // At least one table is available
                      }
                    }

                    // If no tables available for this slot, add it to blocked times
                    if (!tableAvailable) {
                      blockedTimeRanges.push({
                        id: `no-tables-${hour}-${minute}`,
                        title: 'No tables available',
                        startTime: slotStart.toFormat('h:mm a'),
                        endTime: slotEnd.toFormat('h:mm a'),
                        startHour: hour,
                        startMinute: minute,
                        endHour: slotEnd.hour,
                        endMinute: slotEnd.minute,
                        reason: 'all_tables_booked'
                      });
                    }
                  }
                }
              });
            }
          } else {
            // No tables at all that can fit this party size - block all operating hours
            const operatingHours = await getOperatingHoursForDate(requestDate, locationId);
            blockAllSlotsInHours(operatingHours, requestDate, timezone, 'party_size_too_large', blockedTimeRanges);
          }
        }
      }
    }

    return res.status(200).json({
      date,
      blockedTimeRanges,
    });

  } catch (error: any) {
    console.error('Error checking date availability:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check availability'
    });
  }
}
