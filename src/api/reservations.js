import { supabase } from './supabaseClient';

// Helper to auto-assign smallest free table
async function assignTable(start_time, end_time, party_size) {
  // Use the same logic for all party sizes: find the smallest available table with sufficient capacity
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  for (const t of tables) {
    // Fetch all events for this table
    const { data: events } = await supabase
      .from('events').select('start_time, end_time, table_id')
      .eq('table_id', t.id);
    // Fetch all reservations for this table
    const { data: reservations } = await supabase
      .from('reservations').select('start_time, end_time, table_id')
      .eq('table_id', t.id);
    // Check for time overlap with events
    const hasEventConflict = (events || []).some(e =>
      !(new Date(e.end_time) <= new Date(start_time) || new Date(e.start_time) >= new Date(end_time))
    );
    // Check for time overlap with reservations
    const hasReservationConflict = (reservations || []).some(r =>
      !(new Date(r.end_time) <= new Date(start_time) || new Date(r.start_time) >= new Date(end_time))
    );
    if (!hasEventConflict && !hasReservationConflict) return t.id;
  }
  return null;
}

// Helper to find the next available time for a table with sufficient capacity
async function findNextAvailableTime(start_time, durationMinutes, party_size) {
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  const searchStart = new Date(start_time);
  const searchEnd = new Date(searchStart.getTime() + 7 * 24 * 60 * 60 * 1000); // search up to 7 days ahead
  let earliest = null;

  for (const t of tables) {
    // Fetch all events and reservations for this table, sorted by start_time
    const { data: events } = await supabase
      .from('events').select('start_time, end_time').eq('table_id', t.id);
    const { data: reservations } = await supabase
      .from('reservations').select('start_time, end_time').eq('table_id', t.id);
    const blocks = [...(events || []), ...(reservations || [])]
      .map(b => ({
        start: new Date(b.start_time),
        end: new Date(b.end_time)
      }))
      .sort((a, b) => a.start - b.start);
    let slotStart = new Date(searchStart);
    while (slotStart < searchEnd) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      // Check for overlap with any block
      const hasConflict = blocks.some(b =>
        !(b.end <= slotStart || b.start >= slotEnd)
      );
      if (!hasConflict) {
        if (!earliest || slotStart < earliest) earliest = new Date(slotStart);
        break;
      }
      // Move to the end of the next block that starts after slotStart, or increment by 15 min
      const nextBlock = blocks.find(b => b.start >= slotStart);
      if (nextBlock) {
        slotStart = new Date(Math.max(slotStart.getTime() + 15 * 60000, nextBlock.end.getTime()));
      } else {
        slotStart = new Date(slotStart.getTime() + 15 * 60000);
      }
    }
  }
  return earliest ? earliest.toISOString() : null;
}

export const getReservations = async (startDate, endDate) => {
    const { data, error } = await supabase
        .from('reservations')
        .select(`
            *,
            tables (
                id,
                number,
                capacity
            )
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
};

export const createReservation = async (reservationData) => {
    // If this is a private event reservation, check if the table is available during the event
    if (reservationData.is_private_event) {
        const { data: privateEvent } = await supabase
            .from('private_events')
            .select('*')
            .eq('id', reservationData.private_event_id)
            .single();

        if (!privateEvent) {
            throw new Error('Private event not found');
        }

        // Check if the table is already reserved during this event
        const { data: existingReservations } = await supabase
            .from('reservations')
            .select('*')
            .eq('table_id', reservationData.table_id)
            .gte('start_time', privateEvent.start_time)
            .lte('end_time', privateEvent.end_time);

        if (existingReservations && existingReservations.length > 0) {
            throw new Error('This table is already reserved during the private event');
        }
    }

    const { data, error } = await supabase
        .from('reservations')
        .insert([reservationData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateReservation = async (id, reservationData) => {
    // If this is a private event reservation, check if the table is available during the event
    if (reservationData.is_private_event) {
        const { data: privateEvent } = await supabase
            .from('private_events')
            .select('*')
            .eq('id', reservationData.private_event_id)
            .single();

        if (!privateEvent) {
            throw new Error('Private event not found');
        }

        // Check if the table is already reserved during this event (excluding this reservation)
        const { data: existingReservations } = await supabase
            .from('reservations')
            .select('*')
            .eq('table_id', reservationData.table_id)
            .neq('id', id)
            .gte('start_time', privateEvent.start_time)
            .lte('end_time', privateEvent.end_time);

        if (existingReservations && existingReservations.length > 0) {
            throw new Error('This table is already reserved during the private event');
        }
    }

    const { data, error } = await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteReservation = async (id) => {
    const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getReservationById = async (id) => {
    const { data, error } = await supabase
        .from('reservations')
        .select(`
            *,
            tables (
                id,
                number,
                capacity
            )
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};