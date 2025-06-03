import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id } = req.query;
  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('member_id', member_id)
    .order('timestamp', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }

  return res.status(200).json({ messages: data });
} 