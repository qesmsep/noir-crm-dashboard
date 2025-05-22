import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper to auto-assign smallest free table
async function assignTable(start_time, end_time, party_size) {
  // Use the same logic for all party sizes: find the smallest available table with sufficient capacity
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  for (const t of tables) {
    const { count: evCount } = await supabase
      .from('events').select('id', { count: 'exact' })
      .eq('table_id', t.id)
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);
    const { count: resCount } = await supabase
      .from('reservations').select('id', { count: 'exact' })
      .eq('table_id', t.id)
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);
    if (evCount === 0 && resCount === 0) return t.id;
  }
  return null;
}

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const { data, error } = await supabase.from('reservations').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'POST') {
    const { name, phone, email, party_size, notes, start_time, end_time, source } = req.body;
    console.log('POST /api/reservations - party_size:', party_size);
    const table_id = await assignTable(start_time, end_time, party_size);
    console.log('POST /api/reservations - assignTable result:', table_id);
    if (!table_id) return res.status(409).json({ error: 'No available table' });
    const { data, error } = await supabase
      .from('reservations')
      .insert({ name, phone, email, party_size, notes, start_time, end_time, table_id, source })
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }
  if (method === 'PATCH') {
    // Support id from URL (req.query.id) or body
    const id = req.query.id || req.body.id;
    // Only update provided fields
    const updateFields = {};
    if (req.body.table_id !== undefined) updateFields.table_id = req.body.table_id;
    if (req.body.start_time !== undefined) updateFields.start_time = req.body.start_time;
    if (req.body.end_time !== undefined) updateFields.end_time = req.body.end_time;
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