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
      .from('member_notes')
      .select('id, note, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  } else if (method === 'POST') {
    const { member_id, note } = req.body;
    if (!member_id || !note) {
      return res.status(400).json({ error: 'member_id and note are required' });
    }
    const { data, error } = await supabase
      .from('member_notes')
      .insert([{ member_id, note }])
      .select('id, note, created_at');
    if (error) return res.status(500).json({ error: error.message });
    // Return updated list
    const { data: allNotes } = await supabase
      .from('member_notes')
      .select('id, note, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });
    return res.status(200).json({ data: allNotes });
  } else if (method === 'PUT') {
    const { id, member_id, note } = req.body;
    if (!id || !member_id || !note) {
      return res.status(400).json({ error: 'id, member_id, and note are required' });
    }
    const { data, error } = await supabase
      .from('member_notes')
      .update({ note })
      .eq('id', id)
      .eq('member_id', member_id)
      .select('id, note, created_at');
    if (error) return res.status(500).json({ error: error.message });
    // Return updated list
    const { data: allNotes } = await supabase
      .from('member_notes')
      .select('id, note, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });
    return res.status(200).json({ data: allNotes });
  } else if (method === 'DELETE') {
    const { id, member_id } = req.body;
    if (!id || !member_id) {
      return res.status(400).json({ error: 'id and member_id are required' });
    }
    const { error } = await supabase
      .from('member_notes')
      .delete()
      .eq('id', id)
      .eq('member_id', member_id);
    if (error) return res.status(500).json({ error: error.message });
    // Return updated list
    const { data: allNotes } = await supabase
      .from('member_notes')
      .select('id, note, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });
    return res.status(200).json({ data: allNotes });
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
}