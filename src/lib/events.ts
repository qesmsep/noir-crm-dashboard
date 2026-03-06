import { supabaseAdmin } from '@/lib/supabase';

interface DateRange {
  type: 'this_month' | 'next_month' | 'specific_range';
  start_date?: string;
  end_date?: string;
}

interface MemberEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  date: string;
  time: string;
  description: string | null;
  location: null;
  maxGuests: number | null;
  totalAttendees: number | null;
  rsvpEnabled: boolean;
  rsvpUrl: string | null;
}

/**
 * Fetch Noir member events
 */
export async function getNoirMemberEvents(dateRange?: DateRange): Promise<{ events: MemberEvent[]; error?: string }> {
  try {
    let startDate: string;
    let endDate: string;

    // If dateRange provided, parse it; otherwise fetch all upcoming events
    if (dateRange) {
      switch (dateRange.type) {
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
          if (!dateRange.start_date || !dateRange.end_date) {
            return { events: [], error: 'Start and end dates are required for specific range' };
          }
          startDate = new Date(dateRange.start_date).toISOString();
          endDate = new Date(dateRange.end_date).toISOString();
          break;

        default:
          return { events: [], error: 'Invalid date range type' };
      }
    } else {
      // Default: fetch upcoming events (from now onwards)
      startDate = new Date().toISOString();
      // Fetch events up to 1 year from now
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      endDate = oneYearFromNow.toISOString();
    }

    // Fetch member events (is_member_event = true) within the date range
    const { data: events, error } = await supabaseAdmin
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
        rsvp_enabled,
        rsvp_url,
        is_member_event
      `)
      .eq('is_member_event', true)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching Noir Member Events:', error);
      return { events: [], error: 'Failed to fetch events' };
    }

    // Format the events for display
    const formattedEvents = events?.map(event => ({
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
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
      location: null,
      maxGuests: event.max_guests,
      totalAttendees: event.total_attendees_maximum,
      rsvpEnabled: event.rsvp_enabled,
      rsvpUrl: event.rsvp_url
    })) || [];

    return { events: formattedEvents };
  } catch (error: any) {
    console.error('Error in getNoirMemberEvents:', error);
    return { events: [], error: error.message };
  }
}
