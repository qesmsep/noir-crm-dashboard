import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Conversation state helpers
async function getConversation(phone) {
  try {
    console.log('Getting conversation for phone:', phone);
    const { data, error } = await supabase
      .from('sms_conversations')
      .select('phone, step, data, suggestion')
      .eq('phone', phone)
      .single();
    
    if (error) {
      console.log('Error getting conversation:', error);
      return null;
    }
    
    console.log('Retrieved conversation:', data);
    return data || null;
  } catch (error) {
    console.error('Exception getting conversation:', error);
    return null;
  }
}

async function saveConversation(phone, fields) {
  try {
    console.log('Saving conversation for phone:', phone, 'fields:', fields);
    // UPSERT conversation row
    const { error } = await supabase
      .from('sms_conversations')
      .upsert({ phone, ...fields }, { onConflict: ['phone'] });
    
    if (error) {
      console.error('Error saving conversation:', error);
    } else {
      console.log('Conversation saved successfully');
    }
  } catch (error) {
    console.error('Exception saving conversation:', error);
  }
}

async function clearConversation(phone) {
  try {
    console.log('Clearing conversation for phone:', phone);
    const { error } = await supabase
      .from('sms_conversations')
      .delete()
      .eq('phone', phone);
    
    if (error) {
      console.error('Error clearing conversation:', error);
    } else {
      console.log('Conversation cleared successfully');
    }
  } catch (error) {
    console.error('Exception clearing conversation:', error);
  }
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

  // Handle "tonight" as equivalent to today
  if (lowerDateStr === 'tonight') {
    return today.toJSDate();
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
  console.log('=== GPT PARSING START ===');
  console.log('Parsing message with GPT:', message);
  
  const prompt = `
You are an expert reservation assistant for Noir KC. Parse the user's SMS reservation requests and return ONLY a JSON object with these keys:
{
  "party_size": number,
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "event_type": string,  // optional
  "notes": string        // optional
}
Requirements:
- Interpret "+ n guest" or "+n guest" as base 1 + n (e.g., "Reservation +1 guest" → party_size: 2).
- Accept synonyms: "for 2", "2 guests", "2 people", "party of 2", "- 2 guests", "2 guests", "2 people".
- Handle dates in formats: MM/DD, M/D, MM/DD/YY, MM/DD/YYYY, Month Day (e.g., "July 4th"), Month Day Year, as well as relative dates ("today", "tomorrow", "this Friday", "next Monday"). Default missing year to 2025.
- Handle times in 12‑hour or 24‑hour formats, with or without colon, with or without "at" (e.g., "6pm", "6:30 pm", "19:00").
- Assume all times requested are PM. 
- Normalize output: date must be ISO (YYYY-MM-DD), time must be 24‑hour HH:MM.
- Interpret all times in America/Chicago.
- Handle mixed case and extra punctuation gracefully.
- If parsing fails, return {"error":"reason"}.
Examples:
- "RESERVATION for 7 GUESTS at 10:15PM on 07/24/25" → {"party_size":7,"date":"2025-07-24","time":"22:15"}
- "reservation for 7 guests at 10:15pm 7/24" → {"party_size":7,"date":"2025-07-24","time":"22:15"}
- "Reservation + 1 guest at 6:30 pm on 9/13" → {"party_size":2,"date":"2025-09-13","time":"18:30"}
- "Reservation +1 guest at 6:30 pm 9/13" → {"party_size":2,"date":"2025-09-13","time":"18:30"}
- "Reservation for 4 on tomorrow at 8pm" → {"party_size":4,"date":"<ISO tomorrow>","time":"20:00"}
- "Book me for 3 people 19:00 10/05/2025" → {"party_size":3,"date":"2025-10-05","time":"19:00"}
- "Reservation - 2 guests" → {"party_size":2,"date":"2025-01-20","time":"20:00"}
- "Reservation 2 guests" → {"party_size":2,"date":"2025-01-20","time":"20:00"}
- "Reservation 2 people" → {"party_size":2,"date":"2025-01-20","time":"20:00"}
User message: """${message}"""
`;
  
  console.log('=== GPT PROMPT SENT ===');
  console.log('Sending prompt to GPT...');
  
  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
  });
  
  const text = res.choices[0].message.content.trim();
  console.log('=== GPT RESPONSE RECEIVED ===');
  console.log('GPT raw response:', text);
  console.log('GPT response length:', text.length);
  
  try {
    const parsed = JSON.parse(text);
    console.log('=== GPT PARSING SUCCESS ===');
    console.log('Parsed result:', parsed);
    console.log('Has party_size?', !!parsed.party_size);
    console.log('Has date?', !!parsed.date);
    console.log('Has time?', !!parsed.time);
    return parsed;
  } catch (e) {
    console.log('=== GPT PARSING FAILED ===');
    console.error('GPT parsing error', e);
    console.error('Failed to parse GPT response:', text);
    return null;
  }
}

// Enhanced regex fallback parser for when GPT fails
function parseReservationWithRegex(message) {
  console.log('=== REGEX FALLBACK START ===');
  console.log('Parsing message with regex fallback:', message);
  
  const msg = message.toLowerCase().trim();
  console.log('Normalized message:', msg);
  
  // Enhanced party size extraction patterns
  const partySizePatterns = [
    /for\s+(\d+)\b/i,           // for 2
    /(\d+)\s*guests?/i,         // 2 guests
    /(\d+)\s*people/i,          // 2 people
    /party of (\d+)/i,          // party of 2
    /for a party of (\d+)/i,    // for a party of 2
    /for (\d+)/i,               // for 2
    /- (\d+)\s*guests?/i,       // - 2 guests
    /(\d+)\s*guests?/i,         // 2 guests (standalone)
    /(\d+)\s*people/i,          // 2 people (standalone)
  ];
  
  console.log('=== TESTING PARTY SIZE PATTERNS ===');
  let party_size = null;
  for (let i = 0; i < partySizePatterns.length; i++) {
    const pattern = partySizePatterns[i];
    const match = msg.match(pattern);
    console.log(`Pattern ${i + 1}: ${pattern} - Match:`, match);
    if (match) {
      party_size = parseInt(match[1]);
      console.log('Found party size with pattern:', pattern, '=', party_size);
      break;
    }
  }
  
  // If no party size found, return null
  if (!party_size) {
    console.log('=== NO PARTY SIZE FOUND ===');
    console.log('No party size found in message');
    return null;
  }
  
  // Default to today and 8pm if no date/time specified
  const today = DateTime.now().setZone(DEFAULT_TIMEZONE);
  const defaultDate = today.toISODate();
  const defaultTime = '20:00';
  
  console.log('=== REGEX FALLBACK RESULT ===');
  console.log('Regex fallback result:', { party_size, date: defaultDate, time: defaultTime });
  
  return {
    party_size,
    date: defaultDate,
    time: defaultTime,
    event_type: 'SMS Reservation',
    notes: 'Reservation made via SMS'
  };
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
    // Convert UTC startTime back to CST to get the correct date and day of week
    const cstDateTime = DateTime.fromISO(startTime, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE);
    const dateStr = cstDateTime.toISODate();
    const dayOfWeek = cstDateTime.weekday % 7; // Luxon uses 1-7, JavaScript uses 0-6

    console.log('Checking comprehensive availability for:', { 
      dateStr, 
      dayOfWeek, 
      partySize, 
      startTime, 
      endTime,
      cstDateTime: cstDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')
    });

    // 1. Check Booking Window (settings table)
    const { data: settingsData } = await supabase
      .from('settings')
      .select('booking_start_date, booking_end_date')
      .single();
    
    const bookingStart = settingsData?.booking_start_date ? new Date(settingsData.booking_start_date) : null;
    const bookingEnd = settingsData?.booking_end_date ? new Date(settingsData.booking_end_date) : null;
    const reqDate = new Date(dateStr);
    
    if ((bookingStart && reqDate < bookingStart) || (bookingEnd && reqDate > bookingEnd)) {
      console.log('Date outside booking window:', { reqDate, bookingStart, bookingEnd });
      return { available: false, message: 'Reservations are not available for this date' };
    }

    // 2. Check for Private Events FIRST (private_events table)
    const { data: privateEvents, error: privateEventsError } = await supabase
      .from('private_events')
      .select('start_time, end_time, full_day, title')
      .eq('status', 'active')
      .or(`and(start_time.gte.${dateStr}T00:00:00Z,start_time.lte.${dateStr}T23:59:59Z),and(end_time.gte.${dateStr}T00:00:00Z,end_time.lte.${dateStr}T23:59:59Z),and(start_time.lte.${dateStr}T00:00:00Z,end_time.gte.${dateStr}T23:59:59Z)`);
    
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
        const requestedHour = cstDateTime.hour;
        const requestedMinute = cstDateTime.minute;
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
    console.log('=== VENUE HOURS TIMEZONE CHECK ===');
    console.log('Original startTime (UTC):', startTime);
    console.log('Original date object:', cstDateTime);
    
    // Use the UTC startTime that was already converted from local time
    const businessDateTime = DateTime.fromISO(startTime, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE);
    const requestedHour = businessDateTime.hour;
    const requestedMinute = businessDateTime.minute;
    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
    
    console.log('Business DateTime (CST):', businessDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    console.log('Requested time for venue hours check:', requestedTime);
    
    let timeRanges = baseHoursData.flatMap(row => row.time_ranges || []);
    console.log('Available time ranges:', timeRanges);
    
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
    
    console.log('Is within venue hours?', isWithinHours);
    console.log('Requested time:', requestedTime);
    console.log('Available ranges:', timeRanges);
    
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
    
    // Filter out tables 4, 8, and 12 (not available for reservations)
    const excludedTableNumbers = [4, 8, 12];
    const availableTables = (tables || []).filter((t) => {
      const tableNumber = parseInt(t.table_number || t.tableNumber || 0, 10);
      return !excludedTableNumbers.includes(tableNumber);
    });
    
    if (!availableTables || availableTables.length === 0) {
      console.log('No tables available after filtering (tables 4, 8, 12 excluded)');
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
    const availableTable = availableTables
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
      // Suggest next slot 30 minutes later as a fallback
      const fallback = DateTime.fromISO(startTime).plus({ minutes: 30 });
      const sugDate = fallback.setZone(DEFAULT_TIMEZONE).toISODate();
      const sugTime = fallback.toFormat('HH:mm');
      return {
        available: false,
        message: 'No tables available for the requested time',
        suggestion: { date: sugDate, time: sugTime }
      };
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
  console.log('=== OPENPHONE WEBHOOK RECEIVED ===');
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
  console.log('=== MESSAGE PROCESSING START ===');
  console.log('Processing message:', { from, text });
  console.log('Raw webhook data:', JSON.stringify(data, null, 2));
  console.log('Phone number received from OpenPhone:', from);
  console.log('Message text received:', `"${text}"`);
  console.log('Message length:', text.length);
  console.log('Message starts with "reservation"?', text.toLowerCase().startsWith('reservation'));
  console.log('Message lowercase:', text.toLowerCase());
  console.log('Message trimmed:', text.toLowerCase().trim());

  // Handle "MEMBER" and "MEMBERSHIP" messages for waitlist
  if (text.toLowerCase().trim() === 'member' || text.toLowerCase().trim() === 'membership') {
    console.log('Processing MEMBER/MEMBERSHIP message for waitlist');
    const waitlistMessage = "Thank you for seeking information about becoming a member of Noir.\n\nTo learn more please respond directly to this message with any questions.\n\nTo request an invitation, please complete the following form.\n\nWe typically respond within 24 hours. 🖤\n\nhttps://skylineandco.typeform.com/noir-waitlist";
    await sendSMS(from, waitlistMessage);
    return res.status(200).json({ message: 'Sent waitlist invitation message' });
  }

  // Handle "INVITATION" messages for membership signup
  if (text.toLowerCase().trim() === 'invitation') {
    console.log('Processing INVITATION message for membership signup');
    const invitationMessage = `Thank you for requesting an invitation to join Noir and we are excited to formally invite you to become a member of Noir.

To officially join, please complete the following:

https://skylineandco.typeform.com/noirkc-signup#auth_code=tw

The link expires in 24 hours, so please respond to this text with any questions.

Thank you.`;
    await sendSMS(from, invitationMessage);
    return res.status(200).json({ message: 'Sent invitation signup message' });
  }

  // Handle "BALANCE" messages for ledger PDF
  if (text.toLowerCase().trim() === 'balance') {
    console.log('Processing BALANCE message for ledger PDF');
    
    // Check if sender is a member
    const { isMember, member } = await checkMemberStatus(from);
    if (!isMember) {
      const errorMessage = `Thank you for your balance request, however only Noir members are able to request their ledger. You may contact us directly for assistance.`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent non-member error message for balance request' });
    }

    try {
      // Calculate previous billing month based on member's join date
      const today = new Date();
      const joinDate = new Date(member.join_date);
      
      // Calculate how many months have passed since join date
      const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                             (today.getMonth() - joinDate.getMonth());
      
      // Calculate the start and end of the PREVIOUS billing period (not current)
      const previousPeriodStart = new Date(joinDate);
      previousPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin - 1); // Subtract 1 month
      previousPeriodStart.setDate(joinDate.getDate());
      
      const previousPeriodEnd = new Date(joinDate);
      previousPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin);
      previousPeriodEnd.setDate(joinDate.getDate() - 1); // Day before current period
      
      const startDate = previousPeriodStart.toISOString().split('T')[0];
      const endDate = previousPeriodEnd.toISOString().split('T')[0];
      
      console.log('Calculated previous billing period:', { startDate, endDate, member: member.member_id });
      
      // Generate PDF using existing functionality
      const { LedgerPdfGenerator } = await import('../../utils/ledgerPdfGenerator');
      const pdfGenerator = new LedgerPdfGenerator();
      const pdfBuffer = await pdfGenerator.generateLedgerPdf(member.member_id, member.account_id, startDate, endDate);
      
      // Upload PDF to Supabase storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `balance_${member.member_id}_${startDate}_${endDate}_${timestamp}.pdf`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ledger-pdfs')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        throw new Error('Failed to upload PDF to storage');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ledger-pdfs')
        .getPublicUrl(fileName);

      // Send SMS with PDF link
      const message = `Hi ${member.first_name} - Here is your previous membership period statement for your Noir membership. Please let us know if you have any questions. Thank you! ${publicUrl}`;
      
      const smsResult = await sendSMS(from, message);
      
      console.log('Previous period PDF sent successfully:', {
        member: member.member_id,
        phone: from,
        pdfUrl: publicUrl,
        smsId: smsResult.id
      });
      
      return res.status(200).json({ 
        message: 'Previous period PDF sent successfully',
        member_id: member.member_id,
        pdf_url: publicUrl,
        sms_id: smsResult.id
      });
      
    } catch (error) {
      console.error('Error processing BALANCE request:', error);
      
      // Send error notification to admin
      const adminMessage = `Error processing BALANCE request from ${from}: ${error.message}`;
      await sendSMS('+19137774488', adminMessage);
      
      // Send user-friendly error message
      const userMessage = `Sorry, we encountered an error processing your balance request. Please try again later or contact us directly.`;
      await sendSMS(from, userMessage);
      
      return res.status(500).json({ 
        error: 'Failed to process balance request',
        details: error.message 
      });
    }
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
  console.log('=== CONVERSATION STATE ===');
  console.log('Conversation state for phone:', from);
  console.log('Conversation data:', conv);
  console.log('Conversation step:', conv?.step);
  console.log('Conversation data:', conv?.data);

  // Clear any existing conversation state for new reservation messages
  // This prevents getting stuck in collecting mode from previous incomplete messages
  if (conv && (conv.step === 'collecting' || conv.step === 'suggested')) {
    console.log('=== CLEARING EXISTING CONVERSATION STATE ===');
    console.log('Clearing conversation state to start fresh');
    await clearConversation(from);
  }

  // Simple fallback: if conversation state is causing issues, force fresh parsing
  // This bypasses all conversation logic and goes straight to parsing
  const forceFreshParsing = true; // Set to true to bypass conversation state issues
  if (forceFreshParsing) {
    console.log('=== FORCING FRESH PARSING (BYPASSING CONVERSATION STATE) ===');
    // Skip all conversation logic and go straight to parsing
  } else {
    // Handle suggestion confirmation
    if (conv?.step === 'suggested') {
      console.log('=== HANDLING SUGGESTION CONFIRMATION ===');
      const userConfirm = await parseConfirmation(text);
      console.log('User confirmation result:', userConfirm);
      if (userConfirm) {
        // User accepted suggestion: inject suggestion into parsed
        var parsed = conv.suggestion;
        console.log('User accepted suggestion, using:', parsed);
        await clearConversation(from);
      } else {
        // User rejected: reset to collecting
        console.log('User rejected suggestion, resetting to collecting');
        await saveConversation(from, { step: 'collecting', data: {} });
        await sendSMS(from, "Okay, what date and time would you like instead?");
        return res.status(200).end();
      }
    }

    // If collecting info, prompt for next missing field
    if (conv?.step === 'collecting') {
      console.log('=== HANDLING COLLECTING STATE ===');
      const collected = conv.data || {};
      console.log('Collected data so far:', collected);
      console.log('Missing party_size?', !collected.party_size);
      console.log('Missing date?', !collected.date);
      console.log('Missing time?', !collected.time);
      
      // If missing party_size
      if (!collected.party_size) {
        console.log('=== ASKING FOR PARTY SIZE ===');
        await sendSMS(from, "How many guests?");
        await saveConversation(from, { step: 'collecting', data: collected });
        return res.status(200).end();
      }
      // If missing date or time
      if (!collected.date) {
        console.log('=== ASKING FOR DATE ===');
        await sendSMS(from, "What date would you like?");
        await saveConversation(from, { step: 'collecting', data: collected });
        return res.status(200).end();
      }
      if (!collected.time) {
        console.log('=== ASKING FOR TIME ===');
        await sendSMS(from, "What time would you like?");
        await saveConversation(from, { step: 'collecting', data: collected });
        return res.status(200).end();
      }
      // All present, continue to parse and booking logic
      console.log('=== ALL FIELDS COLLECTED, CONTINUING ===');
    }
  }

  try {
    let parsed;
    if (typeof parsed === "undefined") {
      // Not coming from accepted suggestion, parse with GPT
      console.log('=== ATTEMPTING PARSING ===');
      console.log('Attempting GPT parsing for message:', text);
      parsed = await parseReservationWithGPT(text);
      console.log('GPT parsing result:', parsed);
      
      // If GPT parsing failed, try regex fallback
      if (!parsed) {
        console.log('GPT parsing failed, attempting regex fallback');
        parsed = parseReservationWithRegex(text);
        if (parsed) {
          console.log('Regex fallback parsing successful:', parsed);
        } else {
          console.log('Regex fallback also failed');
        }
      }
      
      // Fallback: manual relative date handling if GPT mis-parses
      if (parsed && parsed.date) {
        const lowerText = text.toLowerCase();
        const relMatch = lowerText.match(/(today|tonight|tomorrow|this\s+\w+|next\s+\w+)/);
        if (relMatch) {
          const key = relMatch[1];
          const jsDate = parseNaturalDate(key);
          if (jsDate) {
            // override parsed.date with correct ISO date
            parsed.date = DateTime.fromJSDate(jsDate, { zone: DEFAULT_TIMEZONE }).toISODate();
            console.log('Overrode parsed date with parseNaturalDate for', key, ':', parsed.date);
          }
        }
      }
    }

    console.log('=== FINAL PARSED RESULT ===');
    console.log('Final parsed result:', parsed);
    console.log('Has party_size?', !!parsed?.party_size);
    console.log('Has date?', !!parsed?.date);
    console.log('Has time?', !!parsed?.time);

    if (!parsed) {
      console.log('Both GPT and regex parsing failed for message:', text);
      const errorMessage = `Thank you for your reservation request, however I'm having trouble understanding. Please visit our website to make a reservation: https://noirkc.com`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent error message to user with website redirect' });
    }

    // Save collecting state if missing fields
    console.log('=== CHECKING FOR MISSING FIELDS ===');
    console.log('Checking parsed data for missing fields:', {
      party_size: parsed.party_size,
      date: parsed.date,
      time: parsed.time,
      has_party_size: !!parsed.party_size,
      has_date: !!parsed.date,
      has_time: !!parsed.time
    });
    
    if (!parsed.party_size || !parsed.date || !parsed.time) {
      console.log('=== MISSING FIELDS DETECTED ===');
      console.log('Missing fields detected, saving conversation state');
      console.log('Missing party_size?', !parsed.party_size);
      console.log('Missing date?', !parsed.date);
      console.log('Missing time?', !parsed.time);
      
      await saveConversation(from, {
        step: 'collecting',
        data: {
          ...(conv?.data || {}),
          ...parsed
        }
      });
      // Ask next missing field
      if (!parsed.party_size) {
        console.log('=== ASKING FOR PARTY SIZE (MISSING) ===');
        await sendSMS(from, "How many guests?");
        return res.status(200).end();
      }
      if (!parsed.date) {
        console.log('=== ASKING FOR DATE (MISSING) ===');
        await sendSMS(from, "What date would you like?");
        return res.status(200).end();
      }
      if (!parsed.time) {
        console.log('=== ASKING FOR TIME (MISSING) ===');
        await sendSMS(from, "What time would you like?");
        return res.status(200).end();
      }
      // If error, fallback
      console.log('=== ALL FIELDS MISSING, SENDING GENERIC MESSAGE ===');
      await sendSMS(from, "Please provide all reservation details.");
      return res.status(200).end();
    }

    // Convert parsed local date/time (America/Chicago) to UTC ISO strings
    console.log('=== TIMEZONE CONVERSION ===');
    console.log('Parsed date:', parsed.date);
    console.log('Parsed time:', parsed.time);
    console.log('Default timezone:', DEFAULT_TIMEZONE);
    
    const localDt = DateTime.fromISO(`${parsed.date}T${parsed.time}`, { zone: DEFAULT_TIMEZONE });
    console.log('Local DateTime object:', localDt.toISO());
    console.log('Local DateTime in CST:', localDt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    
    const start_time = localDt.toUTC().toISO();
    const end_time = localDt.plus({ hours: 2 }).toUTC().toISO();
    
    console.log('Start time (UTC):', start_time);
    console.log('End time (UTC):', end_time);
    console.log('Start time (CST):', DateTime.fromISO(start_time, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    console.log('End time (CST):', DateTime.fromISO(end_time, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
    
    console.log('Party size:', parsed.party_size);
    console.log('=== AVAILABILITY CHECK ===');
    const availability = await checkComprehensiveAvailability(start_time, end_time, parsed.party_size);
    console.log('=== AVAILABILITY RESULT ===');
    console.log('Availability result:', availability);

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

    // Send notification to 6199713730 for SMS reservation
    console.log('=== SENDING SMS RESERVATION NOTIFICATION TO 6199713730 ===');
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://noir-crm-dashboard.vercel.app';
      const notificationResponse = await fetch(`${siteUrl}/api/reservation-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservation_id: reservationResult.reservation.id,
          action: 'created'
        })
      });

      if (!notificationResponse.ok) {
        console.error('Failed to send SMS reservation notification to 6199713730:', await notificationResponse.text());
      } else {
        console.log('SMS reservation notification sent successfully to 6199713730');
      }
    } catch (error) {
      console.error('Error sending SMS reservation notification to 6199713730:', error);
      // Don't fail the SMS reservation if notification fails
    }

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