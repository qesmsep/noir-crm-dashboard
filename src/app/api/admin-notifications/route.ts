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

    // Get admin notification phone from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone, timezone')
      .single();

    if (settingsError || !settings?.admin_notification_phone) {
      return NextResponse.json(
        { error: 'Admin notification phone not configured' },
        { status: 400 }
      );
    }

    // Format admin phone number (add +1 if not present)
    let adminPhone = settings.admin_notification_phone;
    if (!adminPhone.startsWith('+')) {
      adminPhone = '+1' + adminPhone;
    }

    // Use timezone from settings or default to America/Chicago
    const timezone = settings.timezone || 'America/Chicago';
    // Format date and time in local timezone
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

    // Get event type or 'Dining'
    const eventType = reservation.event_type || 'Dining';

    // Determine member status
    const memberStatus = reservation.membership_type === 'member' ? 'Yes' : 'No';

    // Create message content
    const messageContent = `Noir Reservation ${action}: ${reservation.first_name || 'Guest'} ${reservation.last_name || ''}, ${formattedDate} at ${formattedTime}, Table ${tableNumber}, ${eventType}, Member: ${memberStatus}`;

    // Check if OpenPhone credentials are configured
    if (!process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
      console.error('OpenPhone API credentials not configured');
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      );
    }

    // Send SMS using OpenPhone API
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [adminPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: messageContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send admin notification SMS:', errorText);
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
        phone: adminPhone,
        content: messageContent,
        reservation_id: reservation_id,
        sent_by: 'system',
        status: 'sent',
        openphone_message_id: responseData.id,
        timestamp: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging admin notification:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Admin notification sent successfully',
      openphone_message_id: responseData.id
    });

  } catch (error) {
    console.error('Error sending admin notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 