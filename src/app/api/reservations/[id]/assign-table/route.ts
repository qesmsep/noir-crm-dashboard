import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

interface AssignTableBody {
  table_id: string;
  start_time: string;
  end_time: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const body: AssignTableBody = await request.json();
    const { table_id, start_time, end_time } = body;

    // ========================================
    // STEP 1: AUTHENTICATION & AUTHORIZATION
    // ========================================

    // Get authenticated user from request headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No authentication token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Verify user is an admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, access_level')
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // ========================================
    // STEP 2: INPUT VALIDATION
    // ========================================

    // Validate required fields
    if (!table_id || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing required fields: table_id, start_time, end_time' },
        { status: 400 }
      );
    }

    // Trim whitespace
    const trimmedTableId = table_id.trim();
    const trimmedReservationId = reservationId.trim();

    // Validate IDs are not empty
    if (!trimmedTableId) {
      return NextResponse.json(
        { error: 'table_id cannot be empty' },
        { status: 400 }
      );
    }

    if (!trimmedReservationId) {
      return NextResponse.json(
        { error: 'reservation_id cannot be empty' },
        { status: 400 }
      );
    }

    // Validate datetime format and logic
    let startDate: Date;
    let endDate: Date;

    try {
      startDate = new Date(start_time);
      endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid datetime format. Expected ISO8601 format.' },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 3: FETCH & VERIFY RESERVATION
    // ========================================

    const { data: existingReservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, private_event_id, source, party_size')
      .eq('id', trimmedReservationId)
      .single();

    if (fetchError || !existingReservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (existingReservation.source !== 'rsvp_private_event') {
      return NextResponse.json(
        { error: 'Can only assign tables to private event RSVPs' },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 4: FETCH PRIVATE EVENT & VERIFY LOCATION
    // ========================================

    const { data: privateEvent, error: eventError } = await supabaseAdmin
      .from('private_events')
      .select('id, title, location_id')
      .eq('id', existingReservation.private_event_id)
      .single();

    if (eventError || !privateEvent) {
      return NextResponse.json(
        { error: 'Private event not found' },
        { status: 404 }
      );
    }

    // ========================================
    // STEP 5: FETCH & VERIFY TABLE
    // ========================================

    const { data: table, error: tableError } = await supabaseAdmin
      .from('tables')
      .select('id, table_number, seats, location_id')
      .eq('id', trimmedTableId)
      .single();

    if (tableError || !table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Verify table location matches private event location
    if (table.location_id !== privateEvent.location_id) {
      return NextResponse.json(
        {
          error: `Table ${table.table_number} is at a different location than the private event "${privateEvent.title}"`
        },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 6: VALIDATE PARTY SIZE vs TABLE CAPACITY
    // ========================================

    if (existingReservation.party_size > table.seats) {
      return NextResponse.json(
        {
          error: `Party size (${existingReservation.party_size}) exceeds table capacity (${table.seats} seats). Please select a larger table.`,
          warning: true
        },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 7: CHECK FOR TIME CONFLICTS
    // ========================================

    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .from('reservations')
      .select('id, first_name, last_name, start_time, end_time, status')
      .eq('table_id', trimmedTableId)
      .neq('id', trimmedReservationId)
      .neq('status', 'cancelled')
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

    if (conflictError) {
      console.error('Error checking for conflicts:', conflictError);
      return NextResponse.json(
        { error: 'Failed to check table availability' },
        { status: 500 }
      );
    }

    if (conflicts && conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => {
        const startTime = new Date(c.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Chicago'
        });
        const endTime = new Date(c.end_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Chicago'
        });
        return `${c.first_name} ${c.last_name} (${startTime} - ${endTime})`;
      }).join(', ');

      return NextResponse.json(
        {
          error: `Table ${table.table_number} is already assigned to: ${conflictDetails}`,
          conflicts: conflicts,
          conflictCount: conflicts.length
        },
        { status: 409 }
      );
    }

    // ========================================
    // STEP 8: UPDATE RESERVATION
    // ========================================

    const { data: updatedReservation, error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        table_id: trimmedTableId,
        start_time,
        end_time,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trimmedReservationId)
      .select(`
        id,
        first_name,
        last_name,
        phone,
        party_size,
        table_id,
        start_time,
        end_time,
        private_event_id,
        status,
        tables (
          id,
          table_number,
          seats
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating reservation:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign table to reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reservation: updatedReservation,
      message: `Successfully assigned ${existingReservation.party_size} guests to Table ${table.table_number}`,
    });
  } catch (error) {
    console.error('Error in assign-table PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
