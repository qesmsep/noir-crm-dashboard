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
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Parse the date (format: YYYY-MM-DD)
    const requestDate = DateTime.fromISO(date);

    // Fetch private events for this date
    const { data: events, error } = await supabase
      .from('private_events')
      .select('id, title, start_time, end_time')
      .gte('end_time', requestDate.startOf('day').toISO())
      .lte('start_time', requestDate.endOf('day').toISO())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching private events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    // Format blocked time ranges in local timezone (America/Chicago)
    const blockedTimeRanges = (events || []).map((event) => {
      const start = DateTime.fromISO(event.start_time).setZone('America/Chicago');
      const end = DateTime.fromISO(event.end_time).setZone('America/Chicago');

      return {
        id: event.id,
        title: event.title,
        startTime: start.toFormat('h:mm a'),
        endTime: end.toFormat('h:mm a'),
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
      };
    });

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
