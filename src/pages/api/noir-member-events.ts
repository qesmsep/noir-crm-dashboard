import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dateRange } = req.query;

    if (!dateRange || typeof dateRange !== 'string') {
      return res.status(400).json({ error: 'Date range is required' });
    }

    let startDate: string;
    let endDate: string;

    // Parse the date range
    const rangeData = JSON.parse(dateRange);
    
    switch (rangeData.type) {
      case 'this_month':
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        break;
      
      case 'next_month':
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        startDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1).toISOString();
        endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).toISOString();
        break;
      
      case 'specific_range':
        if (!rangeData.start_date || !rangeData.end_date) {
          return res.status(400).json({ error: 'Start and end dates are required for specific range' });
        }
        startDate = new Date(rangeData.start_date).toISOString();
        endDate = new Date(rangeData.end_date).toISOString();
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid date range type' });
    }

    // Fetch Noir Member Event events within the date range
    const { data: events, error } = await supabase
      .from('private_events')
      .select(`
        id,
        title,
        event_type,
        start_time,
        end_time,
        event_description,
        max_guests,
        total_attendees_maximum,
        status
      `)
      .eq('event_type', 'Noir Member Event')
      .eq('status', 'active')
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching Noir Member Events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    // Format the events for display
    const formattedEvents = events?.map(event => ({
      id: event.id,
      title: event.title,
      date: new Date(event.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: new Date(event.start_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      description: event.event_description,
      maxGuests: event.max_guests,
      totalAttendees: event.total_attendees_maximum
    })) || [];

    res.status(200).json({ events: formattedEvents });
  } catch (error) {
    console.error('Error in noir-member-events API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 