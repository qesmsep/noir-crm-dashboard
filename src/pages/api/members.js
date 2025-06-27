import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_MEMBER_FIELDS = [
  'account_id', 'first_name', 'last_name', 'email', 'phone', 'stripe_customer_id',
  'join_date', 'company', 'address', 'address_2', 'city', 'state', 'zip', 'country',
  'referral', 'membership', 'monthly_dues', 'photo', 'dob', 'auth_code', 'token', 'created_at',
  'member_type', 'member_id'
];

function cleanMemberObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => ALLOWED_MEMBER_FIELDS.includes(key))
  );
}

function getMonthlyDues(membership) {
  if (!membership) return 0;
  const map = {
    'Membership': 100,
    'Membership + Partner': 125,
    'Membership + Daytime': 350,
    'Membership + Partner + Daytime': 375,
    // Keep legacy support for existing members
    'Solo': 100,
    'Duo': 125,
    'Premier': 250,
    'Reserve': 1000,
    'Host': 1
  };
  return map[membership] || 0;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*');
      if (error) throw error;
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  
  if (req.method === 'PUT') {
    try {
      const { member_id, ...updateData } = req.body;
      
      if (!member_id) {
        return res.status(400).json({ error: 'Missing required field: member_id' });
      }

      // Clean the update data to only include allowed fields
      const cleanedData = cleanMemberObject(updateData);
      
      const { data, error } = await supabase
        .from('members')
        .update(cleanedData)
        .eq('member_id', member_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating member:', error);
        throw error;
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error updating member:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Extract member_id from the URL path
      const member_id = req.url.split('/').pop();
      
      if (!member_id) {
        return res.status(400).json({ error: 'Missing required field: member_id' });
      }

      // Instead of deleting, set a deactivated flag
      const { error } = await supabase
        .from('members')
        .update({ deactivated: true })
        .eq('member_id', member_id);

      if (error) {
        console.error('Error deactivating member:', error);
        throw error;
      }

      return res.status(200).json({ success: true, message: 'Member deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating member:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account_id, primary_member, secondary_member } = req.body;

    if (!account_id || !primary_member) {
      return res.status(400).json({ error: 'Missing required fields: account_id and primary_member' });
    }

    // The AddMemberModal already cleans and structures the data
    // We just need to insert it into the database
    const { data: primaryMemberData, error: primaryError } = await supabase
      .from('members')
      .insert([primary_member])
      .select()
      .single();

    if (primaryError) {
      console.error('Error inserting primary member:', primaryError);
      throw primaryError;
    }

    // If there's a secondary member, add them too
    if (secondary_member) {
      const { error: secondaryError } = await supabase
        .from('members')
        .insert([secondary_member]);

      if (secondaryError) {
        console.error('Error inserting secondary member:', secondaryError);
        throw secondaryError;
      }
    }

    return res.status(200).json({ success: true, data: primaryMemberData });
  } catch (error) {
    console.error('Error creating member:', error);
    return res.status(500).json({ error: error.message });
  }
} 