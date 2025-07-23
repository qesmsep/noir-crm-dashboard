import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to send admin notification
async function sendAdminNotification(reservationId: string, action: 'created' | 'modified') {
  try {
    // Get reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        tables (
          table_number
        )
      `)
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      console.error('Error fetching reservation for admin notification:', reservationError);
      return;
    }

    // Get admin notification phone from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone, timezone')
      .single();

    if (settingsError || !settings?.admin_notification_phone) {
      console.log('Admin notification phone not configured');
      return;
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

    // Create message content with party size
    const messageContent = `Noir Reservation ${action}: ${reservation.first_name || 'Guest'} ${reservation.last_name || ''}, ${formattedDate} at ${formattedTime}, ${reservation.party_size} guests, Table ${tableNumber}, ${eventType}, Member: ${memberStatus}`;

    // Check if OpenPhone credentials are configured
    if (!process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
      console.error('OpenPhone API credentials not configured');
      return;
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
      return;
    }

    const responseData = await response.json();

    // Log the notification in guest_messages table
    const { error: logError } = await supabase
      .from('guest_messages')
      .insert({
        phone: adminPhone,
        content: messageContent,
        reservation_id: reservationId,
        sent_by: 'system',
        status: 'sent',
        openphone_message_id: responseData.id,
        timestamp: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging admin notification:', logError);
      // Don't fail the request if logging fails
    }

    console.log('Admin notification sent successfully');
  } catch (error) {
    console.error('Error in sendAdminNotification:', error);
  }
}

export async function PATCH(request: Request, { params }: any) {
  const { id } = await params;
  const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;
  console.log('PATCH: Querying for reservation id:', reservationId);
  
  try {
    const body = await request.json();

    const {
      start_time,
      end_time,
      table_id,
      first_name,
      last_name,
      email,
      phone,
      party_size,
      event_type,
      notes,
      checked_in
    } = body;

    const updateFields: any = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (party_size !== undefined) updateFields.party_size = party_size;
    if (table_id !== undefined) updateFields.table_id = table_id;
    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;
    if (event_type !== undefined) updateFields.event_type = event_type;
    if (notes !== undefined) updateFields.notes = notes;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;
    
    // Handle check-in status
    if (checked_in !== undefined) {
      updateFields.checked_in = checked_in;
      if (checked_in) {
        // Set check-in timestamp and user when checking in
        updateFields.checked_in_at = new Date().toISOString();
        // Note: In a real implementation, you'd get the current user ID
        // For now, we'll leave checked_in_by as null
      } else {
        // Clear check-in data when unchecking
        updateFields.checked_in_at = null;
        updateFields.checked_in_by = null;
      }
    }

    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reservations')
      .update(updateFields)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }

    console.log('Reservation updated successfully:', data);

    // Send admin notification for reservation modification
    try {
      await sendAdminNotification(reservationId, 'modified');
    } catch (error) {
      console.error('Error sending admin notification:', error);
      // Don't fail the reservation update if admin notification fails
    }

    // Send notification to 6199713730 for reservation modification
    console.log('=== SENDING MODIFICATION NOTIFICATION TO 6199713730 ===');
    try {
      const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reservation-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          action: 'modified'
        })
      });

      if (!notificationResponse.ok) {
        console.error('Failed to send modification notification to 6199713730:', await notificationResponse.text());
      } else {
        console.log('Modification notification sent successfully to 6199713730');
      }
    } catch (error) {
      console.error('Error sending modification notification to 6199713730:', error);
      // Don't fail the reservation update if notification fails
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error(`Error updating reservation ${id}:`, error);
    return NextResponse.json(
      { error: `Failed to update reservation: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: any) {
  const { id } = await params;
  const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;
  console.log('GET: Querying for reservation id:', reservationId);
  
  try {
    console.log('API: Fetching reservation with ID:', reservationId);
    
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        tables (
          id,
          table_number,
          seats
        )
      `)
      .eq('id', reservationId)
      .single();

    console.log('API: Supabase query result:', { data, error });

    if (error) {
      console.error('API: Error fetching reservation:', error);
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    console.log('API: Successfully found reservation:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API: Error in reservation GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: any) {
  const { id } = await params;
  try {
    const reservationId = id.endsWith('.js') ? id.slice(0, -3) : id;

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (error) {
      console.error('Error deleting reservation:', error);
      return NextResponse.json(
        { error: 'Failed to delete reservation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Reservation deleted successfully' });

  } catch (error) {
    console.error('Error in reservation DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}