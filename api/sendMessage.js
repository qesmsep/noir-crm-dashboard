import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { member_id, account_id, message, to, phone_number_id } = req.body;
  if (!member_id || !account_id || !message || !to || !phone_number_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Send message via OpenPhone
    const openPhoneRes = await fetch('https://api.openphone.co/v1/messages.send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        text: message,
        phone_number_id
      })
    });
    const openPhoneData = await openPhoneRes.json();
    if (!openPhoneRes.ok) {
      return res.status(500).json({ error: 'Failed to send message', details: openPhoneData });
    }

    // Log message in Supabase
    const { error } = await supabase.from('messages').insert({
      account_id,
      member_id,
      message,
      direction: 'out',
      timestamp: new Date().toISOString()
    });
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
} 