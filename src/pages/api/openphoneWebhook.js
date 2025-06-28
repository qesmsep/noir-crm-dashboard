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

// Parse SMS reservation message
function parseSMSReservation(message) {
  console.log('Parsing SMS reservation message:', message);
  
  if (!message.trim().toUpperCase().startsWith('RESERVATION')) {
    return null;
  }
  
  const partySizeMatch = message.match(/for\s+(\d+)\s+guests?/i);
  if (!partySizeMatch) {
    return { error: 'Could not parse party size. Please use format: RESERVATION for X guests on date at time' };
  }
  const partySize = parseInt(partySizeMatch[1]);
  
  const dateTimeMatch = message.match(/on\s+([^@\n]+?)(?:\s+at|\s+@|\s*$)/i) || 
                       message.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                       message.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
  const timeMatch = message.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  
  if (!dateTimeMatch || !timeMatch) {
    return { error: 'Could not parse date or time. Please use format: RESERVATION for X guests on date at time' };
  }
  
  let dateStr = dateTimeMatch[1].trim();
  const date = parseNaturalDate(dateStr);
  if (!date) {
    return { error: 'Could not parse date. Please use format: RESERVATION for X guests on date at time' };
  }
  
  let timeStr = timeMatch[1].trim().toLowerCase();
  let hour = 20, minute = 0;
  if (timeMatch) {
    let timeParts = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeParts) {
      hour = parseInt(timeParts[1]);
      minute = timeParts[2] ? parseInt(timeParts[2]) : 0;
      const meridiem = timeParts[3];
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
    } else if (/\d{2}:\d{2}/.test(timeStr)) {
      const [h, m] = timeStr.split(':');
      hour = parseInt(h);
      minute = parseInt(m);
    }
  }
  
  date.setHours(hour, minute, 0, 0);
  const startTime = date.toISOString();
  const endTime = new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString();
  
  return {
    partySize,
    startTime,
    endTime,
    parsedDate: date
  };
}

// Check member status
async function checkMemberStatus(phone) {
  try {
    const digits = phone.replace(/\D/g, '');
    const possiblePhones = [digits, '+1' + digits, '1' + digits];
    
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .in('phone', possiblePhones)
      .single();
    
    if (error || !member) {
      return { isMember: false, member: null };
    }
    
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

  if (!text.trim().toUpperCase().startsWith('RESERVATION')) {
    console.log('Message does not start with RESERVATION, ignoring');
    return res.status(200).json({ message: 'Message ignored - does not start with RESERVATION' });
  }

  try {
    const parsed = parseSMSReservation(text);
    
    if (parsed.error) {
      const errorMessage = `Thank you for your reservation request, however I'm having trouble understanding. Please confirm by texting me back:\n\nRESERVATION for [# of] guests on [date] at [time] and I can assist further.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent error message to user' });
    }
    
    const { isMember, member } = await checkMemberStatus(from);
    
    if (!isMember) {
      const errorMessage = `Thank you for your reservation request. However, I can only process reservations for active members. Please contact us directly to make a reservation.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent non-member error message' });
    }
    
    const availability = await checkAvailability(parsed.startTime, parsed.endTime, parsed.partySize);
    
    if (!availability.available) {
      const errorMessage = `Sorry, ${availability.message}. Please try a different time or contact us directly.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent availability error message' });
    }
    
    const reservationResult = await createReservation(
      member, 
      parsed.startTime, 
      parsed.endTime, 
      parsed.partySize, 
      availability.table.id
    );
    
    if (!reservationResult.success) {
      const errorMessage = `Sorry, we encountered an error creating your reservation. Please contact us directly.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent reservation creation error message' });
    }
    
    const formattedDate = parsed.parsedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = parsed.parsedDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const confirmationMessage = `Your reservation for ${parsed.partySize} guests on ${formattedDate} at ${formattedTime} is confirmed. See you then!`;
    
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