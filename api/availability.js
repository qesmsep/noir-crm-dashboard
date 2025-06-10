import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  const { start_time, end_time, party_size } = req.query;
  if (!start_time || !end_time || !party_size) {
    return res.status(400).json({ error: 'start_time, end_time, and party_size are required' });
  }
  // Find tables with capacity >= party_size
  const { data: tables, error: tblErr } = await supabase
    .from('tables')
    .select('*')
    .gte('capacity', Number(party_size));
  if (tblErr) return res.status(500).json({ error: tblErr.message });

  // Filter out tables with conflicting events or reservations
  const free = [];
  for (const t of tables) {
    console.log('Testing slot for table', t.id, 'capacity', t.capacity);
    // Check events overlap
    const { count: evCount } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);
    // Check reservations overlap
    const { count: resCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('table_id', t.id)
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);
    console.log(`Table ${t.id}: evCount=${evCount}, resCount=${resCount}`);
    if (evCount === 0 && resCount === 0) free.push(t);
  }
  res.status(200).json({ free });
}