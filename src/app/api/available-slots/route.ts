import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../pages/api/supabaseClient';
import { DateTime } from 'luxon';

// Enable debug by default to help diagnose issues
const DEBUG = process.env.DEBUG_AVAILABLE_SLOTS === '1' || process.env.NEXT_PUBLIC_DEBUG_AVAILABLE_SLOTS === '1' || true;
const DEBUG_SLOTS = process.env.DEBUG_SLOTS === '1' || true;

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
      console.warn(`⚠️ No venue hours configured for ${dateStr} (day of week: ${dayOfWeek}). This might indicate missing venue hours configuration.`);
      // Return helpful error message instead of empty slots
      return NextResponse.json({ 
        slots: [],
        error: 'Venue hours not configured for this day',
        debug: {
          dateStr,
          dayOfWeek,
          hasBaseHours: !!(baseHours && baseHours.length > 0),
          hasExceptionalOpen: !!exceptionalOpen,
          message: 'Please configure venue hours in the admin panel'
        }
      });
    }
    
    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return NextResponse.json({ 
        error: 'Error fetching tables',
        details: tablesError 
      }, { status: 500 });
    }
    
    // Filter out tables 4, 8, and 12 (not available for reservations)
    const excludedTableNumbers = [4, 8, 12];
    const availableTables = (tables || []).filter((t: any) => 
      !excludedTableNumbers.includes(parseInt(t.table_number, 10))
    );
    
    if (!availableTables || availableTables.length === 0) {
      console.warn(`⚠️ No tables found that can accommodate ${party_size} guests (after excluding tables 4, 8, 12)`);
      // Get all tables to show what's available
      const { data: allTables } = await supabase
        .from('tables')
        .select('id, table_number, seats')
        .order('seats', { ascending: true });
      
      return NextResponse.json({ 
        slots: [],
        error: `No tables available for ${party_size} guests`,
        debug: {
          requestedPartySize: party_size,
          allTables: allTables || [],
          maxTableCapacity: allTables && allTables.length > 0 
            ? Math.max(...allTables.map((t: any) => parseInt(t.seats) || 0))
            : 0,
          message: allTables && allTables.length === 0
            ? 'No tables configured in the system'
            : `Largest table capacity is ${allTables && allTables.length > 0 ? Math.max(...allTables.map((t: any) => parseInt(t.seats) || 0)) : 0} guests`
        }
      });
    }
    
    if (DEBUG) console.log('Tables found (after filtering):', availableTables);
    
    // Map to id, number, seats for frontend
    const mappedTables = (availableTables || []).map(t => ({
      id: t.id,
      number: t.table_number,
      seats: parseInt(t.seats, 10)
    }));
    // 2. Get all reservations that overlap with this date (exclude cancelled reservations and private events)
    // We need reservations that: start_time < endOfDay AND end_time > startOfDay
    // Reuse the startOfDayLocal, endOfDayLocal, startOfDayUtc, and endOfDayUtc variables 
    // already calculated above for private events (lines 98-101)
    
    if (DEBUG) {
      console.log(`Fetching reservations for date ${dateStr}:`);
      console.log(`  Local day: ${startOfDayLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')} to ${endOfDayLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
      console.log(`  UTC range: ${startOfDayUtc} to ${endOfDayUtc}`);
    }
    
    // Fetch reservations that overlap with this day (in UTC)
    // Try with status column first, fall back without it if column doesn't exist
    let allReservations: any[] = [];
    let resError: any = null;
    
    // First attempt: try with status column
    const resultWithStatus = await supabase
      .from('reservations')
      .select('id, table_id, start_time, end_time, status, party_size')
      .lt('start_time', endOfDayUtc)
      .gt('end_time', startOfDayUtc);
    
    if (resultWithStatus.error) {
      // If error is about missing column, try without status
      if (resultWithStatus.error.code === '42703' || resultWithStatus.error.message?.includes('column') || resultWithStatus.error.message?.includes('does not exist')) {
        if (DEBUG) console.log('Status column not found, querying without it...');
        const resultWithoutStatus = await supabase
          .from('reservations')
          .select('id, table_id, start_time, end_time, party_size')
          .lt('start_time', endOfDayUtc)
          .gt('end_time', startOfDayUtc);
        
        allReservations = resultWithoutStatus.data || [];
        resError = resultWithoutStatus.error;
      } else {
        // Other error, use it
        allReservations = resultWithStatus.data || [];
        resError = resultWithStatus.error;
      }
    } else {
      // Success with status column
      allReservations = resultWithStatus.data || [];
    }
    
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }
    
    // Filter out:
    // 1. Private events (null table_id)
    // 2. Cancelled reservations (if status column exists)
    const reservations = (allReservations || []).filter((res: any) => {
      // Must have a table_id (exclude private events)
      if (!res.table_id) {
        if (DEBUG) console.log(`  Filtering out reservation ${res.id} - no table_id (private event)`);
        return false;
      }
      // Must not be cancelled (check if status exists and is cancelled)
      if (res.status && res.status === 'cancelled') {
        if (DEBUG) console.log(`  Filtering out reservation ${res.id} - cancelled`);
        return false;
      }
      return true;
    });
    
    if (DEBUG) {
      console.log(`\n📊 RESERVATION SUMMARY:`);
      console.log(`  Total reservations fetched: ${allReservations?.length || 0}`);
      console.log(`  Active reservations (with table_id, not cancelled): ${reservations.length}`);
      console.log(`  Tables that fit party size ${party_size}: ${mappedTables.length}`);
      
      if (reservations.length > 0) {
        console.log('\n  Active reservations:');
        reservations.forEach((res: any, idx: number) => {
          const resStartLocal = DateTime.fromISO(res.start_time).setZone('America/Chicago');
          const resEndLocal = DateTime.fromISO(res.end_time).setZone('America/Chicago');
          console.log(`    ${idx + 1}. Table ${res.table_id}, ${resStartLocal.toFormat('HH:mm')}-${resEndLocal.toFormat('HH:mm')}, ${res.party_size} guests`);
        });
      } else {
        console.log('  ✅ No active reservations found - all slots should be available');
      }
    }
    
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
    if (DEBUG) {
      console.log(`\n⏰ GENERATED ${slots.length} TIME SLOTS:`, slots);
      console.log(`📋 Checking availability for party size: ${party_size}`);
      console.log(`📋 Slot duration: ${party_size <= 2 ? 90 : 120} minutes`);
    }
    
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    const availableSlots: string[] = [];
    
    if (DEBUG) {
      console.log(`\n🔍 STARTING SLOT AVAILABILITY CHECK...`);
      console.log(`  Total slots to check: ${slots.length}`);
      console.log(`  Tables to check: ${mappedTables.length}`);
      console.log(`  Active reservations: ${reservations.length}`);
    }
    
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
      // A slot is available if at least ONE table is free for that slot
      const availableTable = mappedTables.find(table => {
        // Filter reservations for this specific table (exclude null table_ids from private events)
        const tableReservations = reservations.filter(r => {
          if (!r.table_id) {
            if (DEBUG_SLOTS) console.log(`  Skipping reservation with null table_id (private event)`);
            return false;
          }
          const tableIdMatch = String(r.table_id) === String(table.id);
          if (DEBUG_SLOTS && !tableIdMatch) {
            console.log(`  Reservation table_id ${r.table_id} doesn't match table ${table.id}`);
          }
          return tableIdMatch;
        });
        
        if (DEBUG_SLOTS) {
          console.log(`\n🔍 Checking table ${table.id} (${table.number}, ${table.seats} seats) for slot ${slot}`);
          console.log(`  Slot time: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`);
          console.log(`  Table has ${tableReservations.length} reservations for this day`);
        }
        
        // If no reservations for this table, it's available
        if (tableReservations.length === 0) {
          if (DEBUG || DEBUG_SLOTS) {
            console.log(`  ✅ Table ${table.id} (${table.number}) has no reservations - AVAILABLE`);
          }
          return true;
        }
        
        // Check for overlap - a slot is available if NO reservations overlap with it
        // Overlap means: reservation and slot time periods intersect
        // Two time periods overlap if: (period1_start < period2_end) AND (period1_end > period2_start)
        let hasOverlap = false;
        let overlapDetails: any[] = [];
        
        for (const r of tableReservations) {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          
          // Ensure dates are valid
          if (isNaN(resStart.getTime()) || isNaN(resEnd.getTime())) {
            console.warn(`  ⚠️ Invalid reservation times: ${r.start_time} to ${r.end_time}`);
            continue;
          }
          
          // Overlap check: (slotStart < resEnd) && (slotEnd > resStart)
          // This correctly detects if two time periods overlap
          const condition1 = slotStart.getTime() < resEnd.getTime();
          const condition2 = slotEnd.getTime() > resStart.getTime();
          const overlaps = condition1 && condition2;
          
          if (DEBUG || DEBUG_SLOTS) {
            const resStartLocal = DateTime.fromISO(r.start_time).setZone('America/Chicago');
            const resEndLocal = DateTime.fromISO(r.end_time).setZone('America/Chicago');
            const slotStartLocal = DateTime.fromJSDate(slotStart).setZone('America/Chicago');
            const slotEndLocal = DateTime.fromJSDate(slotEnd).setZone('America/Chicago');
            
            console.log(`  Checking reservation ${r.id}: ${resStartLocal.toFormat('HH:mm')}-${resEndLocal.toFormat('HH:mm')} (${r.party_size} guests)`);
            console.log(`    Slot: ${slotStartLocal.toFormat('HH:mm')}-${slotEndLocal.toFormat('HH:mm')}`);
            console.log(`    Slot UTC: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`);
            console.log(`    Res UTC: ${resStart.toISOString()} to ${resEnd.toISOString()}`);
            console.log(`    Condition 1 (slotStart < resEnd): ${slotStart.getTime()} < ${resEnd.getTime()} = ${condition1}`);
            console.log(`    Condition 2 (slotEnd > resStart): ${slotEnd.getTime()} > ${resStart.getTime()} = ${condition2}`);
            console.log(`    OVERLAP: ${overlaps}`);
          }
          
          if (overlaps) {
            hasOverlap = true;
            overlapDetails.push({
              reservationId: r.id,
              reservationTime: `${DateTime.fromISO(r.start_time).setZone('America/Chicago').toFormat('HH:mm')}-${DateTime.fromISO(r.end_time).setZone('America/Chicago').toFormat('HH:mm')}`,
              slotTime: `${DateTime.fromJSDate(slotStart).setZone('America/Chicago').toFormat('HH:mm')}-${DateTime.fromJSDate(slotEnd).setZone('America/Chicago').toFormat('HH:mm')}`
            });
            if (DEBUG || DEBUG_SLOTS) {
              console.log(`  ⚠️ OVERLAP DETECTED: Reservation ${r.start_time} - ${r.end_time} overlaps with slot ${slot}`);
            }
            break; // Found an overlap, no need to check more
          }
        }
        
        const isAvailable = !hasOverlap;
        if (DEBUG || DEBUG_SLOTS) {
          if (isAvailable) {
            console.log(`  ✅ Table ${table.id} (${table.number}) AVAILABLE for slot ${slot} - no overlapping reservations`);
          } else {
            console.log(`  ❌ Table ${table.id} (${table.number}) NOT AVAILABLE for slot ${slot} - ${overlapDetails.length} overlapping reservation(s)`);
            overlapDetails.forEach(detail => {
              console.log(`    - Reservation ${detail.reservationId}: ${detail.reservationTime} conflicts with slot ${detail.slotTime}`);
            });
          }
        }
        
        return isAvailable;
      });
      
      if (DEBUG_SLOTS && !availableTable) {
        console.log(`❌ NO TABLE AVAILABLE for slot ${slot} - all tables are booked`);
      }
      if (availableTable) {
        availableSlots.push(slot);
        if (DEBUG || DEBUG_SLOTS) {
          console.log(`✅ SLOT ${slot} AVAILABLE (table ${availableTable.number || availableTable.id} is free)`);
        }
      } else {
        if (DEBUG || DEBUG_SLOTS) {
          // Find out why no table is available
          const reasons = mappedTables.map((table: any) => {
            const tableRes = reservations.filter((r: any) => 
              r.table_id && String(r.table_id) === String(table.id)
            );
            if (tableRes.length === 0) {
              return `Table ${table.number}: No reservations (should be available!)`;
            }
            const conflicts = tableRes.filter((r: any) => {
              const resStart = new Date(r.start_time);
              const resEnd = new Date(r.end_time);
              return (slotStart.getTime() < resEnd.getTime()) && (slotEnd.getTime() > resStart.getTime());
            });
            if (conflicts.length > 0) {
              return `Table ${table.number}: ${conflicts.length} conflicting reservation(s)`;
            }
            return `Table ${table.number}: Has reservations but none conflict (should be available!)`;
          });
          console.log(`❌ SLOT ${slot} NOT AVAILABLE. Reasons:`, reasons);
        }
      }
    }
    
    // Final summary
    console.log('\n📊 FINAL AVAILABILITY SUMMARY:');
    console.log(`  Date: ${dateStr}`);
    console.log(`  Party size: ${party_size}`);
    console.log(`  Total slots generated: ${slots.length}`);
    console.log(`  Available slots: ${availableSlots.length}`);
    console.log(`  Unavailable slots: ${slots.length - availableSlots.length}`);
    console.log(`  Active reservations: ${reservations.length}`);
    console.log(`  Tables that fit party size: ${mappedTables.length}`);
    
    if (availableSlots.length === 0 && reservations.length === 0 && mappedTables.length > 0) {
      console.warn('\n⚠️ WARNING: No slots available but no reservations found!');
      console.warn('  This suggests a logic error. Checking each table...');
      mappedTables.forEach((table: any) => {
        const tableRes = reservations.filter((r: any) => 
          r.table_id && String(r.table_id) === String(table.id)
        );
        console.warn(`  Table ${table.number} (${table.id}): ${tableRes.length} reservations`);
      });
    }
    
    if (availableSlots.length > 0) {
      console.log(`\n✅ AVAILABLE SLOTS: ${availableSlots.join(', ')}`);
    } else {
      console.log(`\n❌ NO AVAILABLE SLOTS`);
      if (mappedTables.length === 0) {
        console.log('  Reason: No tables available for this party size');
      } else if (reservations.length > 0) {
        console.log('  Reason: All slots are blocked by reservations');
        // Show which reservations are blocking
        const blockingReservations = reservations.map((r: any) => {
          const start = DateTime.fromISO(r.start_time).setZone('America/Chicago');
          const end = DateTime.fromISO(r.end_time).setZone('America/Chicago');
          return `Table ${r.table_id}: ${start.toFormat('HH:mm')}-${end.toFormat('HH:mm')}`;
        });
        console.log('  Blocking reservations:', blockingReservations);
      } else {
        console.log('  Reason: Unknown - no reservations found but no slots available');
      }
    }
    
    // If no slots are available, provide helpful debug info
    if (availableSlots.length === 0) {
      console.warn(`⚠️ No available slots for ${dateStr} with party size ${party_size}`);
      console.warn(`  - Total slots generated: ${slots.length}`);
      console.warn(`  - Active reservations: ${reservations.length}`);
      console.warn(`  - Tables that fit party size: ${mappedTables.length}`);
      
      // Check if it's because all slots are blocked by reservations
      if (reservations.length > 0 && mappedTables.length > 0) {
        const reservationsByTable = mappedTables.map((table: any) => {
          const tableRes = reservations.filter((r: any) => 
            r.table_id && String(r.table_id) === String(table.id)
          );
          return {
            table: table.number,
            reservations: tableRes.length,
            times: tableRes.map((r: any) => ({
              start: DateTime.fromISO(r.start_time).setZone('America/Chicago').toFormat('HH:mm'),
              end: DateTime.fromISO(r.end_time).setZone('America/Chicago').toFormat('HH:mm'),
            }))
          };
        });
        
        return NextResponse.json({ 
          slots: [],
          error: 'No available time slots',
          debug: {
            totalSlotsGenerated: slots.length,
            activeReservations: reservations.length,
            tablesAvailable: mappedTables.length,
            reservationsByTable,
            message: 'All time slots are currently booked. Try a different date or time.'
          }
        });
      }
    }
    
    return NextResponse.json({ 
      slots: availableSlots,
      timestamp: new Date().toISOString(),
      debugMessage: 'NEW_CODE_DEPLOYED_SUCCESSFULLY',
      totalSlots: availableSlots.length,
      requestedDate: date,
      debugInfo: debugInfo,
      // Include helpful debug info in response
      ...(DEBUG && {
        debugDetails: {
          slotsGenerated: slots.length,
          activeReservations: reservations.length,
          tablesAvailable: mappedTables.length,
        }
      })
    });
  } catch (error) {
    console.error('Error in available-slots API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 