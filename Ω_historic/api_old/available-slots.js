import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper to get all time slots between start and end (inclusive) at 15-min intervals
function getTimeSlots(start, end) {
  const slots = [];
  let [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  let current = new Date(2000, 0, 1, sh, sm);
  const endTime = new Date(2000, 0, 1, eh, em);
  while (current <= endTime) {
    slots.push(current.toTimeString().slice(0,5));
    current.setMinutes(current.getMinutes() + 15);
  }
  return slots;
}

export default async function handler(req, res) {
  const { date, party_size } = req.query;
  if (!date || !party_size) {
    return res.status(400).json({ error: 'date and party_size are required' });
  }
  const dayOfWeek = new Date(date).getDay();

  // 1. Block outside Booking Window dates
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
  const reqDate = new Date(date);
  if ((bookingStart && reqDate < bookingStart) || (bookingEnd && reqDate > bookingEnd)) {
    return res.status(200).json({ slots: [] });
  }

  // 2. Block for Private Events
  const { data: privateEvents } = await supabase
    .from('events')
    .select('*')
    .eq('private', true)
    .gte('start_time', `${date}T00:00:00`)
    .lte('end_time', `${date}T23:59:59`);
  if (privateEvents && privateEvents.length > 0) {
    return res.status(200).json({ slots: [] });
  }

  // 3. Block for Custom Closed Days (exceptional closures)
  const { data: exceptionalClosure } = await supabase
    .from('venue_hours')
    .select('*')
    .eq('type', 'exceptional_closure')
    .eq('date', date)
    .maybeSingle();
  if (exceptionalClosure && (exceptionalClosure.full_day || !exceptionalClosure.time_ranges)) {
    return res.status(200).json({ slots: [] });
  }

  // 4. Ignore Custom Open Days (exceptional opens) for RSVP picker
  // (Do not use exceptionalOpen logic)

  // 5. Use all base hours for open days and time ranges
  const { data: baseHoursData } = await supabase
    .from('venue_hours')
    .select('*')
    .eq('type', 'base')
    .eq('day_of_week', dayOfWeek);
  if (!baseHoursData || baseHoursData.length === 0) {
    return res.status(200).json({ slots: [] });
  }
  // Merge all time ranges for the day
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

  // Generate all possible slots for the open time ranges
  let allSlots = [];
  for (const range of timeRanges) {
    allSlots = allSlots.concat(getTimeSlots(range.start, range.end));
  }

  // For each slot, check if at least one table is available
  const availableSlots = [];
  for (const slot of allSlots) {
    const startTime = `${date}T${slot}:00`;
    const endTime = new Date(new Date(startTime).getTime() + 90 * 60000).toISOString();
    const { data: tables } = await supabase
      .from('tables')
      .select('*')
      .gte('capacity', Number(party_size));
    let slotAvailable = false;
    for (const t of tables) {
      // Check for conflicting reservations
      const { count: resCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('table_id', t.id)
        .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`);
      // Check for conflicting events (private only already checked)
      const { count: evCount } = await supabase
        .from('events')
        .select('id', { count: 'exact' })
        .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`);
      if (resCount === 0 && evCount === 0) {
        slotAvailable = true;
        break;
      }
    }
    if (slotAvailable) availableSlots.push(slot);
  }
  res.status(200).json({ slots: availableSlots });
} 