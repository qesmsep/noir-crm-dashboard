

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const { member_id } = req.query;
    if (!member_id) {
      return res.status(400).json({ error: 'member_id is required' });
    }
    const { data, error } = await supabase
      .from('member_attributes')
      .select('id, key, value, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  } else if (method === 'POST') {
    const { member_id, key, value } = req.body;
    if (!member_id || !key) {
      return res.status(400).json({ error: 'member_id and key are required' });
    }
    const { data, error } = await supabase
      .from('member_attributes')
      .upsert({ member_id, key, value }, { onConflict: ['member_id', 'key'] })
      .select('id, key, value, created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  } else if (method === 'PUT') {
    const { id, member_id, key, value } = req.body;
    if (!id || !member_id || !key) {
      return res.status(400).json({ error: 'id, member_id, and key are required' });
    }
    const { data, error } = await supabase
      .from('member_attributes')
      .update({ key, value })
      .eq('id', id)
      .eq('member_id', member_id)
      .select('id, key, value, created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  } else if (method === 'DELETE') {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const { error } = await supabase
      .from('member_attributes')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted successfully' });
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
}