import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Utility functions for handling dates and times
function toZone(date, timezone = 'America/Chicago') {
  const year = date.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleDateString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = date.toLocaleDateString('en-US', { timeZone: timezone, day: '2-digit' });
  const hours = date.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false });
  const minutes = date.toLocaleTimeString('en-US', { timeZone: timezone, minute: '2-digit' });
  const seconds = date.toLocaleTimeString('en-US', { timeZone: timezone, second: '2-digit' });
  
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

// Parse natural language date
function parseNaturalDate(dateStr) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateStr.toLowerCase() === 'today') return today;
  if (dateStr.toLowerCase() === 'tomorrow') return tomorrow;
  
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
  
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthDayMatch = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (monthDayMatch) {
    const [_, month, day] = monthDayMatch;
    const monthIndex = monthNames.indexOf(month.toLowerCase());
    if (monthIndex === -1) return null;
    
    const result = new Date(today.getFullYear(), monthIndex, parseInt(day));
    if (result < today) {
      result.setFullYear(result.getFullYear() + 1);
    }
    return result;
  }
  
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(fullYear, month - 1, day);
  }
  
  return null;
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

// Enhanced parsing for flexible SMS formats (regex only)
function parseReservationMessage(message) {
  console.log('Parsing message:', message);
  // Normalize message (remove extra spaces, make case-insensitive for keywords)
  const msg = message.replace(/\s+/g, ' ').trim();

  // Regex for reservation keyword (case-insensitive)
  const reservationKeyword = /\b(reservation|reserve|book|table)\b/i;
  if (!reservationKeyword.test(msg)) {
    console.log('No reservation keyword found');
    return null;
  }

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

// Hybrid parsing function
async function parseReservationMessageHybrid(message) {
  console.log('Parsing message:', message);
  
  // Normalize message
  const msg = message.replace(/\s+/g, ' ').trim();

  // Check for reservation keyword
  const reservationKeyword = /\b(reservation|reserve|book|table)\b/i;
  if (!reservationKeyword.test(msg)) {
    console.log('No reservation keyword found');
    return null;
  }

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

// Check member status
async function checkMemberStatus(phone) {
  try {
    console.log('Checking member status for phone:', phone);
    
    // Normalize the incoming phone number
    const digits = phone.replace(/\D/g, '');
    const possiblePhones = [
      digits,                    // 8584129797
      '+1' + digits,            // +18584129797
      '1' + digits,             // 18584129797
      '+1' + digits.slice(-10), // +18584129797 (if it's already 11 digits)
      digits.slice(-10)         // 8584129797 (last 10 digits)
    ];
    
    console.log('Phone number formats to check:', possiblePhones);
    
    // First, let's see what's actually in the members table for debugging
    const { data: allMembers, error: allMembersError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, phone, membership_status')
      .limit(10);
    
    if (allMembersError) {
      console.error('Error fetching all members:', allMembersError);
    } else {
      console.log('Sample members in database:', allMembers);
    }
    
    // Check phone field with multiple formats (removed phone2 since it no longer exists)
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .or(
        // Check phone field with all possible formats
        possiblePhones.map(p => `phone.eq.${p}`).join(',')
      )
      .single();
    
    console.log('Member lookup result:', { member, error });
    
    if (error || !member) {
      console.log('No member found for phone:', phone);
      return { isMember: false, member: null };
    }
    
    console.log('Member found:', { 
      id: member.member_id, 
      name: `${member.first_name} ${member.last_name}`,
      phone: member.phone,
      status: member.membership_status 
    });
    
    return { isMember: true, member };
  } catch (error) {
    console.error('Error checking member status:', error);
    return { isMember: false, member: null };
  }
}

// Check availability
async function checkAvailability(startTime, endTime, partySize) {
  try {
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', partySize);
    
    if (tablesError || !tables || tables.length === 0) {
      return { available: false, message: 'No tables available for this party size' };
    }
    
    const startOfDay = new Date(startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (resError) {
      return { available: false, message: 'Error checking availability' };
    }
    
    const slotStart = new Date(startTime);
    const slotEnd = new Date(endTime);
    const availableTable = tables
      .sort((a, b) => a.capacity - b.capacity)
      .find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        return !tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (slotStart < resEnd) && (slotEnd > resStart);
        });
      });
    
    if (!availableTable) {
      return { available: false, message: 'No available tables for this time and party size' };
    }
    
    return { available: true, table: availableTable };
  } catch (error) {
    console.error('Error checking availability:', error);
    return { available: false, message: 'Error checking availability' };
  }
}

// Create reservation
async function createReservation(member, startTime, endTime, partySize, tableId) {
  try {
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert([{
        start_time: startTime,
        end_time: endTime,
        party_size: partySize,
        table_id: tableId,
        phone: member.phone,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        membership_type: 'member',
        event_type: 'SMS Reservation',
        notes: 'Reservation made via SMS',
        source: 'sms'
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating reservation:', error);
      return { success: false, error: 'Failed to create reservation' };
    }
    
    return { success: true, reservation };
  } catch (error) {
    console.error('Error creating reservation:', error);
    return { success: false, error: 'Failed to create reservation' };
  }
}

// Send SMS
async function sendSMS(to, message) {
  try {
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [to],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: message
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send SMS:', errorText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

export async function handler(req, res) {
  console.log('Webhook received:', {
    method: req.method,
    body: req.body,
    headers: req.headers
  });

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'OpenPhone webhook is up' });
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, data } = req.body;
  console.log('Event data:', { type, data });

  if (type !== 'message.received') {
    console.log('Event type not handled:', type);
    return res.status(200).json({ message: 'Event type not handled' });
  }

  const { from, text } = {
    from: data?.object?.from || '',
    text: data?.object?.text || data?.object?.body || ''
  };
  console.log('Processing message:', { from, text });
  console.log('Raw webhook data:', JSON.stringify(data, null, 2));
  console.log('Phone number received from OpenPhone:', from);

  // More flexible message filtering - check for reservation keywords
  const reservationKeywords = /\b(reservation|reserve|book|table)\b/i;
  if (!reservationKeywords.test(text)) {
    console.log('Message does not contain reservation keywords, ignoring');
    return res.status(200).json({ message: 'Message ignored - no reservation keywords' });
  }

  try {
    const parsed = await parseReservationMessageHybrid(text);
    
    if (!parsed) {
      const errorMessage = `Thank you for your reservation request, however I'm having trouble understanding. Please visit our website to make a reservation: https://noir-crm-dashboard.vercel.app`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent error message to user with website redirect' });
    }
    
    const { isMember, member } = await checkMemberStatus(from);
    
    if (!isMember) {
      const errorMessage = `Thank you for your reservation request, however only Noir members are able to text reservations. You may make a reservation using our website at https://noir-crm-dashboard.vercel.app`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent non-member error message with website redirect' });
    }
    
    const availability = await checkAvailability(parsed.start_time, parsed.end_time, parsed.party_size);
    
    if (!availability.available) {
      const errorMessage = `Sorry, ${availability.message}. Please try a different time or contact us directly.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent availability error message' });
    }
    
    const reservationResult = await createReservation(
      member, 
      parsed.start_time, 
      parsed.end_time, 
      parsed.party_size, 
      availability.table.id
    );
    
    if (!reservationResult.success) {
      const errorMessage = `Sorry, we encountered an error creating your reservation. Please contact us directly.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent reservation creation error message' });
    }
    
    // Format date and time from the parsed start_time
    const reservationDate = new Date(parsed.start_time);
    const formattedDate = reservationDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = reservationDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const confirmationMessage = `Hi ${member.first_name}! Your reservation for ${parsed.party_size} guests on ${formattedDate} at ${formattedTime} is confirmed. See you then!`;
    
    await sendSMS(from, confirmationMessage);
    
    console.log('Reservation created successfully:', reservationResult.reservation);
    return res.status(200).json({ message: 'Reservation processed successfully' });
    
  } catch (error) {
    console.error('Error processing SMS reservation:', error);
    
    const errorMessage = `Sorry, we encountered an error processing your reservation request. Please contact us directly.`;
    await sendSMS(from, errorMessage);
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default handler; 