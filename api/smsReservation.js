import { createClient } from '@supabase/supabase-js';
import { sendCustomEmail } from './sendCustomEmail';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Parse SMS message to extract reservation details
function parseReservationMessage(message) {
  const reservationRegex = /RESERVATION\s+(\d+)\s+guests\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+@\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = message.match(reservationRegex);
  
  if (!match) return null;

  const [_, partySize, month, day, year, hour, minute, meridiem] = match;
  
  // Convert to 24-hour format
  let hour24 = parseInt(hour);
  if (meridiem?.toLowerCase() === 'pm' && hour24 < 12) hour24 += 12;
  if (meridiem?.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;

  // Create date object
  const fullYear = year.length === 2 ? `20${year}` : year;
  const date = new Date(fullYear, month - 1, day, hour24, minute ? parseInt(minute) : 0);
  
  // Calculate end time (2 hours after start)
  const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);

  return {
    party_size: parseInt(partySize),
    start_time: date.toISOString(),
    end_time: endDate.toISOString()
  };
}

// Helper to auto-assign smallest free table (copied from reservations.js)
async function assignTable(start_time, end_time, party_size) {
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  for (const t of tables) {
    const { data: events } = await supabase
      .from('events').select('start_time, end_time, table_id')
      .eq('table_id', t.id);
    const { data: reservations } = await supabase
      .from('reservations').select('start_time, end_time, table_id')
      .eq('table_id', t.id);
    const hasEventConflict = (events || []).some(e =>
      !(new Date(e.end_time) <= new Date(start_time) || new Date(e.start_time) >= new Date(end_time))
    );
    const hasReservationConflict = (reservations || []).some(r =>
      !(new Date(r.end_time) <= new Date(start_time) || new Date(r.start_time) >= new Date(end_time))
    );
    if (!hasEventConflict && !hasReservationConflict) return t.id;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from, body } = req.body;
  if (!from || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Normalize phone number
  const normalizedPhone = from.replace(/\D/g, '');

  // Check if sender is a member
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .limit(1)
    .or(`phone.eq.${normalizedPhone},phone.eq.${from}`);

  if (memberError) {
    return res.status(500).json({ error: 'Error checking member status' });
  }

  if (!memberData || memberData.length === 0) {
    return res.status(403).json({ 
      error: 'Not a member',
      message: 'Sorry, this service is only available to members. Please contact us to become a member.'
    });
  }

  const member = memberData[0];

  // Parse reservation details from message
  const reservationDetails = parseReservationMessage(body);
  if (!reservationDetails) {
    return res.status(400).json({ 
      error: 'Invalid message format',
      message: 'Please use the format: RESERVATION [number] guests [MM/DD/YY] @ [time]'
    });
  }

  // Check availability and assign table
  const table_id = await assignTable(
    reservationDetails.start_time,
    reservationDetails.end_time,
    reservationDetails.party_size
  );

  if (!table_id) {
    return res.status(409).json({ 
      error: 'No available tables',
      message: 'Sorry, we are not able to accommodate your requested time. Please try a different time or contact us directly.'
    });
  }

  // Create reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      name: member.name,
      phone: member.phone,
      email: member.email,
      party_size: reservationDetails.party_size,
      start_time: reservationDetails.start_time,
      end_time: reservationDetails.end_time,
      table_id,
      source: 'sms',
      event_type: 'reservation'
    })
    .single();

  if (reservationError) {
    return res.status(500).json({ error: 'Error creating reservation' });
  }

  // Send confirmation email
  const startTime = new Date(reservationDetails.start_time);
  const formattedDate = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const emailContent = `
    <h2>Reservation Confirmation</h2>
    <p>Dear ${member.name},</p>
    <p>Your reservation has been confirmed for:</p>
    <p><strong>Date:</strong> ${formattedDate}</p>
    <p><strong>Party Size:</strong> ${reservationDetails.party_size} guests</p>
    <p>We look forward to seeing you!</p>
  `;

  await sendCustomEmail({
    to: member.email,
    subject: 'Reservation Confirmation',
    html: emailContent
  });

  return res.status(200).json({
    message: 'Reservation confirmed',
    reservation
  });
} 