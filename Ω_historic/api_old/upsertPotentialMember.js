import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { member_id, first_name, last_name, email } = req.body;
  if (!member_id) {
    return res.status(400).json({ error: 'member_id (phone) is required' });
  }
  try {
    const { error } = await supabase
      .from('potential_members')
      .upsert({
        member_id,
        first_name,
        last_name,
        email
      });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
} 