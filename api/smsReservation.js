import { createClient } from '@supabase/supabase-js';
import { sendCustomEmail } from './sendCustomEmail';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Parse SMS message to extract reservation details
function parseReservationMessage(message) {
  console.log('Parsing message:', message);
  const reservationRegex = /reservation\s+(\d+)\s+guests\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+@\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = message.match(reservationRegex);
  
  if (!match) {
    console.log('Message did not match reservation format');
    return null;
  }

  const [_, partySize, month, day, year, hour, minute, meridiem] = match;
  console.log('Parsed reservation details:', { partySize, month, day, year, hour, minute, meridiem });
  
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
  console.log('SMS reservation handler received request:', {
    method: req.method,
    body: req.body
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from, body, text } = req.body;
  const messageText = body || text;
  if (!from || !messageText) {
    console.log('Missing required fields:', { from, messageText });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Normalize phone number
  const normalizedPhone = from.replace(/\D/g, '');
  console.log('Normalized phone:', normalizedPhone);

  // Check if sender is a member
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .limit(1)
    .or(`phone.eq.${normalizedPhone},phone.eq.${from}`);

  if (memberError) {
    console.error('Error checking member status:', memberError);
    return res.status(500).json({ error: 'Error checking member status' });
  }

  if (!memberData || memberData.length === 0) {
    console.log('No member found for phone:', from);
    return res.status(403).json({ 
      error: 'Not a member',
      message: 'Sorry, this service is only available to members. Please contact us to become a member.'
    });
  }

  const member = memberData[0];
  console.log('Found member:', member);

  // Parse reservation details from message
  const reservationDetails = parseReservationMessage(messageText);
  if (!reservationDetails) {
    console.log('Invalid message format:', messageText);
    return res.status(400).json({ 
      error: 'Invalid message format',
      message: 'Please use the format: RESERVATION [number] guests [MM/DD/YY] @ [time]'
    });
  }

  console.log('Reservation details:', reservationDetails);

  // Check availability and assign table
  const table_id = await assignTable(
    reservationDetails.start_time,
    reservationDetails.end_time,
    reservationDetails.party_size
  );

  if (!table_id) {
    console.log('No available tables found');
    return res.status(409).json({ 
      error: 'No available tables',
      message: 'Sorry, we are not able to accommodate your requested time. Please try a different time or contact us directly.'
    });
  }

  console.log('Assigned table:', table_id);

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
    console.error('Error creating reservation:', reservationError);
    return res.status(500).json({ error: 'Error creating reservation' });
  }

  console.log('Reservation created:', reservation);

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

  try {
    await sendCustomEmail({
      to: member.email,
      subject: 'Reservation Confirmation',
      html: emailContent
    });
    console.log('Confirmation email sent to:', member.email);
  } catch (emailError) {
    console.error('Error sending confirmation email:', emailError);
  }

  return res.status(200).json({
    message: 'Reservation confirmed',
    reservation
  });
} 