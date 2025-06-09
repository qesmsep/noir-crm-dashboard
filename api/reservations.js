import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        tables (
          number
        )
      `);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'POST') {
    const { name, phone, email, party_size, notes, start_time, end_time, source, event_type } = req.body;
    console.log('POST /api/reservations - party_size:', party_size);
    const table_id = await assignTable(start_time, end_time, party_size);
    console.log('POST /api/reservations - assignTable result:', table_id);
    if (!table_id) {
      // Calculate duration in minutes
      const durationMinutes = Math.round((new Date(end_time) - new Date(start_time)) / 60000);
      const next_available_time = await findNextAvailableTime(start_time, durationMinutes, party_size);
      return res.status(409).json({ error: 'No available table', next_available_time });
    }
    const { data, error } = await supabase
      .from('reservations')
      .insert({ name, phone, email, party_size, notes, start_time, end_time, table_id, source, event_type })
      .select(`
        *,
        tables (
          number
        )
      `);
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(500).json({ error: 'No reservation data returned' });

    // --- NEW: Send confirmation SMS ---
    const formattedPhone = phone ? phone.replace(/\D/g, '') : '';
    if (formattedPhone) {
      try {
        const smsPayload = {
          direct_phone: formattedPhone,
          content: `Thank you for making a reservation. It has been confirmed.`
        };
        console.log('Sending SMS confirmation with payload:', smsPayload);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/sendText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsPayload)
        });
      } catch (err) {
        console.error('Failed to send confirmation SMS:', err);
      }
    }
    // --- END NEW ---

    return res.status(201).json({ data: data[0] });
  }
  if (method === 'PATCH') {
    // Support id from URL (req.query.id) or body
    const id = req.query.id || req.body.id;
    // Only update provided fields
    const updateFields = {};
    if (req.body.table_id !== undefined) updateFields.table_id = req.body.table_id;
    if (req.body.start_time !== undefined) updateFields.start_time = req.body.start_time;
    if (req.body.end_time !== undefined) updateFields.end_time = req.body.end_time;
    if (req.body.event_type !== undefined) updateFields.event_type = req.body.event_type;
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const { data, error } = await supabase
      .from('reservations')
      .update(updateFields)
      .eq('id', id)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  res.setHeader('Allow', ['GET','POST','PATCH']);
  res.status(405).end(`Method ${method} Not Allowed`);
}