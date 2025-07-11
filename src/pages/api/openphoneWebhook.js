import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Conversation state helpers
async function getConversation(phone) {
  const { data, error } = await supabase
    .from('sms_conversations')
    .select('phone, step, data, suggestion')
    .eq('phone', phone)
    .single();
  return data || null;
}
async function saveConversation(phone, fields) {
  // UPSERT conversation row
  await supabase
    .from('sms_conversations')
    .upsert({ phone, ...fields }, { onConflict: ['phone'] });
}
async function clearConversation(phone) {
  await supabase
    .from('sms_conversations')
    .delete()
    .eq('phone', phone);
}

// Simple confirmation parser
async function parseConfirmation(message) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: `Does this message confirm the proposal? Respond with {"confirm": true} or {"confirm": false}. Message: "${message}"` }],
    temperature: 0.0
  });
  try { return JSON.parse(res.choices[0].message.content.trim()).confirm; }
  catch { return false; }
}

// Default timezone
const DEFAULT_TIMEZONE = 'America/Chicago';

// Utility functions for handling dates and times with Luxon
function toZone(date, timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.toJSDate();
}

// Parse natural language date using Luxon
function parseNaturalDate(dateStr) {
  const today = DateTime.now().setZone(DEFAULT_TIMEZONE);
  const tomorrow = today.plus({ days: 1 });
  
  const lowerDateStr = dateStr.toLowerCase().trim();
  
  // Handle "today"
  if (lowerDateStr === 'today') {
    return today.toJSDate();
  }
  
  // Handle "tomorrow"
  if (lowerDateStr === 'tomorrow') {
    return tomorrow.toJSDate();
  }
  
  // Handle "next [day]"
  const nextDayMatch = lowerDateStr.match(/^next\s+(\w+)$/);
  if (nextDayMatch) {
    const dayName = nextDayMatch[1];
    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      let nextDate = today;
      while (nextDate.weekday !== targetDay) {
        nextDate = nextDate.plus({ days: 1 });
      }
      return nextDate.toJSDate();
    }
  }
  
  // Handle "this [day]"
  const thisDayMatch = lowerDateStr.match(/^this\s+(\w+)$/);
  if (thisDayMatch) {
    const dayName = thisDayMatch[1];
    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      let thisDate = today;
      while (thisDate.weekday !== targetDay) {
        thisDate = thisDate.plus({ days: 1 });
      }
      return thisDate.toJSDate();
    }
  }
  
  // Handle month names and ordinal dates (e.g., "June 7th")
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthDayMatch = lowerDateStr.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (monthDayMatch) {
    const [_, month, day] = monthDayMatch;
    const monthIndex = monthNames.indexOf(month.toLowerCase());
    if (monthIndex === -1) return null;
    
    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.year;
    const currentMonth = today.month - 1;
    const monthsDiff = monthIndex - currentMonth;
    
    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }
    
    let result = DateTime.fromObject({ year, month: monthIndex + 1, day: parseInt(day) }, { zone: DEFAULT_TIMEZONE });
    
    // Additional safety check: if the date is in the past, assume next year
    if (result < today) {
      result = result.set({ year: result.year + 1 });
    }
    
    return result.toJSDate();
  }
  
  // Handle MM/DD format (without year)
  const dateMatchNoYear = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dateMatchNoYear) {
    const [_, month, day] = dateMatchNoYear;
    const monthIndex = parseInt(month) - 1;
    const dayNum = parseInt(day);
    
    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.year;
    const currentMonth = today.month - 1;
    const monthsDiff = monthIndex - currentMonth;
    
    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }
    
    let result = DateTime.fromObject({ year, month: monthIndex + 1, day: dayNum }, { zone: DEFAULT_TIMEZONE });
    
    // Additional safety check: if the date is in the past, assume next year
    if (result < today) {
      result = result.set({ year: result.year + 1 });
    }
    
    return result.toJSDate();
  }
  
  // Handle MM/DD/YY or MM/DD/YYYY format
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? '20' + year : year;
    return DateTime.fromObject({ 
      year: parseInt(fullYear), 
      month: parseInt(month), 
      day: parseInt(day) 
    }, { zone: DEFAULT_TIMEZONE }).toJSDate();
  }
  
  return null;
}

// GPT-driven natural language parser
async function parseReservationWithGPT(message) {
  const prompt = `
You are an incredibly personable, friendly, professional and helpful hospitality reservation assistant for Noir KC, Kansas City's most luxurious cocktail lounge and speakasy. 
Your job is to provide reservation data and confirmation to the user. 
IF their requested time is not available, you should provide the next closest available time as close as possible to their requested time of day.
All times are in America/Chicago (UTC–05:00).
Interpret relative dates such as "today", "tomorrow", "this Thursday", and "next Friday" relative to the current date in America/Chicago.
Parse the user's SMS into JSON with exactly these keys:
{
  "party_size": number,
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "event_type": string,        // optional
  "notes": string              // optional
}
Return only the JSON object. If you cannot parse, return {"error":"reason"}.

User message: """${message}"""
`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
  });
  const text = res.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('GPT parsing error', e, text);
    return null;
  }
}

// Helper to get next occurrence of a weekday in 2025
function getNextWeekdayIn2025(weekday, fromDate, isNext) {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = weekdays.indexOf(weekday.toLowerCase());
  if (targetDay === -1) return null;
  let date = new Date(2025, fromDate.getMonth(), fromDate.getDate());
  let day = date.getDay();
  let diff = targetDay - day;
  if (diff < 0 || (diff === 0 && isNext)) diff += 7;
  if (isNext && diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
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
      .select('member_id, first_name, last_name, phone')
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
    });
    
    return { isMember: true, member };
  } catch (error) {
    console.error('Error checking member status:', error);
    return { isMember: false, member: null };
  }
}

// Comprehensive availability checking
async function checkComprehensiveAvailability(startTime, endTime, partySize) {
  try {
    const date = new Date(startTime);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    console.log('Checking comprehensive availability for:', { dateStr, dayOfWeek, partySize, startTime, endTime });

    // 1. Check Booking Window (settings table)
    const { data: startSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'booking_start_date')
      .single();
    const { data: endSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'booking_end_date')
      .single();
    
    const bookingStart = startSetting?.value ? new Date(startSetting.value) : null;
    const bookingEnd = endSetting?.value ? new Date(endSetting.value) : null;
    const reqDate = new Date(dateStr);
    
    if ((bookingStart && reqDate < bookingStart) || (bookingEnd && reqDate > bookingEnd)) {
      console.log('Date outside booking window:', { reqDate, bookingStart, bookingEnd });
      return { available: false, message: 'Reservations are not available for this date' };
    }

    // 2. Check for Private Events FIRST (private_events table)
    const { data: privateEvents, error: privateEventsError } = await supabase
      .from('private_events')
      .select('start_time, end_time, full_day, title')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('end_time', `${dateStr}T23:59:59`)
      .eq('status', 'active');
    
    if (privateEventsError) {
      console.error('Error fetching private events:', privateEventsError);
    }
    
    console.log('Private events found for date:', dateStr, privateEvents);
    
    // Check for Private Events FIRST
    if (privateEvents && privateEvents.length > 0) {
      console.log('Private event found for date:', dateStr);
      
      // 3b. Full-day closure
      const fullDay = privateEvents.find(ev => ev.full_day);
      if (fullDay) {
        console.log('Full day private event detected:', fullDay);
        const date = new Date(fullDay.start_time)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return {
          available: false,
          message: `Thank you for your reservation request. Noir will be closed on ${date} for a private event.`
        };
      }

      // 3a. Partial-day conflict
      const conflict = privateEvents.find(ev => {
        const evStart = new Date(ev.start_time);
        const evEnd = new Date(ev.end_time);
        const conflicts = new Date(startTime) < evEnd && new Date(endTime) > evStart;
        console.log('Checking conflict:', {
          eventTitle: ev.title,
          eventStart: evStart.toISOString(),
          eventEnd: evEnd.toISOString(),
          requestedStart: new Date(startTime).toISOString(),
          requestedEnd: new Date(endTime).toISOString(),
          conflicts
        });
        return conflicts;
      });
      
      if (conflict) {
        console.log('Conflicting private event found:', conflict);
        const from = new Date(conflict.start_time)
          .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const to = new Date(conflict.end_time)
          .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return {
          available: false,
          message: `Thank you for your reservation request. Noir will be closed from ${from} to ${to} for a private event. If you'd like, please resubmit your reservation request for a time outside of this window. Thank you.`
        };
      }
    }

    // 3. Check for Exceptional Closures SECOND (venue_hours table)
    console.log('Checking for exceptional closure with dateStr:', dateStr);
    const { data: exceptionalClosure } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr)
      .maybeSingle();
    console.log('Exceptional closure query result:', exceptionalClosure);
    // Check for Special Closed Days SECOND
    if (exceptionalClosure) {
      console.log('Exceptional closure found for date:', dateStr);
      
      // Always send the custom SMS notification if it exists
      if (exceptionalClosure.sms_notification) {
        return { available: false, message: exceptionalClosure.sms_notification };
      }
      
      // If no custom message, check if it's a full-day closure
      if (exceptionalClosure.full_day || !exceptionalClosure.time_ranges) {
        return { available: false, message: 'The venue is closed on this date' };
      }
      
      // For partial-day closures without custom message, check if requested time conflicts
      if (exceptionalClosure.time_ranges) {
        const requestedHour = date.getHours();
        const requestedMinute = date.getMinutes();
        const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
        
        const isDuringClosure = exceptionalClosure.time_ranges.some(range => 
          requestedTime >= range.start && requestedTime <= range.end
        );
        
        if (isDuringClosure) {
          return { available: false, message: 'The venue is closed during this time' };
        }
      }
    }

    // 4. Check Base Hours THIRD (venue_hours table)
    const { data: baseHoursData, error: baseHoursError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (baseHoursError) {
      console.error('Error fetching base hours:', baseHoursError);
    }
    
    console.log('Base hours data for day', dayOfWeek, ':', baseHoursData);
    
    if (!baseHoursData || baseHoursData.length === 0) {
      console.log('No base hours found for day of week:', dayOfWeek);
      
      // Outside base hours - Build base hours descriptor for all days
      const { data: allBaseHours, error: allBaseHoursError } = await supabase
        .from('venue_hours')
        .select('day_of_week, time_ranges')
        .eq('type', 'base');
      
      if (allBaseHoursError) {
        console.error('Error fetching all base hours:', allBaseHoursError);
      }
      
      console.log('All base hours data:', allBaseHours);
      
      if (allBaseHours && allBaseHours.length > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = [];
        
        // Group by day and format
        for (let i = 0; i < 7; i++) {
          const dayHours = allBaseHours.filter(h => h.day_of_week === i);
          if (dayHours.length > 0) {
            const timeRanges = dayHours.flatMap(h => h.time_ranges || []);
            if (timeRanges.length > 0) {
              const formattedRanges = timeRanges.map(range => {
                const startTime = new Date(`2000-01-01T${range.start}:00`);
                const endTime = new Date(`2000-01-01T${range.end}:00`);
                
                const startStr = startTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                const endStr = endTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                return `${startStr} to ${endStr}`;
              });
              
              availableDays.push(`${dayNames[i]}s (${formattedRanges.join(' and ')})`);
            }
          }
        }
        
        const baseHoursDescriptor = availableDays.join(', ');
        
        return {
          available: false,
          message: `Thank you for your reservation request. Noir is currently available for reservations on ${baseHoursDescriptor}. Please resubmit your reservation within these windows. Thank you.`
        };
      }
      
      return { available: false, message: 'The venue is not open on this day of the week' };
    }

    // 5. Check if the requested time falls within venue hours
    // Convert UTC time to business timezone for comparison with venue hours
    const businessDateTime = DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE);
    const requestedHour = businessDateTime.hour;
    const requestedMinute = businessDateTime.minute;
    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
    
    let timeRanges = baseHoursData.flatMap(row => row.time_ranges || []);
    
    // Remove closed time ranges if partial closure
    if (exceptionalClosure && exceptionalClosure.time_ranges) {
      const closedRanges = exceptionalClosure.time_ranges;
      timeRanges = timeRanges.flatMap(range => {
        for (const closed of closedRanges) {
          if (closed.start <= range.end && closed.end >= range.start) {
            const before = closed.start > range.start ? [{ start: range.start, end: closed.start }] : [];
            const after = closed.end < range.end ? [{ start: closed.end, end: range.end }] : [];
            return [...before, ...after];
          }
        }
        return [range];
      });
    }

    // Check if requested time falls within any open time range
    const isWithinHours = timeRanges.some(range => 
      requestedTime >= range.start && requestedTime <= range.end
    );
    
    if (!isWithinHours) {
      console.log('Requested time outside venue hours:', { requestedTime, timeRanges });
      
      // Outside base hours
      // Build base hours descriptor
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];
      
      // Format the time ranges for display
      const formattedRanges = timeRanges.map(range => {
        const startTime = new Date(`2000-01-01T${range.start}:00`);
        const endTime = new Date(`2000-01-01T${range.end}:00`);
        
        const startStr = startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        const endStr = endTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return `${startStr} to ${endStr}`;
      });
      
      const baseHoursDescriptor = `${dayName}s (${formattedRanges.join(' and ')})`;
      
      return {
        available: false,
        message: `Thank you for your reservation request. Noir is currently available for reservations on ${baseHoursDescriptor}. Please resubmit your reservation within these windows. Thank you.`
      };
    }

    // 6. Check Table Availability (tables and reservations tables)
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', partySize);
    
    if (tablesError || !tables || tables.length === 0) {
      console.log('No tables available for party size:', partySize);
      return { available: false, message: 'No tables available for this party size' };
    }

    // Get all reservations and events for the date to check conflicts
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
      console.error('Error fetching reservations:', resError);
      return { available: false, message: 'Error checking availability' };
    }

    const { data: events, error: evError } = await supabase
      .from('events')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (evError) {
      console.error('Error fetching events:', evError);
      // If events table doesn't exist, just continue with empty events array
      // This is a common case since events table might not be created yet
      console.log('Events table not available, continuing with empty events array');
    }

    // Check for conflicting reservations and events
    const availableTable = tables
      .sort((a, b) => a.capacity - b.capacity)
      .find(table => {
        // Check for conflicting reservations
        const hasReservationConflict = (reservations || []).some(r => {
          if (r.table_id !== table.id) return false;
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (startTime < resEnd) && (endTime > resStart);
        });

        // Check for conflicting events
        const hasEventConflict = (events || []).some(e => {
          if (e.table_id !== table.id) return false;
          const evStart = new Date(e.start_time);
          const evEnd = new Date(e.end_time);
          return (startTime < evEnd) && (endTime > evStart);
        });

        return !hasReservationConflict && !hasEventConflict;
      });

    if (!availableTable) {
      console.log('No available tables for the requested time');
      return { available: false, message: 'No tables available for the requested time' };
    }

    console.log('Comprehensive availability check passed');
    return { available: true, table: availableTable };

  } catch (error) {
    console.error('Error in comprehensive availability check:', error);
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
  console.log('Message text received:', `"${text}"`);

  // Handle "MEMBER" messages for waitlist
  if (text.toLowerCase().trim() === 'member') {
    console.log('Processing MEMBER message for waitlist');
    const waitlistMessage = "Thank you for seeking information about becoming a Noir Member.\n\nTo learn more and request an invitation, please complete the following form. It takes about 30 seconds and we'll be in touch soon.\n\nhttps://skylineandco.typeform.com/noir-waitlist";
    await sendSMS(from, waitlistMessage);
    return res.status(200).json({ message: 'Sent waitlist invitation message' });
  }

  console.log('Message starts with "reservation"?', text.toLowerCase().startsWith('reservation'));

  // Only process messages that start with "Reservation"
  if (!text.toLowerCase().startsWith('reservation')) {
    console.log('Message does not start with "Reservation", ignoring');
    return res.status(200).json({ message: 'Message ignored - does not start with Reservation' });
  }

  // Check membership FIRST
  const { isMember, member } = await checkMemberStatus(from);
  if (!isMember) {
    const errorMessage = `Thank you for your reservation request, however only Noir members are able to text reservations. You may make a reservation using our website at https://noirkc.com`;
    await sendSMS(from, errorMessage);
    return res.status(200).json({ message: 'Sent non-member error message with website redirect' });
  }

  // --- Multi-turn conversation state logic ---
  // Load conversation state
  const conv = await getConversation(from);

  // Handle suggestion confirmation
  if (conv?.step === 'suggested') {
    const userConfirm = await parseConfirmation(text);
    if (userConfirm) {
      // User accepted suggestion: inject suggestion into parsed
      var parsed = conv.suggestion;
      await clearConversation(from);
    } else {
      // User rejected: reset to collecting
      await saveConversation(from, { step: 'collecting', data: {} });
      await sendSMS(from, "Okay, what date and time would you like instead?");
      return res.status(200).end();
    }
  }

  // If collecting info, prompt for next missing field
  if (conv?.step === 'collecting') {
    const collected = conv.data || {};
    // If missing party_size
    if (!collected.party_size) {
      await sendSMS(from, "How many guests?");
      await saveConversation(from, { step: 'collecting', data: collected });
      return res.status(200).end();
    }
    // If missing date or time
    if (!collected.date) {
      await sendSMS(from, "What date would you like?");
      await saveConversation(from, { step: 'collecting', data: collected });
      return res.status(200).end();
    }
    if (!collected.time) {
      await sendSMS(from, "What time would you like?");
      await saveConversation(from, { step: 'collecting', data: collected });
      return res.status(200).end();
    }
    // All present, continue to parse and booking logic
  }

  try {
    let parsed;
    if (typeof parsed === "undefined") {
      // Not coming from accepted suggestion, parse with GPT
      parsed = await parseReservationWithGPT(text);
    }

    if (!parsed) {
      const errorMessage = `Thank you for your reservation request, however I'm having trouble understanding. Please visit our website to make a reservation: https://noirkc.com`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent error message to user with website redirect' });
    }

    // Save collecting state if missing fields
    if (!parsed.party_size || !parsed.date || !parsed.time) {
      await saveConversation(from, {
        step: 'collecting',
        data: {
          ...(conv?.data || {}),
          ...parsed
        }
      });
      // Ask next missing field
      if (!parsed.party_size) {
        await sendSMS(from, "How many guests?");
        return res.status(200).end();
      }
      if (!parsed.date) {
        await sendSMS(from, "What date would you like?");
        return res.status(200).end();
      }
      if (!parsed.time) {
        await sendSMS(from, "What time would you like?");
        return res.status(200).end();
      }
      // If error, fallback
      await sendSMS(from, "Please provide all reservation details.");
      return res.status(200).end();
    }

    // Convert parsed local date/time (America/Chicago) to UTC ISO strings
    let date = null;
    if (parsed.date) {
      // Handle relative dates like "tonight", "today", "tomorrow", "this thursday", etc.
      const now = new Date();
      if (parsed.date === 'tonight' || parsed.date === 'today') {
        date = new Date(2025, now.getMonth(), now.getDate());
      } else if (parsed.date === 'tomorrow') {
        date = new Date(2025, now.getMonth(), now.getDate() + 1);
      } else if (/^this \w+$/i.test(parsed.date)) {
        // e.g., "this thursday"
        const weekday = parsed.date.split(' ')[1];
        date = getNextWeekdayIn2025(weekday, now, false);
      } else if (/^next \w+$/i.test(parsed.date)) {
        // e.g., "next friday"
        const weekday = parsed.date.split(' ')[1];
        date = getNextWeekdayIn2025(weekday, now, true);
      } else {
        // Handle MM/DD/YYYY or MM/DD format
        const dateParts = parsed.date.split('/');
        if (dateParts.length === 2) {
          // MM/DD format - use 2025 as year
          const [month, day] = dateParts;
          date = new Date(2025, parseInt(month) - 1, parseInt(day));
        } else if (dateParts.length === 3) {
          // MM/DD/YYYY format
          const [month, day, year] = dateParts;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
    }

    const localDt = DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE);
    const start_time = localDt.toUTC().toISO();
    const end_time = localDt.plus({ hours: 2 }).toUTC().toISO();

    const availability = await checkComprehensiveAvailability(start_time, end_time, parsed.party_size);

    // If unavailable but suggestion exists, prompt and store suggestion
    let suggestedSlot = null;
    // For this example, assume checkComprehensiveAvailability could return {available: false, message, suggestion}
    if (!availability.available && availability.suggestion) {
      suggestedSlot = availability.suggestion;
    }
    if (!availability.available && suggestedSlot) {
      await saveConversation(from, { step: 'suggested', data: parsed, suggestion: suggestedSlot });
      await sendSMS(from, `Sorry, ${availability.message} Would ${suggestedSlot.date} at ${suggestedSlot.time} work?`);
      return res.status(200).end();
    }
    if (!availability.available) {
      await sendSMS(from, availability.message);
      return res.status(200).json({ message: 'Sent availability error message' });
    }

    const reservationResult = await createReservation(
      member,
      start_time,
      end_time,
      parsed.party_size,
      availability.table.id
    );

    if (!reservationResult.success) {
      const errorMessage = `Sorry, we encountered an error creating your reservation. Please contact us directly.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent reservation creation error message' });
    }

    // Format date and time from the parsed start_time using Luxon
    const reservationDate = DateTime.fromISO(start_time, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE);
    const formattedDate = reservationDate.toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = reservationDate.toFormat('h:mm a'); // Always 12-hour format, local time
    const confirmationMessage = `Hi ${member.first_name}! Your reservation for ${parsed.party_size} guests on ${formattedDate} at ${formattedTime} is confirmed. See you then!`;

    await clearConversation(from);
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