import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../pages/api/supabaseClient';
import { DateTime } from 'luxon';

const DEBUG = process.env.DEBUG_AVAILABLE_SLOTS === '1' || process.env.NEXT_PUBLIC_DEBUG_AVAILABLE_SLOTS === '1';
const DEBUG_SLOTS = process.env.DEBUG_SLOTS === '1';

// Helper: generate time slots based on venue hours
function generateTimeSlots(timeRanges: any[] = [{ start: '18:00', end: '23:00' }]) {
  const slots: string[] = [];
  
  for (const range of timeRanges) {
    const startHour = parseInt(range.start.split(':')[0]);
    const startMinute = parseInt(range.start.split(':')[1]);
    const endHour = parseInt(range.end.split(':')[0]);
    const endMinute = parseInt(range.end.split(':')[1]);
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
      const ampm = currentHour < 12 ? 'am' : 'pm';
      const min = currentMinute.toString().padStart(2, '0');
      slots.push(`${displayHour}:${min}${ampm}`);
      
      currentMinute += 15;
      if (currentMinute >= 60) {
        currentMinute = 0;
        currentHour++;
      }
    }
  }
  
  return slots;
}

export async function POST(request: Request) {
  try {
    const { date, party_size } = await request.json();
    if (!date || !party_size) {
      return NextResponse.json({ error: 'Missing date or party_size' }, { status: 400 });
    }
    
    if (DEBUG) console.log('🚨 AVAILABLE SLOTS API CALLED:', { date, party_size });
    if (DEBUG) console.log('🚨 Environment check - URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing');
    if (DEBUG) console.log('🚨 DEPLOYMENT TIMESTAMP:', new Date().toISOString());
    
    const supabase = getSupabaseClient();
    
    // date should already be in YYYY-MM-DD format from frontend
    const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().slice(0, 10);
    
    // 0. Check if date is within booking window
    const { data: settingsData } = await supabase
      .from('settings')
      .select('booking_start_date, booking_end_date')
      .single();
    
    if (settingsData) {
      const bookingStart = settingsData.booking_start_date ? new Date(settingsData.booking_start_date) : null;
      const bookingEnd = settingsData.booking_end_date ? new Date(settingsData.booking_end_date) : null;
      const reqDate = new Date(dateStr + 'T00:00:00');
      
      if ((bookingStart && reqDate < bookingStart) || (bookingEnd && reqDate > bookingEnd)) {
        if (DEBUG) console.log('Date outside booking window:', { dateStr, bookingStart, bookingEnd });
        return NextResponse.json({ slots: [] });
      }
    }
    
    // 1. Check if the venue is open on this date
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    
    if (DEBUG) console.log('Checking venue hours for:', { dateStr, dayOfWeek });
    
    // Check for exceptional closure
    const { data: exceptionalClosure } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr)
      .maybeSingle();
    
    if (DEBUG) console.log('Exceptional closure found:', exceptionalClosure);
    
    if (exceptionalClosure) {
      // If it's a full-day closure, return no slots
      if (exceptionalClosure.full_day || !exceptionalClosure.time_ranges) {
        if (DEBUG) console.log('Full day exceptional closure, returning no slots');
        return NextResponse.json({ slots: [] });
      }
    }
    
    // Check for private events that block this date
    if (DEBUG) console.log('🔍 QUERYING PRIVATE EVENTS FOR DATE (America/Chicago local day):', dateStr);
    // Compute the local day's UTC window for America/Chicago
    const startOfDayLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: 'America/Chicago' }).startOf('day');
    const endOfDayLocal = startOfDayLocal.endOf('day');
    const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    if (DEBUG) console.log('🔍 UTC WINDOW FOR LOCAL DAY:', { startOfDayUtc, endOfDayUtc });
    
    // Fetch events that overlap the local day (start < endOfDayUtc AND end > startOfDayUtc)
    const { data: privateEvents, error: privateEventsError } = await supabase
      .from('private_events')
      .select('start_time, end_time, full_day, title, status')
      .eq('status', 'active')
      .lt('start_time', endOfDayUtc)
      .gt('end_time', startOfDayUtc);
    
    if (DEBUG) console.log('🎉 PRIVATE EVENTS QUERY RESULT:', { privateEvents, error: privateEventsError });
    
    // Store debug info for API response (avoid referencing undefined variables)
    const debugInfo = {
      privateEventsQueryWindow: { startOfDayUtc, endOfDayUtc },
      privateEventsFound: privateEvents ? privateEvents.length : 0,
      privateEventsError: privateEventsError,
      privateEventsDetails: (privateEvents || []).map(ev => ({
        title: ev.title,
        start: ev.start_time,
        end: ev.end_time,
        full_day: ev.full_day,
        status: ev.status
      }))
    };
    
    if (privateEventsError) {
      console.error('🚨 PRIVATE EVENTS QUERY ERROR:', privateEventsError);
    }
    
    if (privateEvents && privateEvents.length > 0) {
      if (DEBUG) console.log('🎉 EVENTS FOUND - DETAILS:', debugInfo.privateEventsDetails);
    } else {
      if (DEBUG) console.log('❌ NO PRIVATE EVENTS FOUND FOR', dateStr);
    }
    
    if (privateEvents && privateEvents.length > 0) {
      // If there's a full-day private event, return no slots
      const fullDayEvent = privateEvents.find(ev => ev.full_day);
      if (fullDayEvent) {
        if (DEBUG) console.log('Full day private event, returning no slots');
        return NextResponse.json({ slots: [] });
      }
      
      // Store private events for later time slot filtering
      if (DEBUG) console.log('Partial day private events found, will filter time slots');
    }
    
    // Check if it's a base day or exceptional open
    const { data: baseHours } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    const { data: exceptionalOpen } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_open')
      .eq('date', dateStr)
      .maybeSingle();
    
    if (DEBUG) console.log('Base hours found:', baseHours);
    if (DEBUG) console.log('Exceptional open found:', exceptionalOpen);
    
    // If it's neither a base day nor an exceptional open, return no slots
    if ((!baseHours || baseHours.length === 0) && !exceptionalOpen) {
      if (DEBUG) console.log('No venue hours configured for this day, returning no slots');
      return NextResponse.json({ slots: [] });
    }
    
    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return NextResponse.json({ error: 'Error fetching tables' }, { status: 500 });
    }
    if (!tables || tables.length === 0) {
      if (DEBUG) console.log('No tables available for party size:', party_size);
      return NextResponse.json({ slots: [] });
    }
    
    if (DEBUG) console.log('Tables found:', tables);
    
    // Map to id, number, seats for frontend
    const mappedTables = (tables || []).map(t => ({
      id: t.id,
      number: t.table_number,
      seats: parseInt(t.seats, 10)
    }));
    // 2. Get all reservations for that date
    const startOfDay = new Date(dateStr + 'T00:00:00');
    const endOfDay = new Date(dateStr + 'T23:59:59.999');
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }
    
    if (DEBUG) console.log('Reservations found:', reservations);
    
    // 3. Generate time slots based on venue hours
    let timeRanges = [{ start: '18:00', end: '23:00' }]; // default
    
    if (exceptionalOpen && exceptionalOpen.time_ranges) {
      // Handle both string and object formats for time_ranges
      if (typeof exceptionalOpen.time_ranges === 'string') {
        try {
          timeRanges = JSON.parse(exceptionalOpen.time_ranges);
        } catch (e) {
          console.error('Error parsing exceptional open time_ranges:', e);
          timeRanges = [{ start: '18:00', end: '23:00' }]; // fallback
        }
      } else {
        timeRanges = exceptionalOpen.time_ranges;
      }
    } else if (baseHours && baseHours.length > 0) {
      // Handle both string and object formats for base hours time_ranges
      const allRanges = baseHours.flatMap(h => {
        if (h.time_ranges) {
          if (typeof h.time_ranges === 'string') {
            try {
              return JSON.parse(h.time_ranges);
            } catch (e) {
              console.error('Error parsing base hours time_ranges:', e);
              return [];
            }
          } else {
            return h.time_ranges;
          }
        }
        return [];
      });
      timeRanges = allRanges;
    }
    
    if (DEBUG) console.log('Time ranges to use:', timeRanges);
    
    // Apply partial closures if they exist
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
    
    const slots = generateTimeSlots(timeRanges);
    if (DEBUG) console.log('Generated slots:', slots);
    
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    const availableSlots: string[] = [];
    for (const slot of slots) {
      // Build slot start/end in America/Chicago then convert to UTC for comparison
      const [time, ampm] = slot.split(/(am|pm)/);
      let [hour, minute] = time.split(':').map(Number);
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const slotLocal = DateTime.fromISO(`${dateStr}T${hourStr}:${minuteStr}:00`, { zone: 'America/Chicago' });
      const slotStart = slotLocal.toUTC().toJSDate();
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      
      // Check if this slot overlaps with any private event
      if (DEBUG_SLOTS) console.log(`🔍 CHECKING SLOT ${slot} (${slotStart.toISOString()} - ${slotEnd.toISOString()})`);
      
      const hasPrivateEventOverlap = privateEvents && privateEvents.some(ev => {
        if (DEBUG_SLOTS) console.log(`🔍 PROCESSING EVENT: "${ev.title}" | Status: ${ev.status} | Full Day: ${ev.full_day}`);
        if (DEBUG_SLOTS) console.log(`🔍 RAW EVENT TIMES: start="${ev.start_time}" end="${ev.end_time}"`);
        
        if (ev.full_day) {
          if (DEBUG_SLOTS) console.log(`📅 SLOT ${slot} BLOCKED BY FULL-DAY EVENT: ${ev.title}`);
          return true;
        }
        
        const evStart = new Date(ev.start_time);
        const evEnd = new Date(ev.end_time);
        
        if (DEBUG_SLOTS) console.log(`🔍 PARSED EVENT TIMES:`, {
          evStartISO: evStart.toISOString(),
          evEndISO: evEnd.toISOString(),
          evStartLocal: evStart.toLocaleString(),
          evEndLocal: evEnd.toLocaleString()
        });
        
        if (DEBUG_SLOTS) console.log(`🔍 SLOT TIMES:`, {
          slotStartISO: slotStart.toISOString(),
          slotEndISO: slotEnd.toISOString(),
          slotStartLocal: slotStart.toLocaleString(),
          slotEndLocal: slotEnd.toLocaleString()
        });
        
        // Check each condition separately for debugging
        const condition1 = slotStart < evEnd;
        const condition2 = slotEnd > evStart;
        const overlap = condition1 && condition2;
        
        if (DEBUG_SLOTS) console.log(`🔍 DETAILED OVERLAP CHECK FOR ${slot} vs "${ev.title}":`, {
          'slotStart < evEnd': `${slotStart.toISOString()} < ${evEnd.toISOString()} = ${condition1}`,
          'slotEnd > evStart': `${slotEnd.toISOString()} > ${evStart.toISOString()} = ${condition2}`,
          'FINAL OVERLAP': overlap,
          'Expected for 6pm-9:15pm event': 'Should be TRUE for slots 6:00pm-9:00pm'
        });
        
        return overlap;
      });
      
      if (hasPrivateEventOverlap) {
        if (DEBUG_SLOTS) console.log(`🚫 SLOT ${slot} BLOCKED BY PRIVATE EVENT`);
        continue; // Skip this slot
      } else {
        if (DEBUG_SLOTS) console.log(`✅ SLOT ${slot} AVAILABLE (no private event conflict)`);
      }
      
      // For each table, check if it's free for this slot
      const availableTable = mappedTables.find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        // Check for overlap
        return !tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (
            (slotStart < resEnd) && (slotEnd > resStart)
          );
        });
      });
      if (availableTable) {
        availableSlots.push(slot);
      }
    }
    
    if (DEBUG) console.log('✅ FINAL AVAILABLE SLOTS:', availableSlots);
    if (DEBUG) console.log('✅ TOTAL SLOTS RETURNED:', availableSlots.length);
    return NextResponse.json({ 
      slots: availableSlots,
      timestamp: new Date().toISOString(),
      debugMessage: 'NEW_CODE_DEPLOYED_SUCCESSFULLY',
      totalSlots: availableSlots.length,
      requestedDate: date,
      debugInfo: debugInfo
    });
  } catch (error) {
    console.error('Error in available-slots API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 