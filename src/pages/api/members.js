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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account_id, primary_member, secondary_member } = req.body;

    const now = new Date().toISOString();
    const primaryMemberClean = cleanMemberObject({
      ...primary_member,
      monthly_dues: primary_member.monthly_dues || getMonthlyDues(primary_member.membership),
      created_at: now
    });
    const secondaryMemberClean = secondary_member ? cleanMemberObject({
      ...secondary_member,
      monthly_dues: secondary_member.monthly_dues || getMonthlyDues(secondary_member.membership),
      created_at: now
    }) : null;

    // Start a transaction
    const { data: primaryMemberData, error: primaryError } = await supabase
      .from('members')
      .insert([primaryMemberClean])
      .select()
      .single();

    if (primaryError) throw primaryError;

    // If there's a secondary member, add them too
    if (secondaryMemberClean) {
      const { error: secondaryError } = await supabase
        .from('members')
        .insert([secondaryMemberClean]);

      if (secondaryError) throw secondaryError;
    }

    return res.status(200).json({ success: true, data: primaryMemberData });
  } catch (error) {
    console.error('Error creating member:', error);
    return res.status(500).json({ error: error.message });
  }
} 