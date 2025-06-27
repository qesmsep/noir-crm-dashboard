import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Helper: generate all time slots (e.g., 6:00pm to midnight, every 15 min)
function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 18; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'am' : 'pm';
      const min = m.toString().padStart(2, '0');
      slots.push(`${hour}:${min}${ampm}`);
    }
  }
  return slots;
}

// Helper: convert time string to Date object
function timeStringToDate(timeString: string, date: string): Date {
  const [time, ampm] = timeString.split(/(am|pm)/);
  let [hour, minute] = time.split(':').map(Number);
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const slotStart = new Date(date + 'T00:00:00.000Z'); // Create UTC date
  slotStart.setUTCHours(hour, minute, 0, 0); // Use UTC methods
  return slotStart;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, party_size, requested_time } = body;

    console.log('Test endpoint called with:', { date, party_size, requested_time });

    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    
    if (tablesError || !tables || tables.length === 0) {
      return NextResponse.json({ error: 'No tables available for this party size' }, { status: 400 });
    }

    console.log('Found tables:', tables);

    // Map to id, number, seats for frontend
    const mappedTables = (tables || []).map(t => ({
      id: t.id,
      number: t.table_number,
      seats: parseInt(t.seats, 10)
    }));

    // 2. Get all reservations for that date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Looking for reservations between:', startOfDay.toISOString(), 'and', endOfDay.toISOString());
    
    // Get all reservations and filter in JavaScript to avoid query issues
    const { data: allReservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time');
    
    if (resError) {
      console.error('Error fetching reservations:', resError);
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }

    // Filter reservations for the specific date (compare only YYYY-MM-DD)
    const targetDateStr = date;
    const reservations = (allReservations || []).filter(res => {
      const resDateStr = new Date(res.start_time).toISOString().slice(0, 10);
      return resDateStr === targetDateStr;
    });

    console.log('All reservations:', allReservations?.length);
    console.log('Found reservations for date:', reservations.length);
    console.log('Raw reservation data:', JSON.stringify(reservations, null, 2));

    // 3. Generate all possible time slots
    const allSlots = generateTimeSlots();
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    
    console.log('Generated time slots:', allSlots);
    console.log('Looking for requested time:', requested_time);
    
    // 4. Check availability for each slot
    const availableSlots: { time: string; available: boolean }[] = [];
    
    for (const slot of allSlots) {
      const slotStart = timeStringToDate(slot, date);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      
      console.log(`\nChecking slot: ${slot} (${slotStart.toISOString()} - ${slotEnd.toISOString()})`);
      
      // Check if any table is available for this slot
      const availableTable = mappedTables.find(table => {
        const tableReservations = reservations.filter(r => r.table_id === table.id);
        console.log(`Table ${table.id}, Slot ${slot}: Reservations:`, tableReservations);
        
        // Check for overlap
        const hasOverlap = tableReservations.some(r => {
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          const overlap = (slotStart < resEnd) && (slotEnd > resStart);
          console.log(`Checking overlap for Table ${table.id}, Slot ${slot} against reservation ${r.start_time} - ${r.end_time}`);
          console.log(`Slot: ${slotStart.toISOString()} - ${slotEnd.toISOString()}`);
          console.log(`Reservation: ${resStart.toISOString()} - ${resEnd.toISOString()}`);
          console.log(`Overlap: ${overlap}`);
          return overlap;
        });
        
        console.log(`Table ${table.id} available for slot ${slot}: ${!hasOverlap}`);
        return !hasOverlap;
      });
      
      availableSlots.push({
        time: slot,
        available: !!availableTable
      });
    }

    console.log('Available slots:', availableSlots);

    // 5. Find the requested time index
    const requestedTimeIndex = availableSlots.findIndex(slot => slot.time === requested_time);
    
    console.log('Requested time index:', requestedTimeIndex);
    
    if (requestedTimeIndex === -1) {
      console.log('Requested time not found in slots');
      return NextResponse.json({ error: 'Requested time not found in available slots' }, { status: 400 });
    }

    // 6. Find nearest available times before and after
    let beforeTime: string | null = null;
    let afterTime: string | null = null;
    
    // Look for available time before the requested time
    for (let i = requestedTimeIndex - 1; i >= 0; i--) {
      if (availableSlots[i].available) {
        beforeTime = availableSlots[i].time;
        break;
      }
    }
    
    // Look for available time after the requested time
    for (let i = requestedTimeIndex + 1; i < availableSlots.length; i++) {
      if (availableSlots[i].available) {
        afterTime = availableSlots[i].time;
        break;
      }
    }

    const result = {
      requested_time,
      alternative_times: {
        before: beforeTime,
        after: afterTime
      },
      message: beforeTime || afterTime 
        ? 'The requested time is not available. Here are the nearest available times:'
        : 'No alternative times available for this date.',
      debug: {
        allSlots,
        availableSlots,
        requestedTimeIndex,
        tables: mappedTables,
        reservations
      }
    };

    console.log('Returning result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}