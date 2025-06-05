import { createClient } from '@supabase/supabase-js';
import { sendCustomEmail } from './sendCustomEmail';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Enhanced parsing for flexible SMS formats
function parseReservationMessage(message) {
  console.log('Parsing message:', message);
  // Normalize message (remove extra spaces, make case-insensitive for keywords)
  const msg = message.replace(/\s+/g, ' ').trim();

  // Regex for reservation keyword (case-insensitive)
  const reservationKeyword = /\b(reservation|reserve)\b/i;
  if (!reservationKeyword.test(msg)) {
    console.log('No reservation keyword found');
    return null;
  }

  // Extract party size
  const partySizeMatch = msg.match(/(\d+)\s+guests?/i);
  const party_size = partySizeMatch ? parseInt(partySizeMatch[1]) : null;

  // Extract date (support MM/DD/YY, MM-DD-YYYY, YYYY-MM-DD, MM/DD, etc.)
  let dateMatch = msg.match(/(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})/);
  let dateStr = dateMatch ? dateMatch[1] : null;
  let dateObj = null;
  if (dateStr) {
    // Try to parse various formats
    if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      // YYYY-MM-DD
      dateObj = new Date(dateStr);
    } else if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(dateStr)) {
      // MM/DD/YY or MM-DD-YYYY
      const parts = dateStr.split(/[\/\-]/);
      let month = parseInt(parts[0]) - 1;
      let day = parseInt(parts[1]);
      let year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      dateObj = new Date(year, month, day);
    }
  }

  // Extract time (support 8pm, 8:00pm, 20:00, 8 pm, etc.)
  let timeMatch = msg.match(/@\s*([\d:apm\s]+)/i);
  let hour = 20, minute = 0; // default 8pm if not found
  if (timeMatch) {
    let timeStr = timeMatch[1].trim().toLowerCase();
    let timeParts = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeParts) {
      hour = parseInt(timeParts[1]);
      minute = timeParts[2] ? parseInt(timeParts[2]) : 0;
      const meridiem = timeParts[3];
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    } else if (/\d{2}:\d{2}/.test(timeStr)) {
      // 24-hour format
      const [h, m] = timeStr.split(':');
      hour = parseInt(h);
      minute = parseInt(m);
    }
  }

  // If date is missing, fail
  if (!dateObj || isNaN(dateObj.getTime())) {
    console.log('Could not parse date');
    return null;
  }

  // Set the time
  dateObj.setHours(hour, minute, 0, 0);
  const start_time = dateObj.toISOString();
  const end_time = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000).toISOString();

  // Extract TYPE (event_type)
  let eventTypeMatch = msg.match(/type\s+(\w+)/i);
  let event_type = eventTypeMatch ? eventTypeMatch[1] : 'Fun Night Out';

  // Extract NOTES
  let notesMatch = msg.match(/notes?\s+"([^"]+)"/i) || msg.match(/notes?\s+([\w\s]+)/i);
  let notes = notesMatch ? notesMatch[1].trim() : event_type;
  if (!notes) notes = 'Fun Night Out';

  // Fallbacks
  if (!party_size) {
    console.log('Could not parse party size');
    return null;
  }

  return {
    party_size,
    start_time,
    end_time,
    event_type,
    notes
  };
}

// Helper to auto-assign smallest free table (copied from reservations.js)
async function assignTable(start_time, end_time, party_size) {
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  for (const t of tables) {
    // Skip tables without a number
    if (!t.number) {
      console.log('Skipping table with missing number:', t);
      continue;
    }
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
    if (!hasEventConflict && !hasReservationConflict) {
      // Log the table details
      console.log('Assigned table:', t.id, 'number:', t.number);
      return t.id;
    }
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

  // Format reservation data like the Reserve on the Spot modal
  const reservationData = {
    name: `${member.first_name} ${member.last_name}`,
    phone: member.phone,
    email: member.email,
    party_size: reservationDetails.party_size,
    notes: reservationDetails.notes,
    start_time: reservationDetails.start_time,
    end_time: reservationDetails.end_time,
    source: 'sms',  // Keep source as 'sms' for accurate tracking
    event_type: reservationDetails.event_type
  };

  // Use the same endpoint as the Reserve on the Spot modal
  const res = await fetch('https://noir-crm-dashboard.vercel.app/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservationData)
  });

  const result = await res.json();
  if (!res.ok) {
    console.error('Error creating reservation:', result);
    return res.status(res.status).json({ 
      error: result.error || 'Error creating reservation',
      message: result.message || 'Sorry, we could not create your reservation. Please try again or contact us directly.'
    });
  }

  console.log('Reservation created:', result);

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
    <p>Dear ${member.first_name} ${member.last_name},</p>
    <p>Your reservation has been confirmed for:</p>
    <p><strong>Date:</strong> ${formattedDate}</p>
    <p><strong>Party Size:</strong> ${reservationDetails.party_size} guests</p>
    <p>We look forward to seeing you!</p>
  `;

  try {
    await sendCustomEmail({
      to: member.email,
      subject: 'Reservation Confirmation',
      text: emailContent
    });
    console.log('Confirmation email sent to:', member.email);
  } catch (emailError) {
    console.error('Error sending confirmation email:', emailError);
  }

  // Send confirmation text message
  const textMessage = `Your reservation for ${formattedDate} with ${reservationDetails.party_size} guests has been confirmed. We look forward to seeing you!`;
  try {
    await fetch('https://noir-crm-dashboard.vercel.app/api/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: member.phone, message: textMessage })
    });
    console.log('Confirmation text message sent to:', member.phone);
  } catch (textError) {
    console.error('Error sending confirmation text message:', textError);
  }

  return res.status(200).json({
    message: 'Reservation confirmed',
    reservation: result
  });
} 