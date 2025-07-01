import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    const digits = phone.replace(/\D/g, '');
    const possiblePhones = [
      digits,                    // 6199713730
      '+1' + digits,            // +16199713730
      '1' + digits,             // 16199713730
      '+1' + digits.slice(-10), // +16199713730 (if it's already 11 digits)
      digits.slice(-10)         // 6199713730 (last 10 digits)
    ];
    
    console.log('Checking membership for phone:', phone);
    console.log('Possible phone formats:', possiblePhones);

    // Query members table for the phone number with multiple formats
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('member_id')
      .or(
        possiblePhones.map(p => `phone.eq.${p}`).join(',')
      )
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
      .eq('member_id', digits)
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