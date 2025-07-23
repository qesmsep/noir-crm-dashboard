import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      first_name,
      last_name,
      email,
      phone,
      party_size,
      time_selected,
      special_requests
    } = body;

    // Validate required fields
    if (!id || !first_name || !last_name || !email || !phone || !party_size) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the reservation to check if it exists and get the private event details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, private_events(*)')
      .eq('id', id)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Validate total attendees maximum
    const { data: attendeeReservations, error: attendeeError } = await supabase
      .from('reservations')
      .select('party_size, id')
      .eq('private_event_id', reservation.private_event_id);
    
    if (attendeeError) {
      return NextResponse.json(
        { error: 'Failed to check event attendee count' },
        { status: 500 }
      );
    }
    
    const currentAttendees = (attendeeReservations || []).reduce((sum, r) => {
      if (r.id === id) return sum; // Exclude current reservation
      return sum + (r.party_size || 0);
    }, 0);

    const newTotalAttendees = currentAttendees + party_size;
    const maxAttendees = reservation.private_events?.max_attendees || 0;

    if (maxAttendees > 0 && newTotalAttendees > maxAttendees) {
      return NextResponse.json(
        { error: `Event capacity exceeded. Maximum ${maxAttendees} attendees allowed.` },
        { status: 400 }
      );
    }

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({
        first_name,
        last_name,
        email,
        phone,
        party_size,
        time_selected,
        special_requests,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reservation: updatedReservation
    });

  } catch (error) {
    console.error('Error updating RSVP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 