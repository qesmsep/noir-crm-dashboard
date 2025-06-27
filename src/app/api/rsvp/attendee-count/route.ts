import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get current attendee count for the event
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('party_size')
      .eq('private_event_id', eventId);

    if (error) {
      console.error('Error fetching attendee count:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attendee count' },
        { status: 500 }
      );
    }

    const currentAttendees = (reservations || []).reduce((sum, r) => sum + (r.party_size || 0), 0);

    return NextResponse.json({
      currentAttendees,
      totalReservations: reservations?.length || 0
    });

  } catch (error) {
    console.error('Error in attendee count GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 