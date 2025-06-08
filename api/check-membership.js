import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Format phone number to match database format
    const formattedPhone = phone.replace(/\D/g, '');

    // Query members table for the phone number
    const { data, error } = await supabase
      .from('members')
      .select('member_id')
      .or(`phone.eq.${formattedPhone},phone2.eq.${formattedPhone}`)
      .single();

    if (error) {
      console.error('Error checking membership:', error);
      return res.status(500).json({ error: 'Error checking membership status' });
    }

    // If data exists, the phone number belongs to a member
    return res.status(200).json({ isMember: !!data });
  } catch (error) {
    console.error('Error checking membership:', error);
    return res.status(500).json({ error: 'Error checking membership status' });
  }
} 