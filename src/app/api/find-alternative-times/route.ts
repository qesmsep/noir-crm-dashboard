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
  const slotStart = new Date(date);
  slotStart.setHours(hour, minute, 0, 0);
  return slotStart;
}

// Helper: convert Date to time string
function dateToTimeString(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'am' : 'pm';
  const min = minute.toString().padStart(2, '0');
  return `${displayHour}:${min}${ampm}`;
}

export async function POST(request: Request) {
  try {
    const { date, party_size, requested_time } = await request.json();
    
    if (!date || !party_size || !requested_time) {
      return NextResponse.json({ 
        error: 'Missing date, party_size, or requested_time' 
      }, { status: 400 });
    }

    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    
    if (tablesError) {
      return NextResponse.json({ error: 'Error fetching tables' }, { status: 500 });
    }
    
    // Filter out tables 4, 8, and 12 (not available for reservations)
    const excludedTableNumbers = [4, 8, 12];
    const availableTables = (tables || []).filter((t: any) => 
      !excludedTableNumbers.includes(parseInt(t.table_number, 10))
    );
    
    if (!availableTables || availableTables.length === 0) {
      return NextResponse.json({ 
        error: 'No tables available for this party size' 
      }, { status: 400 });
    }

    // Map to id, number, seats for frontend
    const mappedTables = (availableTables || []).map(t => ({
      id: t.id,
      number: t.table_number,
      seats: parseInt(t.seats, 10)
    }));

    // 2. Get all reservations for that date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    
    if (resError) {
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }

    // 3. Generate all possible time slots
    const allSlots = generateTimeSlots();
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    
    // 4. Check availability for each slot
    const availableSlots: { time: string; available: boolean }[] = [];
    
    for (const slot of allSlots) {
      const slotStart = timeStringToDate(slot, date);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      
      // Check if any table is available for this slot
      const availableTable = mappedTables.find(table => {
        const tableReservations = reservations.filter(r => String(r.table_id) === String(table.id));
        console.log(`Table ${table.id}, Slot ${slot}: Reservations:`, tableReservations);
        // Check for overlap
        return !tableReservations.some(r => {
          console.log(`Checking overlap for Table ${table.id}, Slot ${slot} against reservation ${r.start_time} - ${r.end_time}`);
          const resStart = new Date(r.start_time);
          const resEnd = new Date(r.end_time);
          return (
            (slotStart < resEnd) && (slotEnd > resStart)
          );
        });
      });
      
      availableSlots.push({
        time: slot,
        available: !!availableTable
      });
    }

    // 5. Find the requested time index
    const requestedTimeIndex = availableSlots.findIndex(slot => slot.time === requested_time);
    
    if (requestedTimeIndex === -1) {
      return NextResponse.json({ 
        error: 'Requested time not found in available slots' 
      }, { status: 400 });
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

    // 7. Return the alternative times
    return NextResponse.json({
      requested_time,
      alternative_times: {
        before: beforeTime,
        after: afterTime
      },
      message: beforeTime || afterTime 
        ? 'The requested time is not available. Here are the nearest available times:'
        : 'No alternative times available for this date.'
    });

  } catch (error) {
    console.error('Error in find-alternative-times:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 