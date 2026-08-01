import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, location, adminOverride, partySize } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Parse the date (format: YYYY-MM-DD)
    const requestDate = DateTime.fromISO(date);

    // Get location_id if location slug is provided
    let locationId: string | null = null;
    if (location && typeof location === 'string') {
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', location)
        .single();

      if (!locationError && locationData) {
        locationId = locationData.id;
      }
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

            const start = DateTime.fromObject({ hour: startHour, minute: startMinute }, { zone: 'America/Chicago' });
            const end = DateTime.fromObject({ hour: endHour, minute: endMinute }, { zone: 'America/Chicago' });

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
    } else if (skipExceptionalClosures && closures && closures.length > 0) {
      console.log('[ADMIN OVERRIDE] Skipping exceptional closures for date:', date);
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
        const start = DateTime.fromISO(event.start_time).setZone('America/Chicago');
        const end = DateTime.fromISO(event.end_time).setZone('America/Chicago');

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
    } else {
      console.log('[ADMIN OVERRIDE] Skipping private event blocking for date:', date);
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
        } else if (tables && tables.length > 0) {
          // Filter out tables 4, 8, and 12 (not available for reservations)
          const excludedTableNumbers = [4, 8, 12];
          const availableTables = tables.filter((t: any) =>
            !excludedTableNumbers.includes(parseInt(t.table_number, 10))
          );

          if (availableTables.length > 0) {
            // Get all reservations for this date
            const startOfDay = requestDate.startOf('day').toUTC().toISO();
            const endOfDay = requestDate.endOf('day').toUTC().toISO();

            const tableIds = availableTables.map(t => t.id);

            // Get existing reservations for these tables on this date
            const { data: reservations, error: resError } = await supabase
              .from('reservations')
              .select('id, table_id, start_time, end_time, status')
              .in('table_id', tableIds)
              .gte('start_time', startOfDay)
              .lte('start_time', endOfDay);

            if (resError) {
              console.error('Error fetching reservations:', resError);
            } else {
              // Filter out cancelled reservations
              const activeReservations = (reservations || []).filter(
                (r: any) => !r.status || r.status !== 'cancelled'
              );

              // Get venue hours for this date and location
              let venueHoursQuery = supabase
                .from('venue_hours')
                .select('*')
                .eq('type', 'base')
                .eq('day_of_week', requestDate.weekday % 7); // Convert to 0-6 Sunday-Saturday

              if (locationId) {
                venueHoursQuery = venueHoursQuery.eq('location_id', locationId);
              }

              const { data: venueHours } = await venueHoursQuery;

              // Default operating hours if not found in database
              const defaultHours = [
                { start: '18:00', end: '23:00' } // 6 PM to 11 PM
              ];

              const operatingHours = venueHours && venueHours.length > 0 && venueHours[0].time_ranges
                ? venueHours[0].time_ranges
                : defaultHours;

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
                    }, { zone: 'America/Chicago' });

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
            // No tables at all that can fit this party size
            console.log(`No tables can accommodate party size ${partySizeNum}`);
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
