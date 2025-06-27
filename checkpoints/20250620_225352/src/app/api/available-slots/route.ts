import { NextResponse } from 'next/server';
import { supabase } from '../../../pages/api/supabaseClient';

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

export async function POST(request: Request) {
  try {
    const { date, party_size } = await request.json();
    if (!date || !party_size) {
      return NextResponse.json({ error: 'Missing date or party_size' }, { status: 400 });
    }
    // 1. Get all tables that fit the party size
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size);
    if (tablesError) {
      return NextResponse.json({ error: 'Error fetching tables' }, { status: 500 });
    }
    if (!tables || tables.length === 0) {
      return NextResponse.json({ slots: [] });
    }
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
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('table_id, start_time, end_time')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString());
    if (resError) {
      return NextResponse.json({ error: 'Error fetching reservations' }, { status: 500 });
    }
    // 3. For each slot, check if at least one table is available
    const slots = generateTimeSlots();
    const slotDuration = party_size <= 2 ? 90 : 120; // minutes
    const availableSlots: string[] = [];
    for (const slot of slots) {
      // Build slot start/end
      const [time, ampm] = slot.split(/(am|pm)/);
      let [hour, minute] = time.split(':').map(Number);
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
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
    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 