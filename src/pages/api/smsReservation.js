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

  // Flexible party size extraction
  let party_size = 2; // default
  const partySizeRegexes = [
    /for\s+(\d+)\b/i, // for 2
    /(\d+)\s*guests?/i, // 2 guests
    /(\d+)\s*people/i, // 2 people
    /party of (\d+)/i, // party of 2
    /for a party of (\d+)/i, // for a party of 2
    /for (\d+)/i, // for 2
  ];
  for (const re of partySizeRegexes) {
    const match = msg.match(re);
    if (match) {
      party_size = parseInt(match[1]);
      break;
    }
  }

  // Flexible date and time extraction
  // Try to find a date (MM/DD/YY, Month Day, this/next Friday, etc.)
  let dateStr = '';
  let dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                  msg.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i) ||
                  msg.match(/(this|next)\s+\w+/i);
  if (dateMatch) {
    dateStr = dateMatch[0];
  }

  // Try to find a time (at 6:30pm, 18:30, 6pm, 6:30 pm, etc.)
  let timeStr = '';
  let timeMatch = msg.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) ||
                  msg.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) ||
                  msg.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    timeStr = timeMatch[0].replace(/^(at|@)\s*/i, '');
  }

  // If date or time is missing, try to find them anywhere in the message
  if (!dateStr) {
    const anyDate = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (anyDate) dateStr = anyDate[0];
  }
  if (!timeStr) {
    const anyTime = msg.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) || msg.match(/(\d{1,2})\s*(am|pm)/i);
    if (anyTime) timeStr = anyTime[0];
  }

  // Parse date
  let date = null;
  if (dateStr) {
    date = parseNaturalDate(dateStr);
  }
  if (!date) {
    return null;
  }

  // Parse time
  let hour = 20, minute = 0; // default 8pm
  if (timeStr) {
    let timeParts = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeParts) {
      hour = parseInt(timeParts[1]);
      minute = timeParts[2] ? parseInt(timeParts[2]) : 0;
      const meridiem = timeParts[3];
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    }
  }
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

// AI-powered parsing using OpenAI GPT-4
async function parseReservationMessageWithAI(message) {
  try {
    const prompt = `
Parse this SMS reservation request and return JSON:
"${message}"

Return ONLY valid JSON with these fields:
{
  "party_size": number,
  "date": "MM/DD/YYYY", 
  "time": "HH:MM",
  "event_type": "string (optional)",
  "notes": "string (optional)"
}

If you can't parse it, return: {"error": "reason"}

Examples:
"RESERVATION 2 guests on 6/27/25 at 6:30pm" → {"party_size": 2, "date": "06/27/2025", "time": "18:30"}
"book me for 4 people tomorrow at 8pm" → {"party_size": 4, "date": "tomorrow", "time": "20:00"}
"reserve table for 6 on Friday 7pm" → {"party_size": 6, "date": "this Friday", "time": "19:00"}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return null;
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content.trim();
    
    // Try to parse the JSON response
    const parsed = JSON.parse(aiResponse);
    
    if (parsed.error) {
      console.log('AI parsing error:', parsed.error);
      return null;
    }

    // Convert AI response to our expected format
    let date = null;
    if (parsed.date) {
      // Handle relative dates like "tomorrow", "this Friday"
      if (parsed.date === 'tomorrow') {
        date = new Date();
        date.setDate(date.getDate() + 1);
      } else if (parsed.date.startsWith('this ') || parsed.date.startsWith('next ')) {
        date = parseNaturalDate(parsed.date);
      } else {
        // Assume it's MM/DD/YYYY format
        const [month, day, year] = parsed.date.split('/');
        date = new Date(year, month - 1, day);
      }
    }

    if (!date) {
      console.log('Could not parse date from AI response');
      return null;
    }

    // Parse time
    let hour = 20, minute = 0; // default 8pm
    if (parsed.time) {
      const [h, m] = parsed.time.split(':');
      hour = parseInt(h);
      minute = parseInt(m);
    }

    date.setHours(hour, minute, 0, 0);
    const start_time = date.toISOString();
    const end_time = new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString();

    return {
      party_size: parsed.party_size || 2,
      start_time,
      end_time,
      event_type: parsed.event_type || 'Fun Night Out',
      notes: parsed.notes || 'AI-parsed reservation'
    };

  } catch (error) {
    console.error('Error in AI parsing:', error);
    return null;
  }
}

// Hybrid parsing function
async function parseReservationMessageHybrid(message) {
  console.log('Parsing message:', message);
  
  // Normalize message
  const msg = message.replace(/\s+/g, ' ').trim();

  // Try regex parsing first (fast and free)
  const regexResult = parseReservationMessage(msg);
  if (regexResult) {
    console.log('Regex parsing successful');
    return regexResult;
  }

  // Fall back to AI parsing
  console.log('Regex parsing failed, trying AI...');
  const aiResult = await parseReservationMessageWithAI(msg);
  if (aiResult) {
    console.log('AI parsing successful');
    return aiResult;
  }

  console.log('Both regex and AI parsing failed');
  return null;
}

// Helper to auto-assign smallest free table
async function assignTable(start_time, end_time, party_size) {
  const { data: tables } = await supabase
    .from('tables')
    .select('table_id, table_number, capacity')
    .gte('capacity', party_size)
    .order('capacity');
  // Map to id, number, capacity for frontend
  const mappedTables = (tables || []).map(t => ({
    id: t.table_id,
    number: t.table_number,
    capacity: parseInt(t.capacity, 10)
  }));
  for (const t of mappedTables) {
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

  const { phone, text } = req.body;

  if (!phone || !text) {
    console.log('Missing phone or text:', { phone, text });
    return res.status(400).json({ 
      error: 'Missing phone or text',
      message: 'Please provide phone number and SMS text'
    });
  }

  // Only process messages that start with "Reservation"
  if (!text.toLowerCase().startsWith('reservation')) {
    console.log('Message does not start with "Reservation", ignoring');
    return res.status(200).json({ message: 'Message ignored - does not start with Reservation' });
  }

  // Check if sender is a member FIRST
  const digits = phone.replace(/\D/g, '');
  const possiblePhones = [
    digits,                    // 8584129797
    '+1' + digits,            // +18584129797
    '1' + digits,             // 18584129797
    '+1' + digits.slice(-10), // +18584129797 (if it's already 11 digits)
    digits.slice(-10)         // 8584129797 (last 10 digits)
  ];
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .or(
      possiblePhones.map(p => `phone.eq.${p}`).join(',')
    )
    .single();
  const member = memberData;
  const isMember = !!member;
  if (!isMember) {
    console.log('Non-member attempted SMS reservation:', phone);
    return res.status(403).json({ 
      error: 'Members only',
      message: 'Thank you for your reservation request, however only Noir members are able to text reservations. You may make a reservation using our website at https://noir-crm-dashboard.vercel.app'
    });
  }

  // Parse the SMS text using our hybrid approach
  const parsedData = await parseReservationMessageHybrid(text);
  
  if (!parsedData) {
    console.log('Failed to parse SMS text:', text);
    return res.status(400).json({ 
      error: 'Could not parse reservation request',
      message: 'Please use format: RESERVATION for X guests on date at time'
    });
  }

  const { party_size, start_time, end_time, event_type, notes } = parsedData;

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
      member_id: member.member_id,
      start_time,
      end_time,
      party_size,
      table_id,
      name: `${member.first_name} ${member.last_name}`,
      phone,
      email: member.email,
      source: 'sms',
      event_type,
      notes: notes || 'SMS reservation'
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
    message: `Reservation confirmed for ${member.first_name} on ${new Date(start_time).toLocaleDateString()} at ${new Date(start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} for ${party_size} guests${reservation.tables?.number ? ` at Table ${reservation.tables.number}` : ''}.`
  });
}; 