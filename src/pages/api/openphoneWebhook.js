import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

// AI-powered parsing using OpenAI GPT-4
async function parseReservationMessageWithAI(message) {
  try {
    // Convert message to all lowercase before sending to AI
    const lowerMessage = message.toLowerCase();
    const prompt = `
Parse this SMS reservation request and return ONLY valid JSON:
"${lowerMessage}"

Return ONLY valid JSON with these fields:
{
  "party_size": number,
  "date": "MM/DD/YYYY", 
  "time": "HH:MM",
  "event_type": "string (optional)",
  "notes": "string (optional)"
}

If you can't parse it, return: {"error": "reason"}

IMPORTANT: Use year 2025 for all dates unless explicitly specified otherwise.

Recognize and correctly parse relative date terms such as "tonight", "today", "tomorrow", "this thursday", "next friday", etc. Convert them to the correct MM/DD/YYYY date for the year 2025 unless otherwise specified.

Examples:
"reservation 2 guests on 6/27/25 at 6:30pm" → {"party_size": 2, "date": "06/27/2025", "time": "18:30"}
"book me for 4 people tomorrow at 8pm" → {"party_size": 4, "date": "tomorrow", "time": "20:00"}
"reserve table for 6 on friday 7pm" → {"party_size": 6, "date": "this friday", "time": "19:00"}
"reservation 8 people on july 4 at 6pm" → {"party_size": 8, "date": "07/04/2025", "time": "18:00"}
"reservation for 2 tonight at 7pm" → {"party_size": 2, "date": "tonight", "time": "19:00"}
"reservation for 2 today at 7pm" → {"party_size": 2, "date": "today", "time": "19:00"}

IMPORTANT: Return ONLY the JSON object, no additional text or formatting.
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
    
    console.log('Raw AI response:', aiResponse);
    
    // Try to extract JSON from the response (in case AI added extra text)
    let jsonStart = aiResponse.indexOf('{');
    let jsonEnd = aiResponse.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('No JSON found in AI response');
      return null;
    }
    
    const jsonString = aiResponse.substring(jsonStart, jsonEnd + 1);
    console.log('Extracted JSON string:', jsonString);
    
    // Try to parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse:', jsonString);
      return null;
    }
    
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
        // Handle MM/DD/YYYY format or MM/DD format
        const dateParts = parsed.date.split('/');
        if (dateParts.length === 2) {
          // MM/DD format - use smart year handling
          date = parseNaturalDate(parsed.date);
        } else if (dateParts.length === 3) {
          // MM/DD/YYYY format
          const [month, day, year] = dateParts;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
    }

    if (!date || isNaN(date.getTime())) {
      console.log('Could not parse date from AI response or date is invalid');
      return null;
    }

    // Parse time
    let hour = 20, minute = 0; // default 8pm
    if (parsed.time) {
      const [h, m] = parsed.time.split(':');
      hour = parseInt(h);
      minute = parseInt(m);
      
      // Validate time values
      if (isNaN(hour) || hour < 0 || hour > 23) {
        console.log('Invalid hour in AI response:', hour);
        return null;
      }
      if (isNaN(minute) || minute < 0 || minute > 59) {
        console.log('Invalid minute in AI response:', minute);
        return null;
      }
    }

    date.setHours(hour, minute, 0, 0);
    
    // Final validation to ensure we have a valid date
    if (isNaN(date.getTime())) {
      console.log('Invalid date after setting time:', date);
      return null;
    }
    
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
  // Try to find a date (MM/DD/YY, MM/DD, Month Day, this/next Friday, etc.)
  let dateStr = '';
  let dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                  msg.match(/(\d{1,2}\/\d{1,2})/i) ||  // MM/DD format
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
    const anyDate = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/) || msg.match(/(\d{1,2}\/\d{1,2})/);
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
  if (!date || isNaN(date.getTime())) {
    console.log('Could not parse date or date is invalid:', dateStr);
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
  
  // Create the date in the business timezone, then convert to UTC for storage
  const businessDate = DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE);
  const reservationDateTime = businessDate.set({ hour, minute, second: 0, millisecond: 0 });
  const start_time = reservationDateTime.toUTC().toISO();
  const end_time = reservationDateTime.plus({ hours: 2 }).toUTC().toISO();

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

  // Try AI parsing first (more robust)
  const aiResult = await parseReservationMessageWithAI(msg);
  if (aiResult) {
    console.log('AI parsing successful');
    return aiResult;
  }

  // Fall back to regex parsing
  console.log('AI parsing failed, trying regex...');
  const regexResult = parseReservationMessage(msg);
  if (regexResult) {
    console.log('Regex parsing successful');
    return regexResult;
  }

  console.log('Both AI and regex parsing failed');
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

  try {
    console.log('Attempting to parse reservation message for member:', member.first_name);
    const parsed = await parseReservationMessageHybrid(text);
    
    if (!parsed) {
      console.log('Both regex and AI parsing failed for member:', member.first_name, 'Message:', text);
      const errorMessage = `Thank you for your reservation request, however I'm having trouble understanding. Please visit our website to make a reservation: https://noirkc.com`;
      await sendSMS(from, errorMessage);
      return res.status(200).json({ message: 'Sent error message to user with website redirect' });
    }
    
    console.log('Successfully parsed reservation for member:', member.first_name, 'Parsed data:', parsed);
    
    const availability = await checkComprehensiveAvailability(parsed.start_time, parsed.end_time, parsed.party_size);
    
    if (!availability.available) {
      await sendSMS(from, availability.message);
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
    
    // Format date and time from the parsed start_time using Luxon
    const reservationDate = DateTime.fromISO(parsed.start_time, { zone: 'utc' }).setZone(DEFAULT_TIMEZONE);
    const formattedDate = reservationDate.toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = reservationDate.toFormat('h:mm a'); // Always 12-hour format, local time
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