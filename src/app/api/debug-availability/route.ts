import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../pages/api/supabaseClient';
import { DateTime } from 'luxon';

export async function POST(request: Request) {
  try {
    const { date, party_size } = await request.json();
    if (!date || !party_size) {
      return NextResponse.json({ error: 'Missing date or party_size' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().slice(0, 10);
    
    const diagnostics: any = {
      input: { date, party_size, dateStr },
      timestamp: new Date().toISOString(),
    };
    
    // 1. Check tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_number, seats')
      .gte('seats', party_size)
      .order('seats', { ascending: true });
    
    if (tablesError) {
      diagnostics.tablesError = tablesError;
    } else {
      diagnostics.tables = {
        count: tables?.length || 0,
        tables: tables || [],
        message: tables && tables.length > 0 
          ? `Found ${tables.length} table(s) that can accommodate ${party_size} guests`
          : `No tables found that can accommodate ${party_size} guests`
      };
    }
    
    // 2. Check reservations for the date
    const startOfDay = new Date(dateStr + 'T00:00:00');
    const endOfDay = new Date(dateStr + 'T23:59:59.999');
    
    const { data: allReservations, error: resError } = await supabase
      .from('reservations')
      .select('id, table_id, start_time, end_time, status, party_size, first_name, last_name')
      .lt('start_time', endOfDay.toISOString())
      .gt('end_time', startOfDay.toISOString())
      .order('start_time', { ascending: true });
    
    if (resError) {
      diagnostics.reservationsError = resError;
    } else {
      // Filter out cancelled and private events
      const activeReservations = (allReservations || []).filter((res: any) => {
        if (!res.table_id) return false; // Exclude private events
        if (res.status === 'cancelled') return false; // Exclude cancelled
        return true;
      });
      
      diagnostics.reservations = {
        total: allReservations?.length || 0,
        active: activeReservations.length,
        cancelled: (allReservations || []).filter((r: any) => r.status === 'cancelled').length,
        privateEvents: (allReservations || []).filter((r: any) => !r.table_id).length,
        activeReservations: activeReservations.map((r: any) => ({
          id: r.id,
          table_id: r.table_id,
          start_time: r.start_time,
          end_time: r.end_time,
          status: r.status,
          party_size: r.party_size,
          name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown',
          startLocal: DateTime.fromISO(r.start_time).setZone('America/Chicago').toFormat('yyyy-MM-dd HH:mm'),
          endLocal: DateTime.fromISO(r.end_time).setZone('America/Chicago').toFormat('yyyy-MM-dd HH:mm'),
        })),
      };
    }
    
    // 3. Check venue hours
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
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
    
    const { data: exceptionalClosure } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'exceptional_closure')
      .eq('date', dateStr)
      .maybeSingle();
    
    diagnostics.venueHours = {
      dayOfWeek,
      baseHours: baseHours || [],
      exceptionalOpen: exceptionalOpen || null,
      exceptionalClosure: exceptionalClosure || null,
      isOpen: (baseHours && baseHours.length > 0) || !!exceptionalOpen,
    };
    
    // 4. Check private events
    const startOfDayLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: 'America/Chicago' }).startOf('day');
    const endOfDayLocal = startOfDayLocal.endOf('day');
    const startOfDayUtc = startOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    const endOfDayUtc = endOfDayLocal.toUTC().toISO({ suppressMilliseconds: true });
    
    const { data: privateEvents } = await supabase
      .from('private_events')
      .select('id, title, start_time, end_time, full_day, status')
      .eq('status', 'active')
      .lt('start_time', endOfDayUtc)
      .gt('end_time', startOfDayUtc);
    
    diagnostics.privateEvents = {
      count: privateEvents?.length || 0,
      events: (privateEvents || []).map((ev: any) => ({
        id: ev.id,
        title: ev.title,
        start_time: ev.start_time,
        end_time: ev.end_time,
        full_day: ev.full_day,
        startLocal: DateTime.fromISO(ev.start_time).setZone('America/Chicago').toFormat('yyyy-MM-dd HH:mm'),
        endLocal: DateTime.fromISO(ev.end_time).setZone('America/Chicago').toFormat('yyyy-MM-dd HH:mm'),
      })),
    };
    
    // 5. Test a few sample slots
    if (tables && tables.length > 0 && diagnostics.reservations) {
      const sampleSlots = ['6:00pm', '7:00pm', '8:00pm', '9:00pm'];
      const slotDuration = party_size <= 2 ? 90 : 120; // minutes
      
      diagnostics.slotAnalysis = sampleSlots.map(slot => {
        const [time, ampm] = slot.split(/(am|pm)/);
        let [hour, minute] = time.split(':').map(Number);
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        const slotLocal = DateTime.fromISO(`${dateStr}T${hourStr}:${minuteStr}:00`, { zone: 'America/Chicago' });
        const slotStart = slotLocal.toUTC().toJSDate();
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
        
        const tableAvailability = tables.map((table: any) => {
          const tableReservations = diagnostics.reservations.activeReservations.filter(
            (r: any) => String(r.table_id) === String(table.id)
          );
          
          const conflicts = tableReservations.filter((r: any) => {
            const resStart = new Date(r.start_time);
            const resEnd = new Date(r.end_time);
            return (slotStart < resEnd) && (slotEnd > resStart);
          });
          
          return {
            table_id: table.id,
            table_number: table.table_number,
            seats: table.seats,
            hasReservations: tableReservations.length > 0,
            reservationCount: tableReservations.length,
            hasConflict: conflicts.length > 0,
            conflicts: conflicts.map((c: any) => ({
              id: c.id,
              start: c.start_time,
              end: c.end_time,
              name: c.name,
            })),
            available: conflicts.length === 0,
          };
        });
        
        const anyTableAvailable = tableAvailability.some((t: any) => t.available);
        
        return {
          slot,
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          slotStartLocal: slotLocal.toFormat('yyyy-MM-dd HH:mm'),
          slotEndLocal: slotLocal.plus({ minutes: slotDuration }).toFormat('yyyy-MM-dd HH:mm'),
          duration: slotDuration,
          anyTableAvailable,
          tableAvailability,
        };
      });
    }
    
    // 6. Summary
    diagnostics.summary = {
      canBook: diagnostics.tables?.count > 0 && diagnostics.venueHours.isOpen,
      reason: !diagnostics.tables?.count 
        ? 'No tables available for party size'
        : !diagnostics.venueHours.isOpen
        ? 'Venue is closed'
        : 'Should be able to book',
      tablesAvailable: diagnostics.tables?.count || 0,
      activeReservations: diagnostics.reservations?.active || 0,
      privateEventsBlocking: diagnostics.privateEvents?.count || 0,
    };
    
    return NextResponse.json(diagnostics, { status: 200 });
  } catch (error: any) {
    console.error('Error in debug-availability:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
