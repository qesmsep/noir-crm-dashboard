import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      private_event_id,
      first_name,
      last_name,
      email,
      phone,
      party_size,
      time_selected,
      special_requests
    } = body;

    // Validate required fields
    if (!private_event_id || !first_name || !last_name || !email || !phone || !party_size) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the private event details
    const { data: event, error: eventError } = await supabase
      .from('private_events')
      .select('*')
      .eq('id', private_event_id)
      .eq('status', 'active')
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Private event not found or inactive' },
        { status: 404 }
      );
    }

    // Validate party size
    if (party_size > event.max_guests) {
      return NextResponse.json(
        { error: `Party size cannot exceed ${event.max_guests} guests` },
        { status: 400 }
      );
    }

    // Validate total attendees maximum
    const { data: attendeeReservations, error: attendeeError } = await supabase
      .from('reservations')
      .select('party_size')
      .eq('private_event_id', private_event_id);
    if (attendeeError) {
      return NextResponse.json(
        { error: 'Failed to check event attendee count' },
        { status: 500 }
      );
    }
    const currentAttendees = (attendeeReservations || []).reduce((sum, r) => sum + (r.party_size || 0), 0);
    if (currentAttendees + party_size > event.total_attendees_maximum) {
      return NextResponse.json(
        { error: `This RSVP would exceed the event's total attendee limit of ${event.total_attendees_maximum}. Only ${event.total_attendees_maximum - currentAttendees} spots remain.` },
        { status: 400 }
      );
    }

    // For private events, we don't need to assign specific tables
    // Just check if there's already a reservation for this person at this event
    const { data: existingReservation, error: existingError } = await supabase
      .from('reservations')
      .select('*')
      .eq('private_event_id', private_event_id)
      .eq('email', email)
      .single();

    if (existingReservation) {
      return NextResponse.json(
        { error: 'You have already RSVP\'d for this event' },
        { status: 400 }
      );
    }

    // Create the reservation without table assignment for private events
    const reservationData = {
      private_event_id,
      table_id: null, // No specific table for private events
      start_time: time_selected || event.start_time,
      end_time: event.end_time,
      party_size,
      first_name,
      last_name,
      email,
      phone,
      notes: special_requests || `RSVP for ${event.title}`,
      source: 'rsvp_private_event'
      // Note: time_selected and event_type columns will be added by the migration
    };

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select(`
        *,
        tables (
          id,
          table_number,
          seats
        )
      `)
      .single();

    if (reservationError) {
      console.error('Error creating RSVP reservation:', reservationError);
      return NextResponse.json(
        { error: 'Failed to create reservation' },
        { status: 500 }
      );
    }

    // Send SMS confirmation
    try {
      // Check if OpenPhone credentials are configured
      if (!process.env.OPENPHONE_API_KEY) {
        console.error('OpenPhone API key not configured');
      } else if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
        console.error('OpenPhone phone number ID not configured');
      } else {
        const eventDateTime = DateTime.fromISO(event.start_time, { zone: 'utc' }).setZone('America/Chicago');
        const formattedDate = eventDateTime.toLocaleString({
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const timeString = eventDateTime.toLocaleString({
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const messageContent = `Thank you, ${first_name}. Your RSVP has been confirmed for ${event.title} on ${formattedDate} at ${timeString} for ${party_size} guests. Please respond directly to this text message if you need to make any changes.`;

        // Format phone number
        let formattedPhone = phone;
        if (phone) {
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            formattedPhone = '+1' + digits;
          } else if (digits.length === 11 && digits.startsWith('1')) {
            formattedPhone = '+' + digits;
          } else {
            formattedPhone = '+' + digits;
          }
        }

        console.log('Sending SMS confirmation to:', formattedPhone);
        console.log('Sending from phone ID:', process.env.OPENPHONE_PHONE_NUMBER_ID);
        console.log('Event time (CST):', formattedDate, 'at', timeString);

        // Send SMS using OpenPhone API
        const response = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.OPENPHONE_API_KEY,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            to: [formattedPhone],
            from: process.env.OPENPHONE_PHONE_NUMBER_ID,
            content: messageContent
          })
        });

        // Debug logging for response
        console.log('OpenPhone API Response Status:', response.status);
        const responseText = await response.text();
        console.log('OpenPhone API Response:', responseText);

        if (!response.ok) {
          console.error('Failed to send SMS confirmation:', responseText);
        } else {
          console.log('SMS confirmation sent successfully to:', formattedPhone);
        }
      }
    } catch (smsError) {
      console.error('Error sending SMS confirmation:', smsError);
    }

    return NextResponse.json({
      success: true,
      reservation,
      message: 'RSVP submitted successfully'
    });
  } catch (error) {
    console.error('Error in RSVP POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 