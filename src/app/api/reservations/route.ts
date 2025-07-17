import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { formatDateTime } from '../../../utils/dateUtils';
import Stripe from 'stripe';
import { getHoldFeeConfig, getHoldAmount } from '../../../utils/holdFeeUtils';
import { DateTime } from 'luxon';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Map event type value to label
const eventTypeLabels: Record<string, string> = {
  birthday: 'Birthday',
  engagement: 'Engagement',
  anniversary: 'Anniversary',
  party: 'Party / Celebration',
  graduation: 'Graduation',
  corporate: 'Corporate Event',
  holiday: 'Holiday Gathering',
  networking: 'Networking',
  fundraiser: 'Fundraiser / Charity',
  bachelor: 'Bachelor / Bachelorette Party',
  fun: 'Fun Night Out',
  date: 'Date Night',
};

// Function to send admin notification
async function sendAdminNotification(reservationId: string, action: 'created' | 'modified') {
  try {
    console.log('=== ADMIN NOTIFICATION DEBUG ===');
    console.log('Reservation ID:', reservationId);
    console.log('Action:', action);
    
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

    console.log('Reservation found:', reservation);

    // Get admin notification phone and timezone from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('admin_notification_phone, timezone')
      .single();

    console.log('Settings found:', settings);
    console.log('Settings error:', settingsError);

    if (settingsError || !settings?.admin_notification_phone) {
      console.log('❌ Admin notification phone not configured');
      console.log('Settings data:', settings);
      console.log('Settings error:', settingsError);
      return;
    }

    console.log('✅ Admin notification phone configured:', settings.admin_notification_phone);

    // Format admin phone number (add +1 if not present)
    let adminPhone = settings.admin_notification_phone;
    if (!adminPhone.startsWith('+')) {
      adminPhone = '+1' + adminPhone;
    }

    // Get timezone from settings or default to America/Chicago
    const timezone = settings.timezone || 'America/Chicago';
    
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

    // Create message content with party size
    let messageContent = `Noir Reservation ${action}: ${reservation.first_name || 'Guest'} ${reservation.last_name || ''}, ${formattedDate} at ${formattedTime}, ${reservation.party_size} guests, Table ${tableNumber}, ${eventType}, Member: ${memberStatus}`;
    if (reservation.notes && reservation.notes.trim()) {
      messageContent += `\nSpecial Requests: ${reservation.notes.trim()}`;
    }

    console.log('Message content:', messageContent);
    console.log('Admin phone:', adminPhone);
    console.log('OpenPhone API Key exists:', !!process.env.OPENPHONE_API_KEY);
    console.log('OpenPhone Phone Number ID exists:', !!process.env.OPENPHONE_PHONE_NUMBER_ID);

    // Send SMS using OpenPhone API (same as existing sendText.js)
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY!,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [adminPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: messageContent
      })
    });

    console.log('OpenPhone response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to send admin notification SMS:', errorText);
      return;
    }

    const responseData = await response.json();
    console.log('✅ Admin notification sent successfully');
    console.log('OpenPhone response:', responseData);
    console.log('=== END ADMIN NOTIFICATION DEBUG ===');
  } catch (error) {
    console.error('Error in sendAdminNotification:', error);
  }
}



// Helper function to calculate hold amount based on party size and settings
async function getHoldAmountFromSettings(partySize: number): Promise<number> {
  const holdFeeConfig = await getHoldFeeConfig();
  return getHoldAmount(partySize, holdFeeConfig);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      start_time,
      end_time,
      party_size,
      event_type,
      notes,
      phone,
      email,
      first_name,
      last_name,
      payment_method_id,
      member_id,
      is_member
    } = body;

    // Validate required fields
    if (!start_time || !end_time || !party_size || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For non-members, validate additional required fields
    if (!is_member && (!email || !first_name || !last_name)) {
      return NextResponse.json(
        { error: 'Missing required fields for non-member reservation' },
        { status: 400 }
      );
    }

    // For members, verify membership status and use their details
    if (is_member) {
      // If member_id is provided, use it directly
      if (member_id) {
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('*')
          .eq('member_id', member_id)
          .single();

        if (memberError || !member) {
          return NextResponse.json(
            { error: 'Invalid member ID' },
            { status: 400 }
          );
        }
        // Use member details for reservation
        body.first_name = member.first_name;
        body.last_name = member.last_name;
        body.email = member.email;
        body.phone = member.phone;
      } else {
        // Otherwise, try to find member by phone
        const digits = phone.replace(/\D/g, '');
        const possiblePhones = [digits, '+1' + digits, '1' + digits];
        // Try to match any of these formats
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('*')
          .in('phone', possiblePhones)
          .single();

        if (memberError || !member) {
          return NextResponse.json(
            { error: 'Invalid member phone number' },
            { status: 400 }
          );
        }
        // Use member details for reservation
        body.first_name = member.first_name;
        body.last_name = member.last_name;
        body.email = member.email;
        body.phone = member.phone;
      }
    }

    // Assign a table automatically
    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('seats', party_size);

    if (tablesError) {
      console.error('Supabase tablesError:', tablesError.message);
      return NextResponse.json({ error: 'Error fetching tables: ' + tablesError.message }, { status: 500 });
    }

    if (!tables || tables.length === 0) {
      return NextResponse.json({ error: 'No available table for this party size' }, { status: 400 });
    }
    // 2. Get all reservations for that date
    const startOfDay = new Date(start_time);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(start_time);
    endOfDay.setHours(23, 59, 59, 999);
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    if (resError) {
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }
    // 3. Find the smallest available table
    const slotStart = new Date(start_time);
    const slotEnd = new Date(end_time);
    const availableTable = tables
      .sort((a, b) => a.seats - b.seats)
      .find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        // Check for overlap
        return !tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (
            (slotStart < resEnd) && (slotEnd > resStart)
          );
        });
      });
    
    if (!availableTable) {
      // No table available at requested time - find alternative times
      console.log('No table available, attempting to find alternative times...');
      try {
        // Convert time to 12-hour format using UTC to avoid timezone issues
        const startDate = new Date(start_time);
        const dateString = startDate.toISOString().split('T')[0];
        
        // Use UTC methods to avoid timezone conversion issues
        const hours = startDate.getUTCHours();
        const minutes = startDate.getUTCMinutes();
        const ampm = hours >= 12 ? 'pm' : 'am';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const timeString = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
        
        console.log('Calling alternative times function with:', { dateString, party_size, requested_time: timeString });
        console.log('Original start_time:', start_time);
        console.log('Parsed hours (UTC):', hours, 'minutes:', minutes, 'ampm:', ampm);
        console.log('Converted time string:', timeString);
        
        // Call the alternative times function directly
        const altData = await findAlternativeTimes(dateString, party_size, timeString);
        
        console.log('Alternative times result:', altData);
        
        if (altData) {
          return NextResponse.json({
            error: 'No available table for this time and party size',
            alternative_times: altData.alternative_times,
            message: altData.message,
            requested_time: altData.requested_time
          }, { status: 409 }); // 409 Conflict - indicates alternative times are available
        }
      } catch (altError) {
        console.error('Error finding alternative times:', altError);
      }
      
      // Fallback to original error if alternative times lookup fails
      return NextResponse.json({ error: 'No available table for this time and party size' }, { status: 400 });
    }
    
    // For non-members, create Stripe hold before creating reservation
    let paymentIntentId: string | null = null;
    let holdAmount: number | null = null;
    
    if (!is_member && payment_method_id) {
      try {
        holdAmount = await getHoldAmountFromSettings(party_size);
        
        // Only create hold if amount is greater than 0
        if (holdAmount > 0) {
          // Create PaymentIntent for the hold
          const paymentIntent = await stripe.paymentIntents.create({
            amount: holdAmount * 100, // Convert to cents
            currency: 'usd',
            capture_method: 'manual', // This creates a hold, not a charge
            payment_method: payment_method_id,
            confirm: true, // Confirm the payment method immediately
            metadata: {
              reservation_type: 'non_member_reservation',
              party_size: party_size.toString(),
              hold_amount: holdAmount.toString()
            },
            description: `Reservation hold - $${holdAmount}`,
            return_url: process.env.NEXT_PUBLIC_BASE_URL
              ? `${process.env.NEXT_PUBLIC_BASE_URL}/reservation/confirmation`
              : 'https://noir-crm-dashboard.vercel.app/reservation/confirmation',
          });
          
          paymentIntentId = paymentIntent.id;
          console.log('Created Stripe hold:', paymentIntentId);
        }
      } catch (stripeError) {
        console.error('Error creating Stripe hold:', stripeError);
        return NextResponse.json(
          { error: 'Failed to create payment hold. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Create reservation with assigned table_id
    const reservationData = {
      start_time,
      end_time,
      party_size,
      event_type,
      notes,
      phone: body.phone,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      membership_type: body.is_member ? 'member' : 'non-member',
      payment_method_id,
      table_id: availableTable.id,
      payment_intent_id: paymentIntentId,
      hold_amount: holdAmount,
      hold_status: paymentIntentId ? 'confirmed' : null,
      hold_created_at: paymentIntentId ? new Date().toISOString() : null
    };

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    if (error) {
      console.error('Error creating reservation:', error);
      
      // If we created a hold but failed to create the reservation, we should release the hold
      if (paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(paymentIntentId);
          console.log('Cancelled hold due to reservation creation failure:', paymentIntentId);
        } catch (cancelError) {
          console.error('Error cancelling hold:', cancelError);
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to create reservation' },
        { status: 500 }
      );
    }

    // Send SMS confirmation
    await sendSMSConfirmation(reservation);

    // Send admin notification
    console.log('=== ABOUT TO SEND ADMIN NOTIFICATION ===');
    console.log('Reservation ID:', reservation.id);
    try {
      await sendAdminNotification(reservation.id, 'created');
    } catch (error) {
      console.error('Error sending admin notification:', error);
      // Don't fail the reservation creation if admin notification fails
    }

    // Schedule reservation reminders
    try {
      console.log('=== SCHEDULING RESERVATION REMINDERS ===');
      console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
      console.log('VERCEL_URL:', process.env.VERCEL_URL);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      
      // Use VERCEL_URL in production, or NEXT_PUBLIC_SITE_URL, or construct from request
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL 
        ? process.env.NEXT_PUBLIC_SITE_URL
        : 'http://localhost:3000';
        
      const reminderUrl = `${baseUrl}/api/schedule-reservation-reminders`;
      
      console.log('Reminder URL:', reminderUrl);
        
      await fetch(reminderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservation.id })
      });
      
      console.log('✅ Reservation reminders scheduled successfully');
    } catch (error) {
      console.error('Error scheduling reservation reminders:', error);
      // Don't fail the reservation creation if reminder scheduling fails
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error in reservations POST:', error);
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
      .from('reservations')
      .select(`
        *,
        tables (
          id,
          table_number,
          seats
        )
      `);

    // Add date filtering if provided
    if (startDate && endDate) {
      query = query
        .gte('start_time', startDate)
        .lte('start_time', endDate);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching reservations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reservations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in reservations GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: generate all time slots (e.g., 6:00pm to midnight, every 15 min)
function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 18; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'am' : 'pm';
      const min = m.toString().padStart(2, '0');
      slots.push(`${hour}:${min}${ampm}`);
    }
  }
  return slots;
}

// Helper: convert time string to Date object
function timeStringToDate(timeString: string, date: string): Date {
  const [time, ampm] = timeString.split(/(am|pm)/);
  let [hour, minute] = time.split(':').map(Number);
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const slotStart = new Date(date + 'T00:00:00.000Z'); // Create UTC date
  slotStart.setUTCHours(hour, minute, 0, 0); // Use UTC methods
  return slotStart;
}

// Helper function to find alternative times
async function findAlternativeTimes(date: string, party_size: number, requested_time: string) {
  try {
    // 2. Get all reservations for that date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get all reservations and filter in JavaScript to avoid query issues
    const { data: allReservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time');
    
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return null;
    }

    // Filter reservations for the specific date (compare only YYYY-MM-DD)
    const targetDateStr = date;
    const reservations = (allReservations || []).filter(res => {
      const resDateStr = new Date(res.start_time).toISOString().slice(0, 10);
      return resDateStr === targetDateStr;
    });

    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    
    if (tablesError || !tables || tables.length === 0) {
      return null;
    }

    // Map to id, number, seats for frontend
    const mappedTables = (tables || []).map(t => ({
      id: t.id,
      number: t.table_number,
      seats: parseInt(t.seats, 10)
    }));

    // 3. Generate all possible time slots
    const allSlots = generateTimeSlots();
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    
    // 4. Check availability for each slot
    const availableSlots: { time: string; available: boolean }[] = [];
    
    for (const slot of allSlots) {
      const slotStart = timeStringToDate(slot, date);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      
      // Check if any table is available for this slot
      const availableTable = mappedTables.find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        
        // Check for overlap
        const hasOverlap = tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          const overlap = (slotStart < resEnd) && (slotEnd > resStart);
          return overlap;
        });
        
        return !hasOverlap;
      });
      
      availableSlots.push({
        time: slot,
        available: !!availableTable
      });
    }

    // 5. Find the requested time index
    const requestedTimeIndex = availableSlots.findIndex(slot => slot.time === requested_time);
    
    if (requestedTimeIndex === -1) {
      return null;
    }

    // 6. Find nearest available times before and after
    let beforeTime: string | null = null;
    let afterTime: string | null = null;
    
    // Look for available time before the requested time
    for (let i = requestedTimeIndex - 1; i >= 0; i--) {
      if (availableSlots[i].available) {
        beforeTime = availableSlots[i].time;
        break;
      }
    }
    
    // Look for available time after the requested time
    for (let i = requestedTimeIndex + 1; i < availableSlots.length; i++) {
      if (availableSlots[i].available) {
        afterTime = availableSlots[i].time;
        break;
      }
    }

    return {
      requested_time,
      alternative_times: {
        before: beforeTime,
        after: afterTime
      },
      message: beforeTime || afterTime 
        ? 'The requested time is not available. Here are the nearest available times:'
        : 'No alternative times available for this date.'
    };
  } catch (error) {
    console.error('Error in findAlternativeTimes:', error);
    return null;
  }
}

// Function to send SMS confirmation
async function sendSMSConfirmation(reservation: any) {
  try {
    // Check if OpenPhone credentials are configured
    if (!process.env.OPENPHONE_API_KEY) {
      console.error('OpenPhone API key not configured');
      return false;
    }

    if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
      console.error('OpenPhone phone number ID not configured');
      return false;
    }

    // Format the date and time using Luxon with timezone awareness
    const startDate = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone('America/Chicago');
    const formattedDate = startDate.toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeString = startDate.toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Create the confirmation message
    const customerName = reservation.first_name || reservation.name || 'Guest';
    const occasion = reservation.event_type || 'dining';
    
    const messageContent = `Thank you, ${customerName}. Your reservation has been confirmed for Noir on ${formattedDate} at ${timeString} for ${reservation.party_size} guests. ${occasion !== 'dining' ? `Occasion: ${occasion}. ` : ''}Please respond directly to this text message if you need to make any changes or if you have any questions.`;

    // Format phone number
    let formattedPhone = reservation.phone;
    if (!formattedPhone.startsWith('+')) {
      const digits = formattedPhone.replace(/\D/g, '');
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
    console.log('Reservation time (CST):', formattedDate, 'at', timeString);

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
      return false;
    }

    console.log('SMS confirmation sent successfully to:', formattedPhone);
    return true;
  } catch (error) {
    console.error('Error sending SMS confirmation:', error);
    return false;
  }
} 