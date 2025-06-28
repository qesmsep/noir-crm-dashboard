const { createClient } = require('@supabase/supabase-js');

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
  
  // Handle single day names (e.g., 'Sunday')
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayNameMatch = dateStr.toLowerCase().match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)$/i);
  if (dayNameMatch) {
    let targetDay = dayNames.findIndex(
      d => d.startsWith(dayNameMatch[1].toLowerCase())
    );
    if (targetDay === -1) return null;
    const result = new Date(today);
    const currentDay = today.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // always return next occurrence, not today
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }
  
  // Handle month names and ordinal dates (e.g., "June 7th")
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthDayMatch = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (monthDayMatch) {
    const [_, month, day] = monthDayMatch;
    const monthIndex = monthNames.indexOf(month.toLowerCase());
    if (monthIndex === -1) return null;
    
    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthsDiff = monthIndex - currentMonth;
    
    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }
    
    const result = new Date(year, monthIndex, parseInt(day));
    
    // Additional safety check: if the date is in the past, assume next year
    if (result < today) {
      result.setFullYear(result.getFullYear() + 1);
    }
    
    return result;
  }
  
  // Handle MM/DD format (without year)
  const dateMatchNoYear = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dateMatchNoYear) {
    const [_, month, day] = dateMatchNoYear;
    const monthIndex = parseInt(month) - 1;
    const dayNum = parseInt(day);
    
    // Smart year handling: assume current year unless date is more than 2 months away
    let year = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthsDiff = monthIndex - currentMonth;
    
    // If the requested month is more than 2 months away, assume next year
    if (monthsDiff > 2 || (monthsDiff < -10)) {
      year++;
    }
    
    const result = new Date(year, monthIndex, dayNum);
    
    // Additional safety check: if the date is in the past, assume next year
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
  // Try to find a date (MM/DD/YY, Month Day, this/next Friday, day names, etc.)
  let dateStr = '';
  let dateMatch = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                  msg.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i) ||
                  msg.match(/(this|next)\s+\w+/i) ||
                  msg.match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i) ||
                  msg.match(/(tomorrow|today)/i);
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
    const anyDate = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/) ||
                   msg.match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i) ||
                   msg.match(/(tomorrow|today)/i);
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
Parse this SMS reservation request and return ONLY valid JSON:
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

    // 2. Check for Private Events (private_events table)
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
    
    // 2. Private events
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
          message: `Thank you for your reservation request. Noir will be closed from ${from} to ${to} for a private event. If you'd like, please resubmit your reservation request for a time outside of this window. Thank you!`
        };
      }
    }

    // 3. Check for Exceptional Closures (venue_hours table)
    const { data: exceptionalClosure } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr)
      .maybeSingle();
    
    // 1. Custom closures
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

    // 4. Check Base Hours (venue_hours table)
    const { data: baseHoursData } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (!baseHoursData || baseHoursData.length === 0) {
      console.log('No base hours found for day of week:', dayOfWeek);
      
      // 3. Outside base hours - Build base hours descriptor for all days
      const allBaseHours = await supabase
        .from('venue_hours')
        .select('day_of_week, time_ranges')
        .eq('type', 'base');
      
      if (allBaseHours.data && allBaseHours.data.length > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = [];
        
        // Group by day and format
        for (let i = 0; i < 7; i++) {
          const dayHours = allBaseHours.data.filter(h => h.day_of_week === i);
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
          message: `Thank you for your reservation request. Noir is currently available for reservations on ${baseHoursDescriptor}. Please resubmit your reservation within these windows. Thank you!`
        };
      }
      
      return { available: false, message: 'The venue is not open on this day of the week' };
    }

    // 5. Check if the requested time falls within venue hours
    const requestedHour = date.getHours();
    const requestedMinute = date.getMinutes();
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
      
      // 3. Outside base hours
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
        message: `Thank you for your reservation request. Noir is currently available for reservations on ${baseHoursDescriptor}. Please resubmit your reservation within these windows. Thank you!`
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
      return { available: false, message: 'Error checking availability' };
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

export default async function handler(req, res) {
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
  const availabilityResult = await checkComprehensiveAvailability(start_time, end_time, party_size);

  if (!availabilityResult.available) {
    console.log('Availability check failed:', availabilityResult.message);
    // Send SMS to user with the closure message if this is a closure
    if (availabilityResult.message && availabilityResult.message !== 'No available tables' && phone) {
      try {
        await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`
          },
          body: JSON.stringify({
            from: process.env.OPENPHONE_PHONE_NUMBER_ID,
            to: phone,
            text: availabilityResult.message
          })
        });
      } catch (err) {
        console.error('Failed to send closure SMS:', err);
      }
    }
    return res.status(409).json({ 
      error: 'No available tables',
      message: availabilityResult.message
    });
  }

  console.log('Assigned table:', availabilityResult.table.id);

  // Create the reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      member_id: member.member_id,
      start_time,
      end_time,
      party_size,
      table_id: availabilityResult.table.id,
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

  // Send confirmation SMS
  const startTime = new Date(reservation.start_time);
  const formattedDate = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        to: phone,
        text: `Hi ${member.first_name}, your reservation at Noir has been confirmed for ${party_size} guests on ${formattedDate}`
      })
    });
  } catch (err) {
    console.error('Failed to send confirmation SMS:', err);
  }

  return res.status(201).json({
    success: true,
    reservation,
    message: `Reservation confirmed for ${member.first_name} on ${formattedDate} for ${party_size} guests${reservation.tables?.number ? ` at Table ${reservation.tables.number}` : ''}.`
  });
} 