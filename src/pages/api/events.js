import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const { data, error } = await supabase.from('events').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'POST') {
    const { data, error } = await supabase.from('events').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }
  if (method === 'PATCH') {
    const { id, title, start_time, end_time } = req.body;
    const { data, error } = await supabase.from('events').update({ title, start_time, end_time }).eq('id', id).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }
  if (method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }
  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}