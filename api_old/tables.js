

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const { data, error } = await supabase.from('tables').select('*').order('number');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'POST') {
    const { number, capacity } = req.body;
    const { data, error } = await supabase.from('tables').insert({ number, capacity }).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }
  if (method === 'PATCH') {
    const { id, number, capacity } = req.body;
    const { data, error } = await supabase.from('tables').update({ number, capacity }).eq('id', id).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('tables').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }
  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}