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

    // Query members table for the phone number (primary or secondary)
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .or(`phone.eq.${formattedPhone},phone2.eq.${formattedPhone}`)
      .single();

    if (memberError && memberError.code !== 'PGRST116') {
      // PGRST116 = No rows found
      console.error('Error checking membership:', memberError);
      return res.status(500).json({ error: 'Error checking membership status' });
    }

    if (memberData) {
      return res.status(200).json({ isMember: true });
    }

    // Check potential_members table
    const { data: potentialData, error: potentialError } = await supabase
      .from('potential_members')
      .select('member_id')
      .eq('member_id', formattedPhone)
      .single();

    if (potentialError && potentialError.code !== 'PGRST116') {
      console.error('Error checking potential_members:', potentialError);
      return res.status(500).json({ error: 'Error checking potential_members status' });
    }

    return res.status(200).json({ isMember: !!potentialData });
  } catch (error) {
    console.error('Error checking membership:', error);
    return res.status(500).json({ error: 'Error checking membership status' });
  }
} 