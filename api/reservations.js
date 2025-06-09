import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // --- NEW: Send personalized confirmation SMS ---
    const reservation = data[0];
    // Format start time
    const startDateObj = new Date(reservation.start_time);
    const formattedDate = startDateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    let timeString = startDateObj.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    timeString = timeString.replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm');

    const messageContent = `Thank you, ${reservation.name}. Your reservation has been confirmed for Noir on ${formattedDate} at ${timeString} for ${reservation.party_size} guests. Please respond directly to this text message if you need to make any changes or if you have any questions.`;

    // Always ensure formattedPhone starts with '+'
    const formattedPhone = phone ? '+' + phone.replace(/\D/g, '') : '';
    if (formattedPhone) {
      try {
        const smsPayload = {
          direct_phone: formattedPhone,
          content: messageContent
        };
        console.log('Sending SMS confirmation with payload:', smsPayload);
        console.log('Attempting to send confirmation SMS to', formattedPhone);
        const baseUrl = `https://${req.headers.host}`;
        const smsRes = await fetch(`${baseUrl}/api/sendText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsPayload)
        });
        console.log('SMS API response status:', smsRes.status);
        const smsResData = await smsRes.json();
        console.log('SMS API response body:', smsResData);
      } catch (err) {
        console.error('Failed to send confirmation SMS:', err);
      }
    }
    // --- END NEW ---

    return res.status(201).json({ data: reservation });
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
  if (method === 'DELETE') {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ error: 'Reservation id is required' });
    // Fetch reservation to get hold_id
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, hold_id')
      .eq('id', id)
      .single();
    if (fetchError || !reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    // If hold_id exists, cancel the PaymentIntent
    if (reservation.hold_id) {
      try {
        await stripe.paymentIntents.cancel(reservation.hold_id);
      } catch (err) {
        console.error('Failed to cancel Stripe hold:', err);
        // Continue to delete reservation even if Stripe fails
      }
    }
    // Delete reservation
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);
    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}