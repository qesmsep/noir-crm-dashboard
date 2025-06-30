import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rsvpUrl: string }> }
) {
  try {
    const { rsvpUrl } = await params;
    
    const { data: event, error } = await supabase
      .from('private_events')
      .select('*')
      .eq('rsvp_url', rsvpUrl)
      .eq('status', 'active')
      .single();

    if (error || !event) {
      return NextResponse.json(
        { error: 'Event not found or not active' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 