const { createClient } = require('@supabase/supabase-js');
const { sendCustomEmail } = require('./sendCustomEmail');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Utility functions for handling dates and times in CST
function toCST(date) {
  // Convert UTC to CST (UTC-5 or UTC-6 depending on DST)
  const cstDate = new Date(date);
  const utcHours = cstDate.getUTCHours();
  const cstHours = utcHours - 5; // Default to UTC-5
  cstDate.setUTCHours(cstHours);
  return cstDate;
}

function toUTC(date) {
  // Convert CST to UTC (UTC+5 or UTC+6 depending on DST)
  const utcDate = new Date(date);
  const cstHours = utcDate.getHours();
  const utcHours = cstHours + 5; // Default to UTC+5
  
  // Create a new date to handle date changes
  const newDate = new Date(utcDate);
  newDate.setHours(utcHours);
  
  // If the hours wrapped around to the next day, adjust the date
  if (utcHours >= 24) {
    newDate.setDate(newDate.getDate() + 1);
    newDate.setHours(utcHours - 24);
  }
  
  return newDate;
}

// Parse natural language date
function parseNaturalDate(dateStr) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Handle "today" and "tomorrow"
  if (dateStr.toLowerCase() === 'today') return today;
  if (dateStr.toLowerCase() === 'tomorrow') return tomorrow;
  
  // Handle "this" and "next" with days of the week
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const thisNextMatch = dateStr.toLowerCase().match(/(this|next)\s+(\w+)/);
  if (thisNextMatch) {
    const [_, modifier, day] = thisNextMatch;
    const targetDay = daysOfWeek.indexOf(day.toLowerCase());
    if (targetDay === -1) return null;
    
    const result = new Date(today);
    const currentDay = today.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    if (modifier === 'next') {
      result.setDate(result.getDate() + daysToAdd + 7);
    } else {
      result.setDate(result.getDate() + daysToAdd);
    }
    return result;
  }
  
  // Handle month names and ordinal dates (e.g., "June 7th")
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthDayMatch = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (monthDayMatch) {
    const [_, month, day] = monthDayMatch;
    const monthIndex = monthNames.indexOf(month.toLowerCase());
    if (monthIndex === -1) return null;
    
    const result = new Date(today.getFullYear(), monthIndex, parseInt(day));
    // If the date is in the past, assume next year
    if (result < today) {
      result.setFullYear(result.getFullYear() + 1);
    }
    return result;
  }
  
  // Handle MM/DD/YY format
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(fullYear, month - 1, day);
  }
  
  return null;
}

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
  const partySizeMatch = msg.match(/(\d+)\s*guests?/);
  const party_size = partySizeMatch ? parseInt(partySizeMatch[1]) : 2;

  // Extract date and time - handle multiple formats
  const dateTimeMatch = msg.match(/(?:on|at|@)\s+([^@\n]+?)(?:\s+at|\s+@|\s*$)/i) || 
                       msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                       msg.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
  const timeMatch = msg.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (!dateTimeMatch || !timeMatch) {
    return res.status(400).json({ 
      error: 'Invalid date or time format',
      message: 'Please specify a date (e.g., "this friday", "June 7th", or "6/7/25") and time (e.g., at 8pm or @ 8pm)'
    });
  }

  // Parse date
  let dateStr = dateTimeMatch[1].trim();
  
  // If the date is in MM/DD/YY format, ensure it's properly formatted
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
    const [month, day, year] = dateStr.split('/');
    dateStr = `${month}/${day}/${year.length === 2 ? '20' + year : year}`;
  }
  
  // If the date is at the end of the message, try to extract it
  if (!dateStr || dateStr === '') {
    const endDateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})$/);
    if (endDateMatch) {
      dateStr = endDateMatch[1];
      const [month, day, year] = dateStr.split('/');
      dateStr = `${month}/${day}/${year.length === 2 ? '20' + year : year}`;
    }
  }
  
  // If we still don't have a date, try to find it anywhere in the message
  if (!dateStr || dateStr === '') {
    const anyDateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (anyDateMatch) {
      dateStr = anyDateMatch[1];
      const [month, day, year] = dateStr.split('/');
      dateStr = `${month}/${day}/${year.length === 2 ? '20' + year : year}`;
    }
  }
  
  const date = parseNaturalDate(dateStr);
  if (!date) {
    return res.status(400).json({ 
      error: 'Invalid date format',
      message: 'Please specify a valid date (e.g., "this friday", "June 7th", or "6/7/25")'
    });
  }

  // Extract time (support 8pm, 8:00pm, 20:00, 8 pm, etc.)
  let timeStr = timeMatch[1].trim().toLowerCase();
  let hour = 20, minute = 0; // default 8pm if not found
  if (timeMatch) {
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
  if (!date) {
    console.log('Could not parse date');
    return null;
  }

  // Set the time
  date.setHours(hour, minute, 0, 0);
  const start_time = date.toISOString();
  const end_time = new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString();

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

// Helper to auto-assign smallest free table
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
      console.log('Assigned table:', t.id, 'number:', t.number);
      return t.id;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  console.log('SMS reservation handler received request:', {
    method: req.method,
    body: req.body
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    phone, // Required: customer's phone number
    name, // Required: customer's name
    email, // Optional: customer's email
    party_size, // Required: number of guests
    start_time, // Required: ISO string of reservation start time
    end_time, // Required: ISO string of reservation end time
    event_type = 'Fun Night Out', // Optional: type of event
    notes = '', // Optional: additional notes
    source = 'sms' // Optional: source of reservation
  } = req.body;

  // Validate required fields
  if (!phone || !name || !party_size || !start_time || !end_time) {
    console.log('Missing required fields:', { phone, name, party_size, start_time, end_time });
    return res.status(400).json({ 
      error: 'Missing required fields',
      message: 'Please provide phone, name, party_size, start_time, and end_time'
    });
  }

  // Check if sender is a member
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .limit(1)
    .or(`phone.eq.${phone.replace(/\D/g, '')},phone.eq.${phone}`);

  if (memberError) {
    console.error('Error checking member status:', memberError);
    return res.status(500).json({ error: 'Error checking member status' });
  }

  const member = memberData?.[0];
  const isMember = !!member;

  // Check availability and assign table
  const table_id = await assignTable(start_time, end_time, party_size);

  if (!table_id) {
    console.log('No available tables found');
    return res.status(409).json({ 
      error: 'No available tables',
      message: 'Sorry, we are not able to accommodate your requested time. Please try a different time or contact us directly.'
    });
  }

  console.log('Assigned table:', table_id);

  // Create the reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      member_id: member?.member_id,
      start_time,
      end_time,
      party_size,
      table_id,
      name,
      phone,
      email,
      source,
      event_type,
      notes: isMember ? '♥' : notes || event_type
    })
    .select(`
      *,
      tables (
        number
      )
    `)
    .single();

  if (reservationError) {
    console.error('Error creating reservation:', reservationError);
    return res.status(500).json({ 
      error: reservationError.error || 'Error creating reservation',
      message: reservationError.message || 'Sorry, we could not create your reservation. Please try again or contact us directly.'
    });
  }

  console.log('Reservation created:', reservation);

  // Send confirmation email
  const startTime = new Date(reservation.start_time);
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
    <p><strong>Party Size:</strong> ${reservation.party_size} guests</p>
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

  // Send confirmation SMS
  const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`
    },
    body: JSON.stringify({
      from: process.env.OPENPHONE_PHONE_NUMBER_ID,
      to: phone,
      text: `Hi ${member.first_name}, your reservation at Noir has been confirmed for ${party_size} guests on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    })
  });

  return res.status(201).json({
    success: true,
    reservation,
    message: `Reservation confirmed for ${name} on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} for ${party_size} guests${reservation.tables?.number ? ` at Table ${reservation.tables.number}` : ''}.`
  });
}; 