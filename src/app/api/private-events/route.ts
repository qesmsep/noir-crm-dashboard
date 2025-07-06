import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      event_type,
      start_time,
      end_time,
      max_guests,
      total_attendees_maximum,
      deposit_required = 0,
      event_description,
      rsvp_enabled = false,
      background_image_url,
      require_time_selection = false
    } = body;

    // Validate required fields
    if (!title || !event_type || !start_time || !end_time || !max_guests || !total_attendees_maximum) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user from authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
      }
    }

    // Generate RSVP URL if RSVP is enabled
    let rsvp_url = null;
    if (rsvp_enabled) {
      const { data: urlData, error: urlError } = await supabase
        .rpc('generate_rsvp_url');
      
      if (urlError) {
        console.error('Error generating RSVP URL:', urlError);
        return NextResponse.json(
          { error: 'Failed to generate RSVP URL' },
          { status: 500 }
        );
      }
      rsvp_url = urlData;
    }

    // Create the private event
    const { data: event, error } = await supabase
      .from('private_events')
      .insert([{
        title,
        event_type,
        start_time,
        end_time,
        max_guests,
        total_attendees_maximum,
        deposit_required,
        event_description,
        rsvp_enabled,
        rsvp_url,
        background_image_url,
        require_time_selection,
        created_by: userId || body.created_by // Use authenticated user or fallback
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating private event:', error);
      return NextResponse.json(
        { error: 'Failed to create private event' },
        { status: 500 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error in private events POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let query = supabase
      .from('private_events')
      .select('*')
      .eq('status', 'active')
      .order('start_time', { ascending: true });
    
    // Add date filtering if provided
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('end_time', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching private events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch private events' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in private events GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 