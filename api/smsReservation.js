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

module.exports = async (req, res) => {
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

  // Parse the message to extract reservation details using combined regex for "Reservation for X guests at TIME on DATE"
  // Normalize message and lower-case for matching
  const msg = messageText.toLowerCase();

  // Regex to match "reservation for X guests at TIME on DATE"
  const fullMatch = msg.match(/reservation\s+for\s+(\d+)\s+guests\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (!fullMatch) {
    return res.status(400).json({
      error: 'Invalid message format',
      message: 'Please use the format: Reservation for [number] guests at [time] on [MM/DD/YY]'
    });
  }

  const party_size = parseInt(fullMatch[1]);
  const timeStr = fullMatch[2].trim();
  let dateStr = fullMatch[3].trim();
  // Normalize two-digit year to four-digit
  const [month, day, yearPart] = dateStr.split('/');
  const fullYear = yearPart.length === 2 ? '20' + yearPart : yearPart;
  dateStr = `${month}/${day}/${fullYear}`;

  // Parse date using the existing helper
  const date = parseNaturalDate(dateStr);
  if (!date) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Please specify a valid date like 6/7/25'
    });
  }

  // Parse time (e.g., "10pm", "10:00 pm")
  let hours = 0, minutes = 0;
  const tMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tMatch) {
    hours = parseInt(tMatch[1]);
    minutes = tMatch[2] ? parseInt(tMatch[2]) : 0;
    const meridiem = tMatch[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  // Create start time in CST then convert to UTC
  const startDate = new Date(date);
  startDate.setHours(hours, minutes, 0, 0);
  
  // Convert to UTC while preserving the date
  const utcDate = new Date(startDate);
  // Add 5 hours to convert CST to UTC, but handle date rollover
  const utcHours = utcDate.getHours() + 5;
  if (utcHours >= 24) {
    utcDate.setDate(utcDate.getDate() + 1);
    utcDate.setHours(utcHours - 24);
  } else {
    utcDate.setHours(utcHours);
  }
  const start_time = utcDate.toISOString();

  // Set end time 90 or 120 minutes later
  const duration = party_size <= 2 ? 90 : 120;
  const endDate = new Date(startDate.getTime() + duration * 60000);
  const utcEndDate = new Date(endDate);
  // Add 5 hours to convert CST to UTC, but handle date rollover
  const utcEndHours = utcEndDate.getHours() + 5;
  if (utcEndHours >= 24) {
    utcEndDate.setDate(utcEndDate.getDate() + 1);
    utcEndDate.setHours(utcEndHours - 24);
  } else {
    utcEndDate.setHours(utcEndHours);
  }
  const end_time = utcEndDate.toISOString();

  const reservationDetails = {
    party_size,
    start_time,
    end_time,
    event_type: 'Fun Night Out',
    notes: 'Fun Night Out'
  };

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

  // Create the reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      member_id: member.member_id,
      start_time,
      end_time,
      party_size,
      table_id,
      name: `${member.first_name} ${member.last_name}`,
      phone: member.phone,
      email: member.email,
      source: 'sms',
      event_type: 'Fun Night Out',
      notes: member.status === 'active' ? '♥' : 'fun night out'
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
    reservation: reservation
  });
} 