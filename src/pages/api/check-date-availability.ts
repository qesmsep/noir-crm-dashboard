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
    const { date, location, adminOverride } = req.query;

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
