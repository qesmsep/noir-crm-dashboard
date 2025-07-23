import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Event type labels for better formatting
const eventTypeLabels: { [key: string]: string } = {
  'dining': 'Dining',
  'birthday': 'Birthday',
  'anniversary': 'Anniversary',
  'business': 'Business',
  'date': 'Date Night',
  'celebration': 'Celebration',
  'other': 'Other',
  'SMS Reservation': 'SMS Reservation'
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reservation_id, action } = body;

    if (!reservation_id || !action) {
      return NextResponse.json(
        { error: 'Reservation ID and action are required' },
        { status: 400 }
      );
    }

    // Get reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        tables (
          table_number
        )
      `)
      .eq('id', reservation_id)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Get timezone from settings or default to America/Chicago
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('timezone')
      .single();

    const timezone = settings?.timezone || 'America/Chicago';
    
    // Format date and time using Luxon with timezone awareness
    const startDate = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(timezone);
    const formattedDate = startDate.toLocaleString({
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const formattedTime = startDate.toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Get table number or 'TBD'
    const tableNumber = reservation.tables?.table_number || 'TBD';

    // Get event type label or fallback
    const eventType = eventTypeLabels[reservation.event_type] || reservation.event_type || 'Dining';

    // Determine member status
    const memberStatus = reservation.membership_type === 'member' ? 'Yes' : 'No';

    // Get source information
    const source = reservation.source || 'unknown';
    const sourceLabel = source === 'sms' ? 'Text' : source === 'website' ? 'Website' : source === 'manual' ? 'Manual' : source;

    // Create message content with party size and source
    let messageContent = `Noir Reservation ${action} (${sourceLabel}): ${reservation.first_name || 'Guest'} ${reservation.last_name || ''}, ${formattedDate} at ${formattedTime}, ${reservation.party_size} guests, Table ${tableNumber}, ${eventType}, Member: ${memberStatus}`;
    
    if (reservation.notes && reservation.notes.trim()) {
      messageContent += `\nSpecial Requests: ${reservation.notes.trim()}`;
    }

    // Check if OpenPhone credentials are configured
    if (!process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
      console.error('OpenPhone API credentials not configured');
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      );
    }

    // Format the target phone number (6199713730)
    const targetPhone = '+16199713730';

    // Send SMS using OpenPhone API
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [targetPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: messageContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send reservation notification SMS:', errorText);
      return NextResponse.json(
        { error: 'Failed to send SMS notification' },
        { status: 500 }
      );
    }

    const responseData = await response.json();

    // Log the notification in guest_messages table
    const { error: logError } = await supabase
      .from('guest_messages')
      .insert({
        phone: targetPhone,
        content: messageContent,
        reservation_id: reservation_id,
        sent_by: 'system',
        status: 'sent',
        openphone_message_id: responseData.id,
        timestamp: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging reservation notification:', logError);
      // Don't fail the request if logging fails
    }

    console.log('Reservation notification sent successfully to 6199713730');
    return NextResponse.json({ 
      success: true, 
      message: 'Notification sent successfully',
      messageId: responseData.id 
    });

  } catch (error) {
    console.error('Error in reservation notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 