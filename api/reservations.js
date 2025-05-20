

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper to auto-assign smallest free table
async function assignTable(start_time, end_time, party_size) {
  const { data: tables } = await supabase
    .from('tables').select('*').gte('capacity', party_size).order('capacity');
  for (const t of tables) {
    const { count: evCount } = await supabase
      .from('events').select('id', { count: 'exact' })
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
    const table_id = await assignTable(start_time, end_time, party_size);
    if (!table_id) return res.status(409).json({ error: 'No available table' });
    const { data, error } = await supabase
      .from('reservations')
      .insert({ name, phone, email, party_size, notes, start_time, end_time, table_id, source })
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }
  if (method === 'PATCH') {
    const { id, table_id } = req.body;
    const { data, error } = await supabase
      .from('reservations')
      .update({ table_id })
      .eq('id', id)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  res.setHeader('Allow', ['GET','POST','PATCH']);
  res.status(405).end(`Method ${method} Not Allowed`);
}